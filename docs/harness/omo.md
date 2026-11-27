# pstack in OMO

Import the desired pstack skill folders into Magpie, including `poteto-mode`, and enable them for OMO. The [tool mapping](../../skills/poteto-mode/references/omo.md) ships inside `poteto-mode`, so it is available even when Magpie installs only the skill folders. No OMO extension or pstack model settings file is required.

Start a task with `$poteto-mode` in the composer. For example:

```text
$poteto-mode Trace how the retry limit is chosen. Cite the code that sets it and the code that uses it. Do not edit anything.
```

## Standalone skill calls

`$poteto-mode` loads the mapping itself. To also call pstack skills directly, such as `$swarm` or `$arena`, add this rule to Magpie's global instructions. It applies only in OMO:

```markdown
In OMO, before running any pstack skill, including a direct invocation, read
`references/omo.md` relative to the installed `poteto-mode/SKILL.md` once per
session. Apply its tool and model mappings in place of the skill's Cursor
instructions. If the mapping or its verified task route is unavailable, do the
work in the main conversation; do not select another worker model or read or
write pstack model settings.
```

Until that rule is active, start with `$poteto-mode` rather than invoking pstack leaf skills on their own.

## Optional same-model tasks

In a trusted workspace, add the [`pstack-worker` declaration](../../skills/poteto-mode/references/omo-worker.json) to `.omo/omo.json` and start a new OMO conversation. If the workspace already has `.omo/omo.json` or `.omo/omo.jsonc`, merge only `agents.pstack-worker` into that file. This declaration names a native task target; it contains no model, reasoning level, or fallback chain.

Choose the model and reasoning level in OMO's conversation controls. `setup-pstack` is a no-op in OMO. When a pstack playbook delegates, it reads the live settings and uses those exact values for each native `task`. It accepts only matching OMO receipts, never another model or a category fallback. Arena and Interrogate can run three independent seats on that one model; Arena skips cross-vendor judging.

Without the target or a readable model snapshot, pstack works in the conversation. Swarm handles its slices serially, Arena compares alternatives without workers, and Interrogate runs one review and reruns findings against the real scope. If a started task's model cannot be verified, pstack discards its output; it does not duplicate the work until OMO confirms the task stopped.

The adapter does not change how pstack sequences its playbooks or how OMO runs its own workflows. It does not provide Cursor cloud agents, Automations, or a full unattended PR runner.
