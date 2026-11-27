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

export async function dispatchSameModelTasks(tool, briefs) {
  if (!Array.isArray(briefs) || briefs.length === 0)
    throw new TypeError("Expected at least one pstack task brief");
  const tasks = briefs.map(({ prompt, task_summary, name, isolated }) => ({
    prompt,
    task_summary,
    ...(name === undefined ? {} : { name }),
    ...(isolated === true ? { isolated: true, apply: false } : {}),
  }));

  const snapshot = await tool.bash({ command: parentCommand, timeout: 10 });
  const match =
    typeof snapshot.text === "string" ? parentLine.exec(snapshot.text) : null;
  if (snapshot.hasError || snapshot.details?.status !== "completed" || !match) {
    return {
      kind: "fallback",
      reason: "OMO did not expose the active model and reasoning level",
    };
  }
  const [, provider, modelId, reasoning] = match;
  const model = `${provider}/${modelId}:${reasoning}`;
  const response = await tool.task({
    subagent_type: "pstack-worker",
    model,
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

      const resolved = entry.resolved_model;
      const effective = entry.effective_model;
      const resolvedId = resolved?.model_id;
      const requestedModelMatches =
        resolvedId === modelId ||
        (entry.model === model && resolvedId === `${modelId}-fast`);
      const effectiveModelMatches =
        !effective ||
        (effective.provider === provider &&
          (effective.model_id === resolvedId ||
            (effective.service_tier === "priority" &&
              `${effective.model_id}-fast` === resolvedId)));
      if (
        liveStatuses.has(status) &&
        resolved?.source === "explicit" &&
        resolved.provider === provider &&
        requestedModelMatches &&
        resolved.reasoning === reasoning &&
        effectiveModelMatches
      ) {
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
