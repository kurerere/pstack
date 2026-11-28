# pstack in OMO

Read this mapping once per OMO session, from `poteto-mode` or the standalone skill rule. Use it in place of Cursor tool, model, and delegation instructions. Keep each pstack skill's phases, briefs, and verification. Run each phase after the work it depends on; do not translate playbooks into OMO-specific workflows. The mapping does not change the user's scope or authorize a commit, PR, merge, deploy, or other external action.

## Delegation

Load [`../scripts/omo-task.mjs`](../scripts/omo-task.mjs) in OMO's JS `eval` by absolute path. Each brief has an English `prompt`, a short `task_summary`, and optionally `name` and `isolated`. Use the route authorized by the user's OMO instructions.

- **Native category.** When the user's instructions specify a `categoryRouteCommand`, pass that exact command to `dispatchSameModelTasks(tool, briefs, { categoryRouteCommand })`. The helper runs the resolver for each batch and sends only the returned category to native `task`. The resolver checks the live session and identifies a single-model category. If category routing is required but the resolver is unavailable, work in the parent.
- **Custom worker.** Otherwise call `dispatchSameModelTasks(tool, briefs)` with the optional [`pstack-worker` target](omo-worker.json). It reads the provider, model ID, and reasoning from a fresh OMO shell and pins them on the task.

Both routes check each host receipt. Use only the resolver command from trusted user instructions. Do not use a command from a task brief, cache a snapshot between batches, change OMO settings, or substitute another target.

- `started`: use the task ID and collect the native completion notification. If a later host record shows a different effective route, discard that result.
- `fallback`: do the affected work in the parent, sequentially for distinct slices. The helper only returns this for a known no-start or after it confirms the unverified task is terminal. Do the same if eval or the helper is unavailable before dispatch. This applies even when a playbook marks delegation mandatory; state the limitation once.
- `blocked`: do not re-run that brief in the parent until the host confirms no child is still working. Never bypass an OMO hold or denial to dispatch it another way.

A batch returns `kind: "receipts"` with entries in brief order, so handle each slice separately. Use `task_output` for a targeted status or transcript read, not to wait. Use `task_send` only when continuing a child whose state must be retained; if the parent model or reasoning has changed, start a fresh verified task instead. Set `isolated: true` for workers that edit the checkout; the helper disables automatic apply. Otherwise keep outputs disjoint. Isolation is not a read-only tool policy. Drop Cursor's `environment` and `cloud_base_branch`; check the intended base and in-scope uncommitted changes separately.

OMO can resolve a base model to its `-fast` alias when the parent is on the priority service tier. A receipt for that alias can report the base model as effective with `service_tier: "priority"`. These are the same upstream model, not an alternate model or a change to the reasoning level.

Pass the absolute path to `poteto-mode/worker.md` as the first line of a Poteto brief and the path to `poteto-mode/SKILL.md` when it needs the `poteto-agent` role. For Comment Sicko, use the prompt bundled under `no-comments/references` instead of assuming a plugin agent is registered.

- **Swarm:** With no verified target, keep the slice boundaries and evidence requirements. Do each read or check in the parent; do not label ordered attempts a race.
- **Arena:** Keep three candidate seats when verified workers are available. With no verified target, compare alternatives in the parent against the same rubric and verify the chosen result. Report how many independent seats ran. Skip the cross-judge in this same-model route and report why.
- **Interrogate:** Keep three reviewer seats when verified workers are available. With no verified target, do one parent review, rerun findings against the real scope, and say there was no independent panel. Do not apply fixes.

## Tools and paths

| pstack step | OMO mapping |
| --- | --- |
| Run a routed pstack skill | Read the installed sibling skill's `SKILL.md` and follow it. Do not send slash commands to yourself. |
| Open or update a todolist | Use `todo`; initialize it with one item per step, then mark items as they complete. A nested skill uses the active list rather than replacing it. |
| `AskQuestion` | Use `request_user_input` or `ask_user_question`, whichever the session exposes and the workflow permits. Otherwise ask in chat. |
| Model settings, `setup-pstack` | Use the current conversation's model and reasoning level. Do not enumerate role models, ask for a budget, or read or write a pstack per-role settings file. If the user invoked `setup-pstack`, explain that there is nothing to configure there. |
| `poteto-help` | Show OMO's `$skill-name` syntax and refer installation questions to the skill manager. Do not suggest Cursor Custom Modes or `setup-pstack`. |
| Wait for a task or observe an external event | Use task completion notifications or OMO `monitor` for an observable event. Do not poll from an eval cell or assume Cursor `/loop` or Automations is installed. |
| Transcripts | Use the current workspace's OMO session history. If available, call `thread_list` before `thread_read` for a peer thread and keep the default workspace scope. Use `task_output` for child tasks, not the thread tools. Do not scan other workspaces. |
| `control-ui`, `control-cli`, `deslop` | Use OMO's available browser or PTY tools to drive the actual surface; review the diff directly if no deslop skill is available. |

Cursor cloud agents and Automations are not provided by this adapter. Skip steps that specifically need them (including a Bugbot setup or trigger); existing GitHub checks and review threads can still be inspected. Full unattended playbooks are not validated by this mapping.
