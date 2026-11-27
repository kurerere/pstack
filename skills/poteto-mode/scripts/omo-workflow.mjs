import { matchesOmoRoute, readOmoRoute, workerTarget } from "./omo-route.mjs";

export async function startSameModelWorkflow(tool, { key, name, nodes }) {
  if (!Array.isArray(nodes) || !nodes.some((node) => node.dependsOn?.length)) {
    return { kind: "use-tasks", reason: "No task depends on another task" };
  }
  const route = await readOmoRoute(tool);
  if (!route) {
    return {
      kind: "fallback",
      reason: "OMO did not expose the active model and reasoning level",
    };
  }
  const definition = {
    key,
    name,
    nodes: nodes.map(
      ({ id, prompt, label, dependsOn, task_summary, description }) => ({
        id,
        prompt,
        label,
        dependsOn,
        task_summary,
        description,
        subagent_type: workerTarget,
        model: route.model,
      }),
    ),
  };
  const response = await tool.workflow({ action: "start", definition });
  const receipt = response.details;
  if (response.hasError || receipt?.kind !== "started" || !receipt.run_id) {
    return {
      kind: "blocked",
      reason: receipt?.message ?? "OMO did not return a workflow start receipt",
    };
  }
  return { kind: "started", handle: { runId: receipt.run_id, route } };
}

export async function collectSameModelWorkflow(tool, { runId, route }) {
  const response = await tool.workflow({
    action: "wait",
    run_id: runId,
    detach: true,
  });
  const receipt = response.details;
  if (response.hasError || receipt?.run_id !== runId) {
    return {
      kind: "blocked",
      runId,
      reason: "OMO did not return a receipt for this workflow",
    };
  }
  if (receipt.kind === "detached") return { kind: "pending", runId };

  const result = receipt.result;
  const nodes = result?.snapshot?.nodes;
  if (
    receipt.kind !== "waited" ||
    !Array.isArray(nodes) ||
    nodes.length === 0
  ) {
    return {
      kind: "blocked",
      runId,
      reason: "OMO did not return the workflow nodes",
    };
  }
  if (result.status !== "completed") {
    const notStarted =
      result.status === "failed" &&
      nodes.every(
        (node) =>
          !node.taskId &&
          (node.state === "skipped" ||
            (node.state === "failed" &&
              node.error?.code === "plan_unresolved")),
      );
    return notStarted
      ? {
          kind: "fallback",
          runId,
          reason: "OMO could not start any workflow workers",
        }
      : {
          kind: "blocked",
          runId,
          reason: `OMO workflow is ${result.status}; inspect the native run before retrying`,
        };
  }

  const checks = await Promise.all(
    nodes.map(async (node) => {
      const output = result.nodes?.[node.id];
      if (
        node.state !== "completed" ||
        !node.taskId ||
        output?.state !== "completed" ||
        output.taskId !== node.taskId ||
        typeof output.output !== "string"
      ) {
        return { node };
      }
      const child = await tool.task_output({
        task_id: node.taskId,
        mode: "tail",
        tail_lines: 1,
      });
      const record = child.details?.snapshot;
      const verified =
        !child.hasError &&
        record?.status === "completed" &&
        record.task_id === node.taskId &&
        record.agent_type === workerTarget &&
        Boolean(record.effective_model) &&
        matchesOmoRoute(record, route);
      return verified ? { node, output: output.output } : { node };
    }),
  );

  const unverified = checks
    .filter((check) => check.output === undefined)
    .map((check) => check.node.id);
  if (unverified.length) {
    return {
      kind: "blocked",
      runId,
      unverified,
      reason:
        "Discard output: OMO did not verify every node's model and reasoning",
    };
  }
  return {
    kind: "verified",
    runId,
    outputs: checks.map(({ node, output }) => ({
      id: node.id,
      taskId: node.taskId,
      output,
    })),
  };
}
