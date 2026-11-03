# The work flow, from an idea to production

How an idea becomes an issue, a plan, a PR, and then something in production. It holds for every unit of work: Feature, Task, Bug, Epic, Decision. The four rules in [§2](#2-the-four-rules) are decided ([ADR 0023](../decisions/0023-plan-on-the-issue-pr-only-when-complete.md)). The steps that are still open link their own issue and say what holds until then.

## 1. The flow at a glance

```text
idea ─▶ issue ─▶ Ready ─▶ plan comment ─▶ work ─▶ complete PR ─▶ review ─▶ merge ─▶ promote ─▶ production
         (owner)   (owner)    (agent)       (agent)   (agent)       (owner)   (owner)  (owner)    (owner)
                                 │            │
                                 │            ├─▶ change of plan → comment on the issue
                                 │            └─▶ blocked → comment on the issue, Asking, no PR
```

The owner acts at five points: write the issue, mark it ready, review, merge, promote. Everything between the plan and the PR is the agent's ([ADR 0003](../decisions/0003-agents-propose-i-decide.md)).

## 2. The four rules

These hold on every issue, decided by Elia on [Define the work flow](https://github.com/ferrarolabs/agent-kit/issues/137).

1. **Plan first, on the issue.** Before any code, the agent comments on the issue with its plan to finish it.
2. **Changes to the plan, on the issue.** When the work departs from the plan, the agent comments what changed and why.
3. **Blocked → a comment on the issue, not a PR.** The comment says the problem and exactly what the owner has to do for the issue to move on. The agent marks the issue as waiting on the owner. It does not open a PR with a partial solution and instructions.
4. **A PR only at the end, complete.** The PR arrives when the issue's "Done when" is met, so the owner only has to review it. No "owner's steps" in a PR description.

Why: in the 2026-11-02 sweep, agents opened PRs with partial solutions plus `needs:elia` and steps for Elia. He had to review unfinished work and act on its instructions at the same time. With these rules, an issue tells you whose turn it is, and a PR always means "ready to review".

## 3. Step by step

| # | Step | Who | Produces | Where it lives | Next step starts when |
|---|---|---|---|---|---|
| 1 | **Idea → issue** | Owner (later the spec writer, [account-level skills](https://github.com/ferrarolabs/agent-kit/issues/43)) | An issue from a form: why, what, "Done when" | The issue | The owner marks it ready |
| 2 | **Ready** | Owner | Stage `Ready` (today: label `agent:ready`), or the owner names it in a session | Issue field (today: label) | An agent picks it |
| 3 | **Plan** | Agent | A plan comment: what it will do, what it won't, what it found blocked | Issue comment | See [§4.1](#41-plan-approval) |
| 4 | **Work** | Agent | Commits on one branch; a comment for every change of plan | Branch; issue comments | "Done when" is met |
| 5 | **Blocked** (if it happens) | Agent | A comment: the problem, what was tried, the one action the owner must take. Stage `Asking` (today: `needs:elia`). No PR | Issue comment | The owner answers on the issue |
| 6 | **Complete PR** | Agent | One PR, green CI, learn note ([ADR 0013](../decisions/0013-every-feature-pr-ships-a-learn-note.md)), followed to the end ([ADR 0012](../decisions/0012-agents-own-their-pr-to-the-end.md)). Stage `In validation` (today: `needs:elia` on the PR, or `needs:device-check` in jamly) | The PR | The owner reviews |
| 7 | **Review** | Owner; agent fixes | Comments on the PR, fixed by the agent in the same PR | The PR | The owner approves |
| 8 | **Merge** | Owner | "Merge when ready" into the PR's base branch, through the merge queue on `main` ([ADR 0015](../decisions/0015-merge-through-a-merge-queue.md)) | The base branch | — |
| 9 | **Promote** | Owner | `dev` → `staging` → `main`, by PR, where a repo has the three branches | Long-lived branches | — |
| 10 | **Production** | Owner | A release or deploy | Outside the repo | — |

Notes on the steps:

- **Base branch.** This repo has only `main`: a PR goes there. A project made from the template opens its PR against `dev`, and promoting between `dev`, `staging` and `main` is the owner's ([template `CLAUDE.md`](../../template/CLAUDE.md.template)). Pushes to all three are denied to agents ([ADR 0017](../decisions/0017-account-deny-floor.md)).
- **Production is never an agent's.** No agent deploys to production ([PLAN §10](../PLAN.md#10-out-of-scope-for-now)). A project's irreversible commands (database pushes, deploys, store submissions) are denied; the agent writes the change as a file and the PR says it needs applying.
- **Whose turn is it?** Steps 3, 4 and 6 are the agent's work. Steps 5 and 6 hand the turn to the owner: `Asking` when the agent is stuck, `In validation` when the PR is complete. Stage says it in one field once it exists ([issue structure §3](../issue-structure.md#stage-in-detail)). Until the migration, the labels hold.
- **Recover before step 5.** A failure is not a block until the agent has read the real error, tried the alternatives and fixed what's reversible ([ADR 0010](../decisions/0010-agents-recover-before-they-escalate.md)).

## 4. Still open, and what holds until then

Each of these has its own issue. Until it is settled, the line under it holds.

### 4.1 Plan approval
[Plan before code: how an agent knows a plan is approved](https://github.com/ferrarolabs/agent-kit/issues/114).
Until then: the agent posts the plan and starts. The owner stops it by answering on the issue. A plan that needs a product decision is a block (rule 3): the agent asks on the issue and stops.

### 4.2 Requirements before the PR
[Issues state functional and non-functional requirements; the PR waits until every criterion is ticked](https://github.com/ferrarolabs/agent-kit/issues/93).
Until then: the issue's "Done when" is the list. The PR says how each line is met.

### 4.3 Using the feature before the PR
[Before the PR, the agent uses the feature as a user would](https://github.com/ferrarolabs/agent-kit/issues/92).
Until then: the agent runs what CI runs, and lists in the PR what only the owner can try (devices, real accounts, production).

### 4.4 Review levels and the review loop
[PRs come in three review levels](https://github.com/ferrarolabs/agent-kit/issues/98) and [Review loop](https://github.com/ferrarolabs/agent-kit/issues/95).
Until then: every PR is reviewed by the owner. A review comment is work for the agent now (ADR 0012).

## 5. Epics: when an issue becomes a parent

An issue becomes an Epic when it needs more than one PR, or its Effort would be `L` ([issue structure §3](../issue-structure.md#effort-in-detail)). Its work moves to sub-issues, each with one PR. An issue that needs the owner's approval is atomic: one question or one task, readable in under a minute (`CLAUDE.md`). The Epic is done when its sub-issues are.

Order between sub-issues is "blocked by", not a field ([issue structure §1](../issue-structure.md#1-rules-of-thumb)). A sub-issue blocked by one that waits on the owner is not started.

## 6. Where this replaces older text

- **The plan is a comment on the issue, not `docs/plans/<issue>.md`.** [ADR 0002](../decisions/0002-state-lives-in-the-repo.md) and the first version of PLAN §4–§5 put it in the repo. The issue is just as durable for the next session, and it is where the owner already reads ([ADR 0023](../decisions/0023-plan-on-the-issue-pr-only-when-complete.md)). Progress (`docs/progress.md`) and decisions (ADRs) stay in the repo.
- **"Ask in the PR"** in "Working as an agent" now reads "ask on the issue": rule 3 forbids a PR to ask.
