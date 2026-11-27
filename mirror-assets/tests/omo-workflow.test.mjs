import { expect, test } from "bun:test";
import {
  collectSameModelWorkflow,
  startSameModelWorkflow,
} from "../../skills/poteto-mode/scripts/omo-workflow.mjs";

const route = {
  provider: "provider",
  modelId: "current",
  reasoning: "high",
  model: "provider/current:high",
};
const handle = { runId: "dag_fixture", route };

function settled(status, nodes, outputs = {}) {
  return {
    details: {
      kind: "waited",
      run_id: handle.runId,
      result: { status, snapshot: { nodes }, nodes: outputs },
    },
  };
}

test("independent slices do not create work in Workflows", async () => {
  const result = await startSameModelWorkflow(
    {
      bash: async () => ({
        details: { status: "completed" },
        text: "PSTACK_PARENT=provider|current|high",
      }),
      workflow: async () => {
        throw new Error("Independent slices created a DAG");
      },
    },
    { key: "parallel", name: "Parallel", nodes: [{ id: "a" }, { id: "b" }] },
  );
  expect(result.kind).toBe("use-tasks");
});

test("a failed graph falls back only when no worker ran", async () => {
  const nodes = [
    { id: "a", state: "failed", error: { code: "plan_unresolved" } },
    { id: "b", state: "skipped" },
  ];
  const result = await collectSameModelWorkflow(
    { workflow: async () => settled("failed", nodes) },
    handle,
  );
  expect(result.kind).toBe("fallback");
});

test("a partly executed graph blocks duplicate work even if routing later fails", async () => {
  const nodes = [
    { id: "a", state: "completed", taskId: "st_0001" },
    { id: "b", state: "failed", error: { code: "plan_unresolved" } },
  ];
  const result = await collectSameModelWorkflow(
    { workflow: async () => settled("failed", nodes) },
    handle,
  );
  expect(result.kind).toBe("blocked");
});

test("one mismatched node withholds the whole graph's output", async () => {
  const nodes = [
    { id: "a", state: "completed", taskId: "st_0001" },
    { id: "b", state: "completed", taskId: "st_0002" },
  ];
  const outputs = {
    a: { ...nodes[0], output: "independent evidence" },
    b: { ...nodes[1], output: "unverified evidence" },
  };
  const result = await collectSameModelWorkflow(
    {
      workflow: async () => settled("completed", nodes, outputs),
      task_output: async ({ task_id }) => ({
        details: {
          snapshot: {
            task_id,
            status: "completed",
            agent_type: "pstack-worker",
            resolved_model: {
              source: "explicit",
              provider: "provider",
              model_id: "current",
              reasoning: task_id === "st_0001" ? "high" : "medium",
            },
            effective_model: { provider: "provider", model_id: "current" },
          },
        },
      }),
    },
    handle,
  );
  expect(result.kind).toBe("blocked");
  expect(result.unverified).toEqual(["b"]);
  expect(result).not.toHaveProperty("outputs");
});
