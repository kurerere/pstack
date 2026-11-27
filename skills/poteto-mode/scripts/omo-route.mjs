const parentCommand =
  'printf "PSTACK_PARENT=%s|%s|%s\\n" "$PI_PROVIDER" "$PI_MODEL" "$PI_REASONING_LEVEL"';
const parentLine =
  /^PSTACK_PARENT=([^|\s/:]+)\|([^|\s]+)\|(off|minimal|low|medium|high|xhigh|max)$/m;

export const workerTarget = "pstack-worker";

export async function readOmoRoute(tool) {
  const snapshot = await tool.bash({ command: parentCommand, timeout: 10 });
  const match =
    typeof snapshot.text === "string" ? parentLine.exec(snapshot.text) : null;
  if (snapshot.hasError || snapshot.details?.status !== "completed" || !match) {
    return null;
  }
  const [, provider, modelId, reasoning] = match;
  return {
    provider,
    modelId,
    reasoning,
    model: `${provider}/${modelId}:${reasoning}`,
  };
}

export function matchesOmoRoute(
  entry,
  { provider, modelId, reasoning, model },
) {
  const resolved = entry?.resolved_model;
  const effective = entry?.effective_model;
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
