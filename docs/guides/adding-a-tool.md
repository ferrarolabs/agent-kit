# Adding a tool

**Rule:** a tool is added only on purpose, and its approvals are decided when it is installed. Never later, and never by the agent that wants to use it.

A *tool* here is anything that puts new actions or new text in front of the model: an MCP server, a claude.ai connector, a plugin, or a skill.

## Why
- **Each tool is a security decision.** It can reach data, read untrusted text, or send data out: the three legs of the [threat model](https://github.com/ferrarolabs/agent-kit/issues/58). One more tool can close the triangle.
- **Each tool costs context on every run.** A skill's description loads in every session, whether it is used or not. On 2026-11-02, the 14 account skills synced into a cloud session carried about 9,800 characters of descriptions (roughly 2,400 tokens) before any work started. Most of them were not for development.
- **A default is not a decision.** A tool that arrived because it was on by default, or because a session found it useful once, has no owner and no approval set.

## When you add one
Open an issue first (one tool, one issue). It answers five questions:

1. **What for.** The task that needs it, and why an existing tool can't do it.
2. **Where it loads.** Account (every session, every repo), or one project's `.claude/settings.json`. Prefer the narrowest level.
3. **What it reaches.** Private data it can read, untrusted text it brings in, and any way it sends data out. Say which threat-model leg it adds.
4. **Approvals, decided now.** For each of its tools: `allow`, `ask` or `deny`, written in the settings file in the same PR. Read-only tools may be allowed. Tools that write, post or send are `ask` or `deny` until a PR proves they are needed. An MCP server's tools are named `mcp__<server>__<tool>` in permission rules.
5. **Context cost.** The size of its description, or the change in `/context` before and after.

A tool that writes outside the repo (posts, deploys, sends mail) also gets a probe case, like the push deny rules ([scripts/probe/](../../scripts/probe/README.md)).

## Removing one
- Remove a tool nobody asked for, and one unused for a whole phase.
- Re-count at the end of every phase, with the [harness matrix](https://github.com/ferrarolabs/agent-kit/issues/56).

## Who does what
- **Agents** never install or enable a tool on their own. When a task needs one, they open the issue above and stop.
- **Elia** enables or disables account connectors, account skills and plugins: only he can reach those settings.
