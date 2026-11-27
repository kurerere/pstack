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

OMO's `ulw $poteto-mode …` combination uses both the native Ultrawork mode and pstack instructions. Native planning, execute, loop, and DAG workflows retain their own routing; the `pstack-worker` guard does not control them.

This adapter covers the interactive workflows. It does not provide Cursor cloud agents, Automations, or a full unattended PR runner.
