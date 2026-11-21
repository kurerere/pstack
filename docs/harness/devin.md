# pstack in Devin

pstack skills use Cursor names. In Devin, read this file once per session, then map each Cursor name in a skill with the tables below. `<pstack>` means the folder that holds `skills/` and `docs/`. A plugin install (`devin plugins install`) ships both; a per-skill install (npx skills, magpie, hand-copy) ships only `skills/<name>/`, so this file may be absent — in that case the Devin line in `skills/poteto-mode/SKILL.md` carries the essential mappings and you go on without this file. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

## Tools

| Cursor | Devin |
| --- | --- |
| `Task` | `run_subagent` |
| Collect a background worker's result | `read_subagent` with `block: true`. |
| `AskQuestion` | `ask_user_question` when the session offers it. Otherwise ask in chat with numbered options. |
| Open a todolist, or copy steps into the todolist tool | `todo_write` when the session offers it. Otherwise keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | `Read` `<pstack>/skills/<name>/SKILL.md` and follow it. The `skill` tool refuses user-only skills, which covers most of pstack. When you tell the user to type it, write `/<name>` — or `/pstack:<name>` under plugin install. |

## Subagent fields

| Cursor | Devin |
| --- | --- |
| `subagent_type: generalPurpose` | `profile: "subagent_general"` |
| `poteto-agent` | Not registered by default. Spawn `subagent_general` whose prompt opens with "Read <absolute path to skills/poteto-mode/SKILL.md> in full, including its Principles section, before any work." If a plugin profile named `poteto-agent` exists in the session, use it instead. |
| `comment-sicko` | Same, with the full `skills/no-comments/references/comment-sicko.md` prompt in the brief. |
| The `model:` line in `poteto-agent`'s file | Drop it. `run_subagent` takes no `model` field. |
| `readonly: true` | `profile: "subagent_explore"`. It cannot edit, so the brief asks only for read work. |
| `readonly: false` | `subagent_general`. |
| `environment: "cloud"` | A local Devin session cannot start cloud workers. Run the worker locally with `is_background: true`; give simultaneous writers separate worktrees or non-overlapping output paths. |
| `environment: "local"` | Omit. |
| `cloud_base_branch: <b>` | Name the branch in the brief and tell the worker to check it out first. |
| `run_in_background: true` | `is_background: true`. Spawn all workers in one message. A foreground call blocks you, and only one runs at a time, so fan-out requires background. |
| `resume` | `resume: <agent_id>` only when the work needs state inside that agent. Otherwise spawn a fresh agent with the original brief plus the prior report, per poteto-mode. |
| `file_attachments` | List the paths in the brief. |

## Models

| Cursor | Devin |
| --- | --- |
| A `claude-*`, `gemini-*`, or other slug on a `model:` field | `run_subagent` has no `model` parameter, so drop it. `subagent_general` runs on the parent's model; `subagent_explore` and custom profiles use the model pinned in Devin's settings. Never pass a Cursor slug. |
| `auto` or `inherit-parent` | Omit `model`. This is already how `subagent_general` runs. |
| The `pstack-models` settings file | Devin reads no such file. Per-role model lines have no effect; a rule that pins `inherit-parent` is the equivalent. |
| Diverse-vendor panels (`arena`, `interrogate`) | Seats still run as independent workers, but every seat shares the parent model. No cross-vendor panel or judge is possible; say the panel ran on one model and skip any verdict that needs a second vendor. |

## setup-pstack

Devin selects subagent models by profile, not per call, so `/setup-pstack` cannot write effective per-role settings. State that limitation and write nothing unless the user asks for the file for another harness.

## Paths

| Cursor | Devin |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | Project `.devin/skills/` or `.agents/skills/`; user `~/.config/devin/skills/` or `~/.agents/skills/` (on Windows, the user directory is `%APPDATA%\devin\skills\`). |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Devin's plugin cache (`devin plugins install`), manifest `.devin-plugin/plugin.json`. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<pstack>/<path>` when that file exists. Read the local copy and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | No documented per-workspace transcript path. Skip a step that needs one and say so. |

## Cursor-only features

Devin has no Cursor Automations, Bugbot, Cursor cloud agents, registered `poteto-agent`/`comment-sicko` profiles in the default install, or `/loop`. When a step needs one, put one line in your reply, `Skipped in Devin: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, leave a placeholder and name it in the line.

| Cursor | Devin |
| --- | --- |
| Cursor Automations: routines, `update_state` routine calls, routine wakes | Skip with the line. |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads, so triage them with `gh`. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agents | Run the worker locally as in Subagent fields. Skip a step that needs the cloud agent itself, such as its dashboard status. |
| `/loop` | Wait between checks with a timed shell command. |
| Devin cloud sessions | Plugin-bundled subagents do not load there. Use `subagent_general` with the `poteto-agent` preamble above. |
