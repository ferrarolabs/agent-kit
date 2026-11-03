# 0023 · The work flow, from an idea to a PR

**Status:** accepted · 2026-11-03 · supersedes the plan line of [ADR 0002](0002-state-lives-in-the-repo.md); adds a field to [ADR 0022](0022-issue-structure-types-and-fields.md)

## Context
How an idea becomes an issue, a plan, a PR and something in production wasn't written down. Each session improvised. In the 2026-11-02 issue sweep, agents opened PRs with partial solutions, the `needs:elia` label and "Elia's steps" in the description. Elia had to review a PR that wasn't finished and also act on its instructions.

Elia first set four rules, then defined the whole flow and decided its open points, on [Define the work flow](https://github.com/ferrarolabs/agent-kit/issues/137) (2026-11-02 and 2026-11-03). The flow is in [guides/work-flow.md](../guides/work-flow.md).

## Decision
1. **A spec skill turns an idea into a complete issue.** It asks the owner questions one at a time, to challenge whether the request is what he needs and to leave no room for interpretation. The issue body holds the problem, the goal, functional and non-functional requirements, out of scope, and Done when. A cold read by a second agent tests it.
2. **The plan lives on the issue.** The agent drafts it, refuters in parallel (one per area) try to break it, and every objection is fixed or dismissed with a reason. The final plan is a comment on the issue.
3. **Plan approval is a Stage loop, with no new value.** The agent posts the plan and sets `Asking`. The owner comments a verdict and always sets `Ready` again. The agent reads the comment: it proceeds, or it changes the plan and sets `Asking` again. This answers [Plan before code](https://github.com/ferrarolabs/agent-kit/issues/114).
4. **A review level, set before and checked after.** A sixth issue field, **Review level**: `green` (the owner approves and merges without reading), `yellow` (he reads the PR description), `red` (he reviews the code). A third agent sets it on the plan; an independent agent re-assesses it on the PR. On the PR it is a check run named `Review level`, which also fails under a floor set by the files touched. This settles the levels of [Three review levels](https://github.com/ferrarolabs/agent-kit/issues/98).
5. **Green never means the agent merges.** It means the owner can merge without reading. [Principle 7](../PLAN.md#2-principles) is unchanged.
6. **Changes and blocks go on the issue, never in a partial PR.** A change of plan is a comment. A change to a requirement or a higher review level, or a block only the owner can lift, is a comment plus `Asking`.
7. **A PR only when complete.** Every FR, NFR and Done when is validated, and an agent has used the result as a real user, reading only the issue body. Then the PR, from a template. No owner's steps in it.
8. **Proportionality.** Effort `S` with Review level `green` skips the refuters and the separate e2e agent. The plan verdict and the PR are never skipped.

## Supersedes
- **ADR 0002, "plan (`docs/plans/`) … are committed files"**: the plan is a comment on the issue. Spec, progress and decisions are unchanged.
- **ADR 0022, "Five org issue fields"**: six, with Review level. And `Asking` covers waiting for a plan verdict, which is a decision only the owner can take.

## Alternatives rejected
- **The plan as `docs/plans/<issue>.md`** (ADR 0002). The owner could read it only in a PR, which is for complete work.
- **A Stage value for plan review.** Elia: two values are enough. `Ready` means "you may take the next step"; the comment says which.
- **The review level as a PR label.** A label can't fail. A check run can, when the level is under the floor, and a ruleset can require it later.
- **Green as auto-merge.** It would change principle 7. Auto-merge, if it comes, is its own ADR.
- **The full flow on every issue.** It costs usage on a typo as on a feature (PLAN §9).
- **A draft PR for partial work, or questions in the PR.** They make the owner look at unfinished code, and a question without a complete PR has nowhere to go.

## Consequences
- An issue says whose turn it is; a PR always means "ready to review".
- The rules go in `account/CLAUDE.md` and each repo's "Working as an agent". jamly gets them in its own PR ([Put the work-flow rules in jamly's "Working as an agent"](https://github.com/ferrarolabs/agent-kit/issues/148)); the template follows that port (ADR 0014).
- Review level is added to [Create the issue types and fields](https://github.com/ferrarolabs/agent-kit/issues/143).
- The pieces not yet built are the sub-issues of [Build the work flow, from an idea to a PR](https://github.com/ferrarolabs/agent-kit/issues/150). Until each exists, [guide §5](../guides/work-flow.md#5-until-the-pieces-exist) says what holds.
- More agents per issue means more usage per issue. Proportionality keeps it for the issues that need it.
