const parentCommand =
  'printf "PSTACK_PARENT=%s|%s|%s\\n" "$PI_PROVIDER" "$PI_MODEL" "$PI_REASONING_LEVEL"';
const parentLine =
  /^PSTACK_PARENT=([^|\s/:]+)\|([^|\s]+)\|(off|minimal|low|medium|high|xhigh|max)$/m;
const taskIdPattern = /^st_[0-9a-f]+$/;
const liveStatuses = new Set(["pending", "running", "completed"]);
const deniedStatuses = new Set([
  "paused",
  "cancelled",
  "interrupted",
  "denied",
]);
const stoppedStatuses = new Set([
  "cancelled",
  "completed",
  "error",
  "interrupted",
]);
const planError =
  /^(?:Subagent type "pstack-worker" is not an available agent\.|The task model pin "|No senpi model registry is available)/;

function matchesOmoRoute(entry, { provider, modelId, reasoning, model }) {
  const resolved = entry.resolved_model;
  const effective = entry.effective_model;
  const resolvedId = resolved?.model_id;
  const priorityUpstream =
    effective?.service_tier === "priority" &&
    effective.provider === provider &&
    `${effective.model_id}-fast` === resolvedId;
  const resolvedMatches =
    resolvedId === modelId ||
    (resolvedId === `${modelId}-fast` &&
      (entry.model === model ||
        (priorityUpstream && effective.model_id === modelId)));
  return (
    resolved?.source === "explicit" &&
    resolved.provider === provider &&
    resolvedMatches &&
    resolved.reasoning === reasoning &&
    (!effective ||
      (effective.provider === provider && effective.model_id === resolvedId) ||
      priorityUpstream)
  );
}

const levels = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const tiers = new Set(["auto", "flex", "priority"]);

async function readRoute(tool, categoryRouteCommand) {
  if (
    categoryRouteCommand !== undefined &&
    (typeof categoryRouteCommand !== "string" || !categoryRouteCommand.trim())
  )
    return null;
  const snapshot = await tool.bash({
    command: categoryRouteCommand ?? parentCommand,
    timeout: 10,
  });
  if (
    snapshot.hasError ||
    snapshot.details?.status !== "completed" ||
    (snapshot.details.exitCode ?? 0) !== 0 ||
    typeof snapshot.text !== "string"
  )
    return null;

  if (categoryRouteCommand !== undefined) {
    // The user's resolver selects a single-model category from live session state.
    let route;
    try {
      route = JSON.parse(snapshot.text);
    } catch {
      return null;
    }
    if (
      !route ||
      typeof route.category !== "string" ||
      !route.category.trim() ||
      typeof route.provider !== "string" ||
      !route.provider.trim() ||
      typeof route.modelId !== "string" ||
      !route.modelId.trim() ||
      !levels.has(route.reasoning) ||
      !tiers.has(route.serviceTier)
    )
      return null;
    return route;
  }

  const match = parentLine.exec(snapshot.text);
  if (!match) return null;
  const [, provider, modelId, reasoning] = match;
  return { provider, modelId, reasoning };
}

function matchesCategoryRoute(entry, route) {
  const resolved = entry.resolved_model;
  if (
    entry.category !== route.category ||
    resolved?.source !== "category" ||
    entry.fallback_models?.length ||
    entry.fallback_attempts?.length
  )
    return false;

  // A priority alias may be reported as its upstream base ID plus the tier.
  // A plain base ID alone is insufficient evidence of priority service.
  function sameModel(record) {
    if (record.provider !== route.provider) return false;
    const isPinnedFastAlias =
      record.model_id === route.modelId &&
      route.modelId.endsWith("-fast") &&
      route.serviceTier === "priority";
    const tier =
      record.service_tier ?? (isPinnedFastAlias ? "priority" : "auto");
    if (tier !== route.serviceTier) return false;
    return (
      record.model_id === route.modelId ||
      (tier === "priority" && `${record.model_id}-fast` === route.modelId)
    );
  }

  const effort = (record) =>
    record.reasoning ?? record.reasoning_effort ?? record.variant;
  const effective = entry.effective_model;
  return (
    sameModel(resolved) &&
    effort(resolved) === route.reasoning &&
    (!effective ||
      (sameModel(effective) &&
        (effort(effective) === undefined ||
          effort(effective) === route.reasoning)))
  );
}

export async function dispatchSameModelTasks(
  tool,
  briefs,
  { categoryRouteCommand } = {},
) {
  if (!Array.isArray(briefs) || briefs.length === 0)
    throw new TypeError("Expected at least one pstack task brief");
  const tasks = briefs.map(({ prompt, task_summary, name, isolated }) => ({
    prompt,
    task_summary,
    ...(name === undefined ? {} : { name }),
    ...(isolated === true ? { isolated: true, apply: false } : {}),
  }));

  const route = await readRoute(tool, categoryRouteCommand).catch(() => null);
  if (!route) {
    return {
      kind: "fallback",
      reason: "OMO could not verify a route for the current session",
    };
  }
  const model = `${route.provider}/${route.modelId}:${route.reasoning}`;
  const response = await tool.task({
    ...(route.category
      ? { category: route.category }
      : { subagent_type: "pstack-worker", model }),
    run_in_background: true,
    tasks,
  });
  const detail = response.details;
  const entries =
    detail?.items ?? (tasks.length === 1 && detail ? [detail] : []);
  if (
    response.hasError ||
    !Array.isArray(entries) ||
    entries.length !== tasks.length
  ) {
    return {
      kind: "blocked",
      reason: "OMO did not return a task receipt for each brief",
    };
  }

  const items = await Promise.all(
    entries.map(async (entry) => {
      const id = entry?.task_id;
      const status = entry?.status;
      const reason = entry?.reason ?? entry?.error_message;
      if (
        id === "" &&
        (status === "plan_error" ||
          (status === "error" && planError.test(reason ?? "")))
      ) {
        return {
          kind: "fallback",
          reason: reason ?? "OMO could not resolve the same-model task route",
        };
      }
      if (
        typeof id !== "string" ||
        !taskIdPattern.test(id) ||
        deniedStatuses.has(status)
      ) {
        return {
          kind: "blocked",
          reason: reason ?? "OMO did not admit this task",
          taskId: id,
        };
      }

      const matches = route.category
        ? matchesCategoryRoute(entry, route)
        : matchesOmoRoute(entry, { ...route, model });
      if (liveStatuses.has(status) && matches) {
        return { kind: "started", taskId: id };
      }

      const stop = await tool.task_cancel({
        task_id: id,
        reason: "pstack: task model or reasoning was not verified",
      });
      if (
        !stop.hasError &&
        stop.details?.task_id === id &&
        stoppedStatuses.has(stop.details.status)
      ) {
        return {
          kind: "fallback",
          reason: "The unverified task was stopped; discard its output",
          taskId: id,
        };
      }
      return {
        kind: "blocked",
        reason: "Could not confirm the unverified task stopped",
        taskId: id,
      };
    }),
  );
  return { kind: "receipts", model, items };
}
