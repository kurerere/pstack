# pstack in OMO

Use this mapping when the session identifies itself as OMO. If the name is unclear and OMO's `eval` is available, check `OMO_NATIVE` there. This mapping overrides Cursor tool, model, and delegation instructions in pstack skills and playbooks. It does not change the user's scope or authorize a commit, PR, merge, deploy, or other external action.

## Delegation

OMO does not have an implicit general-purpose task target. Use the optional `pstack-worker` target from [`omo-worker.json`](omo-worker.json). It registers a role, not a model or reasoning budget. Do not create or change OMO config during a run. Never substitute a category, built-in agent, Cursor model slug, or peer thread. Do not call `agent()` to bypass this check.

To dispatch, load [`../scripts/omo-task.mjs`](../scripts/omo-task.mjs) in OMO's JS `eval` by its absolute path and call `dispatchSameModelTasks(tool, briefs)`. Each brief has an English `prompt`, a short `task_summary`, and optionally `name` and `isolated`. The helper reads the active provider, model ID, and reasoning level from a fresh OMO shell for every batch, passes that exact route to native `task`, and checks each host receipt. Do not cache the snapshot, use the persistent eval environment for it, or fill missing values from a previous turn.

- `started`: use the task ID and collect the native completion notification. If a later host record shows a different effective route, discard that result.
- `fallback`: do the affected work in the parent, sequentially for distinct slices. The helper only returns this for a known no-start or after it confirms the unverified task is terminal. Do the same if eval or the helper is unavailable before dispatch. This applies even when a playbook marks delegation mandatory; state the limitation once.
- `blocked`: do not re-run that brief in the parent until the host confirms no child is still working. Never bypass an OMO hold or denial to dispatch it another way.

A batch returns `kind: "receipts"` with entries in brief order, so handle each slice separately. Use `task_output` for a targeted status or transcript read, not to wait. Use `task_send` only when continuing a child whose state must be retained; if the parent model or reasoning has changed, start a fresh verified task instead. Set `isolated: true` for workers that edit the checkout; the helper disables automatic apply. Otherwise keep outputs disjoint. Isolation is not a read-only tool policy. Drop Cursor's `environment` and `cloud_base_branch`; check the intended base and in-scope uncommitted changes separately.

OMO can resolve a base model to its `-fast` alias when the parent is on the priority service tier. A receipt for that alias can report the base model as effective with `service_tier: "priority"`. These are the same upstream model, not an alternate model or a change to the reasoning level.

Pass the absolute path to `poteto-mode/worker.md` as the first line of a Poteto brief and the path to `poteto-mode/SKILL.md` when it needs the `poteto-agent` role. For Comment Sicko, use the prompt bundled under `no-comments/references` instead of assuming a plugin agent is registered.

- **Swarm:** With no verified target, keep the slice boundaries and evidence requirements. Do each read or check in the parent; do not label ordered attempts a race.
- **Arena:** Keep three candidate seats when verified workers are available. With no verified target, compare alternatives in the parent against the same rubric and verify the chosen result. Report how many independent seats ran. Skip the cross-judge in this same-model route and report why.
- **Interrogate:** Keep three reviewer seats when verified workers are available. With no verified target, do one parent review, rerun findings against the real scope, and say there was no independent panel. Do not apply fixes.

## Native workflow graph

The main conversation owns the pstack playbook, briefs, and acceptance checks. OMO owns execution and status. Independent fan-out uses `task` and appears in **Agents**. Use native `workflow` for a genuinely dependency-ordered phase when the user asks for the workflow graph; do not add edges just to get a graph. Native Ultrawork still owns the outer goal and verification lifecycle when active. Do not give the same work to both routes.

Use this path only for reads or explicitly scoped scratch handoffs. The OMO workflow node schema does not expose per-node checkout isolation. Keep production edits with the coordinator or with isolated `task` workers. Name the exact artifact path in both the producer and consumer briefs: `dependsOn` orders the nodes but does not pass their replies. The consumer checks the artifact before using it.

Read the available `mass-ulw` skill and planning reference for the native graph contract, but use the following same-model route instead of its default category selection:

1. In JS `eval`, load [`../scripts/omo-workflow.mjs`](../scripts/omo-workflow.mjs) by its absolute path. Call `startSameModelWorkflow(tool, { key, name, nodes })` with a stable key and node objects with `id`, English `prompt`, `task_summary`, and `dependsOn` as needed. The helper pins every node to the active session's `pstack-worker` route. It returns `use-tasks` if there are no dependencies, or `started` with a serializable `handle`. Keep that handle in the session so you can use it after a wake or kernel restart.
2. Open the run in the desktop **Workflows** section for status. Let OMO schedule dependencies and notify on settlement. After it settles, call `collectSameModelWorkflow(tool, handle)` once. The helper exposes node outputs only when the host confirms that every node completed on the pinned model and reasoning level.
3. With `verified`, check the actual artifacts against the playbook's acceptance criteria before reporting. With `fallback`, no worker started; do the work in the parent. With `pending`, wait for OMO's wake rather than polling. With `blocked`, inspect the native run; do not use its output or start duplicate work. Native recovery and cancellation belong to OMO. Do not retry an old graph on its original model if the parent route has changed.

An ordinary `mass ulw` request goes through OMO's native routing. The pstack same-model check applies only to graphs started through this adapter.

## Tools and paths

| pstack step | OMO mapping |
| --- | --- |
| Run a routed pstack skill | Read the installed sibling skill's `SKILL.md` and follow it. Do not send slash commands to yourself. |
| Open or update a todolist | Use `todo`; initialize it with one item per step, then mark items as they complete. A nested skill uses the active list rather than replacing it. |
| `AskQuestion` | Use `request_user_input` or `ask_user_question`, whichever the session exposes and the workflow permits. Otherwise ask in chat. |
| Model settings, `setup-pstack` | Use the current conversation's model and reasoning level. Do not read or write a pstack per-role settings file for OMO. |
| Wait for a task or observe an external event | Use task completion notifications or OMO `monitor` for an observable event. Do not poll from an eval cell or assume Cursor `/loop` or Automations is installed. |
| Transcripts | Use the current workspace's OMO session history. If available, call `thread_list` before `thread_read` for a peer thread and keep the default workspace scope. Use `task_output` for child tasks, not the thread tools. Do not scan other workspaces. |
| `control-ui`, `control-cli`, `deslop` | Use OMO's available browser or PTY tools to drive the actual surface; review the diff directly if no deslop skill is available. |

Cursor cloud agents and Automations are not provided by this adapter. Skip steps that specifically need them (including a Bugbot setup or trigger); existing GitHub checks and review threads can still be inspected. Full unattended playbooks are not validated by this mapping.
