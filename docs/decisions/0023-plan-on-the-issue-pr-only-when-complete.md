# 0023 · The plan lives on the issue; a PR arrives only when complete

**Status:** accepted · 2026-11-03 · supersedes the plan line of [ADR 0002](0002-state-lives-in-the-repo.md)

## Context
How an idea becomes an issue, a plan, a PR and something in production wasn't written down. Each session improvised. In the 2026-11-02 issue sweep, agents opened PRs with partial solutions, the `needs:elia` label and "Elia's steps" in the description. Elia had to review a PR that wasn't finished and also act on its instructions.

Elia decided four rules on [Define the work flow](https://github.com/ferrarolabs/agent-kit/issues/137), for every unit of work: issue, bug, feature, epic.

## Decision
1. **Plan first, on the issue.** Before any code, the agent comments on the issue with its plan to finish it.
2. **Changes to the plan, on the issue.** When the work departs from the plan, the agent comments what changed and why.
3. **Blocked → a comment on the issue, not a PR.** The comment says the problem and exactly what the owner has to do. The agent marks the issue as waiting on the owner (`needs:elia` today, Stage `Asking` once it exists, [ADR 0022](0022-issue-structure-types-and-fields.md)). It does not open a PR with a partial solution and instructions.
4. **A PR only at the end, complete.** The PR arrives when the issue's "Done when" is met, so the owner only has to review it. No owner's steps in a PR description.

The whole flow, and what holds for the steps still open, is in [guides/work-flow.md](../guides/work-flow.md).

## Supersedes
- **ADR 0002, "plan (`docs/plans/`) … are committed files"**: the plan is a comment on the issue. The issue survives a session just as a file does, and the owner already reads there. Spec, progress and decisions are unchanged.
- **PLAN §4, the Planner's output**, and **§5, the flow of a feature**: updated in the same PR.

## Alternatives rejected
- **The plan as `docs/plans/<issue>.md`** (ADR 0002). It needs a commit and a branch before any code, so the owner can only read it in a PR, which rule 4 keeps for complete work. A comment is read where the issue is.
- **A draft PR for partial work.** It still asks the owner to look at unfinished code, and it spreads one issue's state over two places.
- **Questions in the PR** (the old "ask in the PR and stop"). A question with no complete PR has nowhere to go; the issue always exists.

## Consequences
- An issue says whose turn it is; a PR always means "ready to review". Once Stage exists, `Asking` never has a PR and `In validation` always has one ([issue structure §3](../issue-structure.md#stage-in-detail)).
- Rules 1–4 go in `account/CLAUDE.md` for every session, and in each repo's "Working as an agent". This repo's line "ask in the PR and stop" now reads "ask on the issue".
- jamly gets its lines in its own PR ([Put the work-flow rules in jamly's "Working as an agent"](https://github.com/ferrarolabs/agent-kit/issues/148)); the template follows that port (ADR 0014).
- How a plan is *approved* stays open ([Plan before code](https://github.com/ferrarolabs/agent-kit/issues/114)). Until then, the agent posts the plan and starts; the owner stops it by answering on the issue.
- An issue's comments grow with the plan and its changes. That is the record the next session reads.
