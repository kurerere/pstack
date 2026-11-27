import { expect, test } from "bun:test";
import { dispatchSameModelTasks } from "../../skills/poteto-mode/scripts/omo-task.mjs";

const brief = {
  prompt: "TASK: Review the selected file.",
  task_summary: "Review file",
};
const activeSession = async () => ({
  details: { status: "completed" },
  text: "PSTACK_PARENT=provider|current|high",
});

test("no task starts when OMO cannot report the parent reasoning level", async () => {
  const result = await dispatchSameModelTasks(
    {
      bash: async () => ({
        details: { status: "completed" },
        text: "PSTACK_PARENT=provider|current|",
      }),
      task: async () => {
        throw new Error("Unverified task was dispatched");
      },
    },
    [brief],
  );

  expect(result.kind).toBe("fallback");
});

test("a task with a different reasoning level is not returned as usable", async () => {
  const stopped = new Set();
  const result = await dispatchSameModelTasks(
    {
      bash: activeSession,
      task: async () => ({
        details: {
          task_id: "st_1234",
          status: "running",
          resolved_model: {
            source: "explicit",
            provider: "provider",
            model_id: "current",
            reasoning: "medium",
          },
        },
      }),
      task_cancel: async ({ task_id }) => {
        stopped.add(task_id);
        return { details: { task_id, status: "cancelled" } };
      },
    },
    [brief],
  );

  expect(result.items.map(({ kind }) => kind)).toEqual(["fallback"]);
  expect([...stopped]).toEqual(["st_1234"]);
});

test.each([
  ["current", "priority", "started"],
  ["current-fast", "priority", "started"],
  ["current", "flex", "fallback"],
])(
  "checks the Fast alias for %s under service tier %s",
  async (model, tier, outcome) => {
    const result = await dispatchSameModelTasks(
      {
        bash: async () => ({
          ...(await activeSession()),
          text: `PSTACK_PARENT=provider|${model}|high`,
        }),
        task: async () => ({
          details: {
            task_id: "st_4321",
            status: "running",
            model: `provider/${model}:high`,
            resolved_model: {
              source: "explicit",
              provider: "provider",
              model_id: "current-fast",
              reasoning: "high",
            },
            effective_model: {
              provider: "provider",
              model_id: "current",
              service_tier: tier,
            },
          },
        }),
        task_cancel: async ({ task_id }) => ({
          details: { task_id, status: "cancelled" },
        }),
      },
      [brief],
    );

    expect(result.items.map(({ kind }) => kind)).toEqual([outcome]);
  },
);

test("a cancel request without a terminal receipt does not permit duplicate work", async () => {
  const result = await dispatchSameModelTasks(
    {
      bash: activeSession,
      task: async () => ({
        details: {
          task_id: "st_2345",
          status: "running",
          resolved_model: {
            source: "explicit",
            provider: "provider",
            model_id: "other",
            reasoning: "high",
          },
        },
      }),
      task_cancel: async () => ({
        details: { kind: "cancel_pending", task_id: "st_2345" },
      }),
    },
    [brief],
  );

  expect(result.items.map(({ kind }) => kind)).toEqual(["blocked"]);
});

test("a paused task stays on hold rather than starting a fallback", async () => {
  const result = await dispatchSameModelTasks(
    {
      bash: activeSession,
      task: async () => ({ details: { task_id: "st_3456", status: "paused" } }),
      task_cancel: async () => {
        throw new Error("A held task was cancelled");
      },
    },
    [brief],
  );

  expect(result.items.map(({ kind }) => kind)).toEqual(["blocked"]);
});
