# Tools: what loads, and what was cut

Every MCP server, connector, plugin and skill that loads in an agent-kit session, at what level, and whether it is kept. The rule for adding one is in [Adding a tool](guides/adding-a-tool.md).

Counted on 2026-11-12, in a cloud session on agent-kit, from [Count active tools, skills and MCP servers](https://github.com/ferrarolabs/agent-kit/issues/57). **Re-count at the end of every phase.**

## How it was measured
A headless session started in the repo root reports what it loaded in its `init` event, and its first turn reports the input tokens:

```bash
claude -p "Reply with OK." --output-format stream-json --verbose --max-turns 1 </dev/null
```

Read `skills`, `mcp_servers` and `plugins` from the `system`/`init` event. Add `input_tokens`, `cache_creation_input_tokens` and `cache_read_input_tokens` from the `result` event. Two runs before the cut gave 37,897 and 37,901 tokens, so the noise is a few tokens.

A headless session gets no MCP servers from the cloud host. Those were read from the main session.

## The saving

| | Skills listed | Input tokens, first turn |
|---|---|---|
| Before | 36 | 37,899 (average of two runs) |
| After | 21 | 34,038 |
| **Saved** | **15** | **3,861 per session, about 10%** |

## MCP servers and connectors (main session)

| Server | Comes from | For development? | Decision |
|---|---|---|---|
| `github` | Cloud host | Yes | Keep |
| `claude-code-remote` | Cloud host | Yes: sessions, scheduled tasks, PR subscriptions | Keep |
| `Claude_Docs` | claude.ai account connector | No: the kit's documents are Markdown in the repo | **Denied** at project level with `mcp__Claude_Docs`. It also closes an exit: it writes documents outside the repo ([threat model](threat-model.md)). Its tools left the running session at once |
| `ccd_session` | Claude app (task suggestions) | Neutral | Keep: it only queues suggestions for the owner |

No property, hotel or travel connector loads in a cloud session. If they load locally, they are account connectors: only Elia can cut them.

## Plugins
Only the four built-in ones (`cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-privacy`, `cc-plugin-plugin-authoring`). No user or project plugin.

## Skills

`off` hides a skill from the model and from `/`. `name-only` keeps its name and drops its description, so it can still be found and called.

| Skill | Level | Decision | Why |
|---|---|---|---|
| `anthropic-skills:morning` | account | off | Personal brief |
| `anthropic-skills:import-memory` | account | off | Not development |
| `anthropic-skills:google-workspace` | account | off | Not development |
| `anthropic-skills:docs` | account | off | Goes with the `Claude_Docs` connector |
| `anthropic-skills:docx` | account | off | Office files: not the kit's format |
| `anthropic-skills:pptx` | account | off | Same |
| `anthropic-skills:xlsx` | account | off | Same |
| `anthropic-skills:computer-use` | account | off | Desktop control: not in a cloud session |
| `anthropic-skills:chrome-browser` | account | off | Same |
| `anthropic-skills:built-in-browser` | account | off | Same |
| `anthropic-skills:artifact-emulator` | account | off | Artifacts are not the kit's output |
| `anthropic-skills:deep-research` | account | off | Duplicate of the bundled `deep-research` |
| `design`, `design-sync`, `slides` | bundled | off | Visual design and decks |
| `artifact-capabilities`, `artifact-diagramming`, `dataviz` | bundled | name-only | The Artifact tool tells the model to load them; a name is enough to find them |
| `anthropic-skills:pdf` | account | keep | Reading PDFs a task brings |
| `anthropic-skills:skill-creator` | account | keep | The kit will write skills (Phase 4) |
| `session-start-hook`, `update-config`, `code-review`, `simplify`, `verify`, `debug`, `run`, `run-skill-generator`, `loop`, `batch`, `doctor`, `fewer-permission-prompts`, `claude-api`, `deep-research`, `plugin-authoring`, `workflow-authoring` | bundled | keep | Development |

## The account cut
The project cut works only in sessions that open in this repo's root ([guide](guides/open-sessions-from-the-repo-root.md)). A local session, a multi-repo cloud session, or jamly still load everything. Account skills and connectors are claude.ai settings, and only Elia can change them.

Settings → Personalizzazione → **Skills** lists only the skills added to the account, each with a **⋯** menu and no toggle:

| Skill | Done |
|---|---|
| `morning`, `import-memory`, `google-workspace` | **Deleted** by Elia, 2026-11-12 |
| `skill-creator`, `deep-research` | Kept: useful in chats too |

The other nine (`docx`, `pptx`, `xlsx`, `pdf`, `docs`, `computer-use`, `chrome-browser`, `built-in-browser`, `artifact-emulator`) are not on that page. They come with features: code execution, the Claude Docs connector, Claude in Chrome, computer use, Artifacts. Turning those off would also take them from chats, so they stay on at account level and are cut per project.

Still to do:

1. Settings → **Connettori**: turn off `Claude Docs` for Claude Code, and any travel or property connector.
2. In one local session, run `/context` and paste it on the issue.

## Local session (desktop app, Windows)
Elia ran `/context` on 2026-11-12, in the repo root, after the account skills and connectors were cut. The session listed its servers itself. No server came from a local config: `~/.claude.json` and the repo have none.

| | Local | Cloud |
|---|---|---|
| Total at start | 54.6k | 37.6k |
| MCP tools, always loaded | 14.1k | 645 |
| MCP tools, deferred | 48.9k | 1.5k |
| MCP servers / tools | 18 / 132 | 4 / 8 |

| Server | Tools | Source | Decision |
|---|---|---|---|
| Claude Docs (a UUID name) | 8 | claude.ai connector | **Cut on claude.ai.** Locally its name is a UUID, so the `mcp__Claude_Docs` rule doesn't match it |
| `claude-in-chrome` | 20 | Chrome extension, bridged by the app | Off in Settings → Claude in Chrome when not used |
| `mcp-registry` | 3 | Desktop app: connector search | Off with Settings → Funzionalità → *Ricerca connettori* |
| `visualize` | 2 | Desktop app: inline widgets | Off with *Visualizzazioni nella chat*, if not used |
| `Claude_Browser` | 19 | Desktop app: browser pane | Keep: previews of web work |
| `scheduled-tasks` | 6 | Desktop app | Keep |
| `terminal` | 5 | Desktop app | Keep |
| `ccd_*` (11 servers) | 68 | Desktop app: its own UI | Keep: the app needs them |

The local clone had no `.claude/settings.json` and a 403-token `CLAUDE.md`: it was behind `main`. A stale clone loads none of the project rules. Pull before working locally.

## Seen on the way
This session ran on the `Default` environment, not the `Agent-kit` one. It had no `~/.claude/settings.json` and no `~/.claude/CLAUDE.md`: the account layer ([ADR 0017](decisions/0017-account-deny-floor.md)) was not installed. The project rules still held: the probe passed 19 of 19.
