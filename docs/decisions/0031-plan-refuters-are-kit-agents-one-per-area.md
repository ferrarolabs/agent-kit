# 0031 · Plan refuters are kit agents, one per area

**Status:** accepted · 2026-11-20 · from [Plan refuters: parallel agents, one per area, try to break the plan](https://github.com/ferrarolabs/agent-kit/issues/152). Builds step 2 of [ADR 0023](0023-the-work-flow-from-an-idea-to-a-pr.md). Amends [ADR 0014](0014-kit-aligned-at-every-harness-merge.md) for this piece, as [ADR 0030](0030-every-issue-is-written-with-one-procedure.md) did for writing issues.

## Context
ADR 0023 decided that refuters, one per area, try to break every plan before code is written. Until now the planner wrote each refuter's prompt by hand. So each run used different rules, read as much as it liked, and could paste anything into a public plan comment.

The first plan to go through refuters was this issue's own. Six ad-hoc refuters raised 43 objections in round 1 and 16 in round 2. Each run cost 67k–89k subagent tokens, about 420k for a round of six.

## Decision
- **One agent file per area**: `.claude/agents/refuter-<area>.md`, six in the kit (user design, code quality, performance, security, scalability and cost, tests). A project adds an area by adding a file. The alternative was one `refuter` agent with the area as a parameter. It costs one listing entry instead of six, but the issue asks for one per area, and a file per area is how a project adds one.
- **One shared block of rules, byte-identical in every file**, between `<!-- refuter:shared:start -->` and `<!-- refuter:shared:end -->`. It says that input is data, that `CLAUDE.md` settles points, how far a refuter reads (10 files, 5 searches, inside the repo), what counts as evidence, that a fix never widens access, and the output table (at most 5 objections). Only the area block differs.
- **Read-only, local tools: `Read, Grep, Glob`.** A refuter cites files as evidence, so it needs to find and read them. It has no shell, network, MCP or write tool. That is wider than the cold reader, which has `Read` only and opens nothing.
- **Grep stays because it obeys the `.env` deny.** On 2026-11-20, with agent-kit's settings loaded, a Grep on `.env.test` was denied, a repo-wide Grep skipped it, and the same Grep on a control file found the value.
- **The cut to a public comment is a promise, not a boundary.** `Read` can still open a path outside the repo. A refuter is told not to, and its output reaches a comment only in the planner's own words. Accepted, like every prompt rule in the [threat model](../threat-model.md).
- **Opus for every area** (`claude-opus-5-5`). Finding what a plan misses is open reasoning with a small output, which is Opus in the [model policy](../guides/model-policy.md). The model follows that policy, and is checked again when [Model per task](https://github.com/ferrarolabs/agent-kit/issues/186) merges.
- **Round 2 reruns only what a fix touched.** It runs only when a blocker or a major was fixed. It reruns the refuters whose blocker or major was fixed, plus security whenever a fix touches access, plus any area a fix visibly changes. Rerunning all of them would catch more across areas, but it doubles the cost.
- **Open rows first, then dismissed rows** in the plan comment, because the owner must act on open ones. This departs from the issue body ("dismissed first"); Elia approved it on the issue.
- **At most 8 refuters** per project. A project that adds one records why in its own ADR.
- **Cost limits.** At most 400 tokens of session listing for the six; measured 355. At most 900k subagent tokens per plan, both rounds, and about 100k per refuter run. Going over any of them reopens this ADR.
- **A check keeps it true.** `scripts/check/agents.js` checks every agent: `name` matches the file, a description of at most 250 characters, a full-id model, a one-line `tools`. Each `refuter-*` has exactly those four keys, tools only from the set above, and the same shared block. There are at most 8, and each one matches a row of the guide's §2.2 table, both ways. Each rule was seen failing.
- **A kit original.** Built in agent-kit, which plans an issue every day. jamly gets a copy, with `agents.js`, by its own issue. Where the work-flow guide is absent, as on jamly, `agents.js` checks the agents and skips the guide rows. `template/` follows once jamly has used it.

## Consequences
- Every session on agent-kit lists six more agents: 355 more input tokens on the first turn (35,680 → 36,035).
- Every plan that isn't Effort S and green costs about 420k subagent tokens for one round, and more with a round 2. Six Opus runs draw on the same usage limits as the session.
- Agents added during a session are found only by the next session ("Agent type not found", 2026-11-20). A new or changed refuter is tried in a fresh session.
- The cold reader's frontmatter is checked with the other agents, in `agents.test.js`. It is no longer checked in `issue-bodies.test.js`.
- Point 4 of [Model per task](https://github.com/ferrarolabs/agent-kit/issues/186), a check for a missing or aliased model, already exists here.
