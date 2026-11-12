# 0025 · Cut unrequested tools at project level, then at the account

**Status:** accepted · 2026-11-12 · from [Count active tools, skills and MCP servers](https://github.com/ferrarolabs/agent-kit/issues/57)

## Context
Every session loads the account's skills and claude.ai connectors, whatever the repo. On 2026-11-12 an agent-kit cloud session listed 36 skills, 14 of them from the account, most not for development. It also had the `Claude_Docs` connector, which writes documents outside the repo.

Account skills and connectors are claude.ai settings. No agent can reach them. Waiting for that left the cost in place for ten days.

Claude Code has two project-level levers. `skillOverrides` hides a skill (`off`) or its description (`name-only`). A deny rule on `mcp__<server>` removes the server's tools.

## Decision
- agent-kit's `.claude/settings.json` turns off the skills nobody asked for and denies `mcp__Claude_Docs`. The list and the reasons are in [tools.md](../tools.md).
- Skills the host's own tools point at stay `name-only`, not `off`.
- An agent may cut a tool at project level in a PR, with the before/after count. Adding or enabling one still goes through an issue ([Adding a tool](../guides/adding-a-tool.md)).
- The account-level cut stays Elia's, and is the real fix.

## Consequences
- An agent-kit session starts about 3,900 tokens lighter, about 10%.
- The cut holds only where project settings load: a session opened in the repo root. Multi-repo sessions, local sessions and jamly still load everything until the account is cut.
- A skill turned off here can't be called here either. Turning it back on is a one-line PR.
- Skill names change with the host. A re-count at the end of each phase catches new ones.
