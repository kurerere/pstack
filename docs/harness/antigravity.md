# pstack in Antigravity

pstack skills use Cursor names. In Antigravity, read this file once per session, then map each Cursor name in a skill with the tables below. `<pstack>` means the folder that holds `skills/` and `docs/`; per-skill installs ship only `skills/<name>/`, so this file may be absent — in that case the Antigravity line in `skills/poteto-mode/SKILL.md` carries the essentials. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

Run pstack skills in the default Antigravity conversation (`agy acp` without `--agent` for ACP). Google bills conversations run by custom agents, including plugin agents and their subagents, at a higher quota rate. Selecting `model: inherit` controls the model only. [Antigravity maintainer’s explanation](https://github.com/google-antigravity/antigravity-cli/issues/1890#issuecomment-7228660501)

## Tools

| Cursor | Antigravity |
| --- | --- |
| `Task` | `invoke_subagent` |
| Collect a worker's result | Subagents are asynchronous: they send their result back as a message when done. You can also message an idle subagent to re-awaken it — it keeps its prior context, so `resume` maps to messaging, not a new spawn. |
| `AskQuestion` | Antigravity's structured-question tool when the session offers it; otherwise ask in chat with numbered options. |
| Open a todolist, or copy steps into the todolist tool | The task-list tool when the session offers it. Otherwise keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | Every installed skill is in the catalog by name and description, so load it through the skill mechanism when it is listed; otherwise `Read` `<pstack>/skills/<name>/SKILL.md` and follow it. Skills are discovered from `.agents/skills/` (project) and `~/.gemini/config/skills/` (global). |
| `/swarm` typed by the user | Antigravity's built-in `/swarm` orchestrator — a different feature that shares the name. Inside a pstack flow, "the **swarm** skill" means the pstack skill; only mention the built-in when offering it as an alternative. |

## Subagent fields

Apply this mapping even when a routed skill names a registered plugin agent. Delegate only when the user requests workers. Otherwise, or if the required built-in is unavailable with model inheritance, do the step in the parent. For a panel, report how many independent seats actually ran.

| Cursor | Antigravity |
| --- | --- |
| `subagent_type: generalPurpose` | Use the built-in `self` for work that needs write access and `research` for read-only exploration. |
| `poteto-agent` | Give the appropriate built-in the usual `worker.md` kickoff, then the absolute path to `skills/poteto-mode/SKILL.md` to read in full, including Principles, before doing the task. |
| `comment-sicko` | Use `self` for the scoped comment edits. Pass the verbatim `skills/no-comments/references/comment-sicko.md` prompt and the scope. |
| `readonly: true` | Use the built-in `research` agent. |
| `readonly: false` | Use the built-in `self` agent. |
| `environment: "cloud"` | No remote cloud workers. Use workspace option `branch` for an isolated Git worktree, `share` for shared directory storage. |
| `environment: "local"` | Workspace option `inherit` — same workspace as the parent. |
| `cloud_base_branch: <b>` | With `branch`, name the base branch or commit in the brief. |
| `run_in_background: true` | Omit. `invoke_subagent` is already asynchronous; invoke all workers and they run concurrently. |
| `resume` | Message the idle subagent — it re-awakens with its context retained. |
| `file_attachments` | List the paths in the brief. |
| Nesting | Depth is capped at 10 levels; pstack never nests that deep, so treat the cap as unreachable. |

## Models

| Cursor | Antigravity |
| --- | --- |
| A `claude-*`, `gemini-*`, or other slug on a `model:` field | Use `model: "inherit"` for pstack roles. |
| `auto` or `inherit-parent` | `model: "inherit"` — the default — so the worker runs on the parent's model. |
| The `pstack-models` settings file | No equivalent file is loaded. Per-role lines have no effect; a rule pinning `inherit` is the equivalent. |
| Diverse-vendor panels (`arena`, `interrogate`) | Keep the requested seat count (three by default) on the inherited model when delegating. Skip the cross-vendor judge and report the panel as single-model. |

## setup-pstack

In Antigravity, `/setup-pstack` explains that workers inherit the model selected in the parent conversation. Finish setup there without writing per-role settings.

## Paths

| Cursor | Antigravity |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | Project `.agents/skills/` (legacy `.agent/skills/` also read); global `~/.gemini/config/skills/` (on Windows, `C:\Users\<you>\.gemini\config\skills\`). |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Antigravity plugins under `plugins/<name>/` — bundled `agents/`, `skills/` are discovered from the plugin package. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<pstack>/<path>` when that file exists. Read the local copy and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | `~/.gemini/antigravity/conversations/` and subagent JSONL logs under the Antigravity state directory. Read only the active workspace's sessions. |

## Cursor-only features

Antigravity has no Cursor Automations, Bugbot, or Cursor cloud agents. When a step needs one, put one line in your reply, `Skipped in Antigravity: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, leave a placeholder and name it in the line.

| Cursor | Antigravity |
| --- | --- |
| Cursor Automations: routines, `update_state` routine calls, routine wakes | Skip with the line. Scheduled work can also use Antigravity's `/schedule` when the user asks for it. |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads; triage them with `gh`. Skip a step that waits for or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agents | `invoke_subagent` with workspace `branch` covers the isolated-worker case. Skip anything that needs the cloud agent itself. |
| `/loop` | Antigravity's `/schedule` or a timed wait between checks. |
| `deslop`, `control-cli`, `control-ui` (cursor-team-kit) | Not bundled. Follow the fallbacks in poteto-mode; Antigravity's built-in `browser` subagent covers UI driving. |
