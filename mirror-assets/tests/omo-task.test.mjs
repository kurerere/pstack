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

const categoryRoute = {
  category: "review",
  provider: "provider",
  modelId: "current",
  reasoning: "high",
  serviceTier: "auto",
};
const categoryRouteCommand = "user-configured-resolver --json";
const categoryReceipt = {
  task_id: "st_abcd",
  status: "running",
  category: "review",
  resolved_model: {
    source: "category",
    provider: "provider",
    model_id: "current",
    reasoning_effort: "high",
  },
};

test("a fresh category lookup controls each batch without a call-site model pin", async () => {
  let snapshot = categoryRoute;
  const tool = {
    bash: async ({ command }) => {
      expect(command).toBe(categoryRouteCommand);
      return {
        details: { status: "completed" },
        text: JSON.stringify(snapshot),
      };
    },
    task: async (args) => {
      expect(args).toEqual({
        category: snapshot.category,
        tasks: [{ ...brief, isolated: true, apply: false }, brief],
        run_in_background: true,
      });
      const receipt = { ...categoryReceipt, category: args.category };
      return {
        details: { items: [receipt, { ...receipt, task_id: "st_1234" }] },
      };
    },
  };
  for (const category of ["review", "second"]) {
    snapshot = { ...categoryRoute, category };
    const result = await dispatchSameModelTasks(
      tool,
      [{ ...brief, isolated: true }, brief],
      { categoryRouteCommand },
    );
    expect(result.items).toEqual([
      { kind: "started", taskId: "st_abcd" },
      { kind: "started", taskId: "st_1234" },
    ]);
  }
});

test.each([
  ["review", 0],
  [JSON.stringify({ ...categoryRoute, reasoning: null }), 0],
  [JSON.stringify(categoryRoute), 1],
])(
  "invalid or unsuccessful category lookup never dispatches",
  async (text, exitCode) => {
    const result = await dispatchSameModelTasks(
      {
        bash: async () => ({
          details: { status: "completed", exitCode },
          text,
        }),
        task: () => {
          throw new Error("Unexpected dispatch");
        },
      },
      [brief],
      { categoryRouteCommand },
    );
    expect(result.kind).toBe("fallback");
  },
);

test.each([
  [{}, "current", "auto", "started"],
  [{ category: "other" }, "current", "auto", "fallback"],
  [{ fallback_models: ["another"] }, "current", "auto", "fallback"],
  [
    { effective_model: { provider: "other", model_id: "current" } },
    "current",
    "auto",
    "fallback",
  ],
  [
    {
      effective_model: {
        provider: "provider",
        model_id: "current",
        reasoning: "low",
      },
    },
    "current",
    "auto",
    "fallback",
  ],
  [
    {
      effective_model: {
        provider: "provider",
        model_id: "current",
        service_tier: "priority",
      },
    },
    "current-fast",
    "priority",
    "started",
  ],
  [
    { effective_model: { provider: "provider", model_id: "current" } },
    "current-fast",
    "priority",
    "fallback",
  ],
])(
  "validates the native category and effective route",
  async (overrides, modelId, serviceTier, kind) => {
    const result = await dispatchSameModelTasks(
      {
        bash: async () => ({
          details: { status: "completed" },
          text: JSON.stringify({ ...categoryRoute, modelId, serviceTier }),
        }),
        task: async () => ({
          details: {
            ...categoryReceipt,
            resolved_model: {
              ...categoryReceipt.resolved_model,
              model_id: modelId,
            },
            ...overrides,
          },
        }),
        task_cancel: async ({ task_id }) => ({
          details: { task_id, status: "cancelled" },
        }),
      },
      [brief],
      { categoryRouteCommand },
    );
    expect(result.items[0].kind).toBe(kind);
  },
);

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
