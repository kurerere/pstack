# pstack in OMO

Import this checkout's skill folders with your existing skill manager, such as Magpie, and enable them for OMO. The interactive mode needs no OMO extension or pstack model settings file.

Start a task with `$poteto-mode` in the composer. For example:

```text
$poteto-mode Trace how the retry limit is chosen. Cite the code that sets it and the code that uses it. Do not edit anything.
```

You can also invoke `$arena`, `$swarm`, or `$interrogate` directly. Install `poteto-mode` alongside these skills to get the [shared OMO mapping](../../skills/poteto-mode/references/omo.md), which travels with the skill rather than this `docs/` directory. Install the other pstack skills the chosen workflow calls.

## Optional same-model tasks

In a trusted workspace, add the [`pstack-worker` declaration](../../skills/poteto-mode/references/omo-worker.json) to `.omo/omo.json` and start a new OMO conversation. If the workspace already has `.omo/omo.json` or `.omo/omo.jsonc`, merge only `agents.pstack-worker` into that file. This declaration names a native task target; it contains no model, reasoning level, or fallback chain. Leave your Magpie prompt unchanged.

Choose the model and reasoning level in OMO's conversation controls. `setup-pstack` is a no-op in OMO. When a pstack playbook delegates, it reads the live settings and uses those exact values for each native `task`. It accepts only matching OMO receipts, never another model or a category fallback. Arena and Interrogate can run three independent seats on that one model; Arena skips cross-vendor judging.

Without the target or a readable model snapshot, pstack works in the conversation. Swarm handles its slices serially, Arena compares alternatives without workers, and Interrogate runs one review and reruns findings against the real scope. If a started task's model cannot be verified, pstack discards its output; it does not duplicate the work until OMO confirms the task stopped.

## Parallel tasks and workflow graphs

`ulw $poteto-mode …` combines OMO's verification discipline with pstack's playbooks. Ordinary `$swarm` uses native tasks and appears in **Agents**. For a phase that really has dependencies, ask pstack to use the native workflow graph:

```text
ulw $poteto-mode 用 OMO 工作流图并行梳理两个模块，等两份只读报告都落到临时文件后，再核对它们是否一致。不要改项目文件。
```

With `pstack-worker` registered, this path pins the same model and reasoning level on every node and checks OMO's task receipts before using node results. Open the run under **Workflows**. Data moves through named scratch files, not through the graph edges. Production edits still use isolated tasks or run in the main conversation, because OMO's workflow nodes do not expose per-node checkout isolation.

Direct `mass ulw`, native planning, execute, and loop retain their own model routing. The pstack guard does not change those host workflows. Peer threads are for conversation history and handoff, not for replacing child tasks.

This adapter covers the interactive workflows. It does not provide Cursor cloud agents, Automations, or a full unattended PR runner.
