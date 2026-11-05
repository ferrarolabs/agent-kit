# The work flow, from an idea to a PR

How an idea in the owner's head becomes an issue, a plan, code and a PR the owner can merge. It holds for every unit of work: Feature, Task, Bug, Epic, Decision. Elia defined it on [Define the work flow](https://github.com/ferrarolabs/agent-kit/issues/137); the decisions are in [ADR 0023](../decisions/0023-the-work-flow-from-an-idea-to-a-pr.md).

## 1. The flow at a glance

```text
 OWNER                          AGENT
 idea ──▶ spec skill: questions, one at a time ──▶ issue body (goal, FR, NFR, Done when)
 Stage: Ready ─────────────────▶ draft plan
                                 refuters in parallel, one per area ──▶ final plan
                                 review level: green / yellow / red
 ◀───────────────────────────── plan comment, Stage: Asking
 verdict comment, Stage: Ready ─▶ go → implement            change → new plan, Asking again
                                 tests: every FR, NFR, Done when
                                 e2e as a real user
                                 PR from the template
                                 independent agent re-checks the review level
 ◀───────────────────────────── Stage: In validation
 review as the level says, merge
```

The owner acts four times: describe the idea and answer the questions, mark it ready, give the plan verdict, review and merge. Everything else is the agent's. No agent approves or merges ([ADR 0003](../decisions/0003-agents-propose-i-decide.md)).

## 2. Step by step

### 2.1 Idea → issue: the spec skill
The owner calls the spec skill and describes the idea roughly. It will have gaps and cases not thought of. That is expected.

The agent then asks questions, **one at a time**, until nothing material is open. They have two goals:

1. **Take the idea apart.** Most features users ask for are not the ones they need. Ask about the problem behind the request, who has it, what happens today without the feature, what would make it not worth building. Questions may be uncomfortable; that is their job.
2. **Leave no room for interpretation.** Every case the agent would otherwise guess is asked instead: edge cases, errors, who sees what, what is out.

The output is the **issue body**, and everything below lives in it:

| Section | What it says | Rule |
|---|---|---|
| **Problem** | What hurts today, for whom. No solution here | Separate from the goal, so the goal can be challenged |
| **Goal** | The outcome the agent must reach | One paragraph. A reader, human or agent, knows at once what is asked |
| **Functional requirements** | What it must do | Each one testable, written as *Given / When / Then*, each with how it is verified |
| **Non-functional requirements** | How well: performance, security, accessibility, cost | Each one measurable: a number, not "fast" |
| **Out of scope** | What it will not do | Explicit, so nobody adds it |
| **Done when** | Anything not already covered by the requirements: tests passing, a configuration in place, a dependency unblocked | Each line checkable |

Before the issue is saved, a second agent reads **only the body**, without the conversation, and lists anything it could read two ways. Each one becomes a question to the owner. This *cold read* is the test that nobody can misunderstand it.

If the work needs more than one PR, the skill makes it an Epic with sub-issues ([§4](#4-epics)). The skill sets Priority ([ADR 0018](../decisions/0018-agents-set-the-priority-of-the-issues-they-open.md)) and Effort. Stage stays `Inbox`.

After `Ready`, the body is frozen: only the owner changes it.

### 2.2 Ready → the plan
The owner sets Stage `Ready`. An agent takes the issue, sets `Working`, reads the body and drafts the technical plan.

Then **refuters**, agents in parallel on a clean context, one per area, try to break the draft:

| Area | Looks for |
|---|---|
| User design | Flows that confuse, states not designed (empty, error, loading), accessibility |
| Code quality | Wrong layer, duplication, a design that won't survive the next feature |
| Performance | Work that grows with data, network round trips, startup cost |
| Security | Data exposed, trust in the client, secrets, the lethal trifecta ([threat model](../threat-model.md)) |
| Scalability and cost | What breaks at ten times the users, usage and hosting cost |
| Tests | Requirements with no test, tests that can't fail |

Each project may add areas (for example offline use on a mobile app). Rules:

- An objection needs **evidence**: a file, a requirement, a scenario. Opinion alone is dismissed.
- The planner answers **every** objection: *fixed* (and how) or *dismissed* (and why).
- At most **two rounds**. What is still open after that goes to the owner in the plan comment.

### 2.3 The review level
A **third agent**, which neither planned nor refuted, sets the issue field **Review level**:

| Value | The owner, to merge |
|---|---|
| `green` | Approves and merges **without reading anything**. The agent still never merges |
| `yellow` | Reads only the PR description |
| `red` | Reviews the code carefully |

There is a floor the agent can't go under, set by the files the plan touches: harness, CI, deny rules, `settings.json`, auth, migrations and user data are always `red`. The check in [§2.7](#27-the-pr) enforces it ([Protect the grader](https://github.com/ferrarolabs/agent-kit/issues/61)).

### 2.4 The plan verdict
The agent posts the **final plan** as a comment on the issue:

- the plan, step by step;
- the table of objections with their outcome, dismissed ones first: those are the ones the owner should read;
- the review level and why;
- anything still open.

It sets Stage `Asking` and stops.

The owner comments the verdict, whatever it is: go, or change this and that. Then he **always sets `Ready` again**. That is the signal to resume. The agent reads the last comment:

- **Go** → it implements.
- **Change** → it changes the plan, posts it again, and sets `Asking` again.

### 2.5 Implementation and tests
The agent implements, with sub-agents in parallel where the work splits into areas that don't touch the same files. Still one branch and one PR per issue.

Tests are written from the requirements, not from the code ([PLAN §4](../PLAN.md#4-agent-roles)). Before going on, every FR, NFR and Done when line is validated, each with its evidence.

**Changes and blocks go on the issue.** A departure from the approved plan is a comment, and the work goes on. A departure that changes an FR, an NFR or raises the review level goes back to the owner: comment, `Asking`, stop. A block that only the owner can lift is the same ([ADR 0010](../decisions/0010-agents-recover-before-they-escalate.md) first: recover before you escalate). Never a partial PR.

### 2.6 E2E as a real user
Last, an agent uses the result as a real user would ([Before the PR, the agent uses the feature](https://github.com/ferrarolabs/agent-kit/issues/92)). It plays the stakeholder: does it solve the **original problem**? Is it right functionally, non-functionally, in design, in its real environment?

That agent reads **only the issue body**, not the plan or the code, so it judges against what the owner asked, not against what was built. It says what it could not check from a cloud session (real devices, real accounts, production): that list goes in the PR for the owner.

### 2.7 The PR
Only when §2.5 and §2.6 are all met, the agent opens the PR from the repo's PR template:

- what was done, in a few lines, and the core of the issue;
- the requirements table: each FR, NFR and Done when, its test, its result;
- what the owner should look at, for the review level;
- what only the owner can check;
- the learn note ([ADR 0013](../decisions/0013-every-feature-pr-ships-a-learn-note.md)).

An **independent agent**, on a clean context, re-assesses the review level against what was really built. It confirms it or changes it, and says why.

The level appears on the PR as a **check run** named `Review level`: a line in the PR's *Checks* list, with the value and the reason. The check also fails when the level is under the floor set by the files touched. One day a ruleset can require it, for auto-merge.

The agent follows the PR to the end ([ADR 0012](../decisions/0012-agents-own-their-pr-to-the-end.md)) and sets Stage `In validation`.

### 2.8 Review and merge
The flow stops here. The owner reviews as the level says and merges through the merge queue ([ADR 0015](../decisions/0015-merge-through-a-merge-queue.md)). Promoting `dev` → `staging` → `main` and releasing to production are the owner's; no agent deploys to production ([PLAN §10](../PLAN.md#10-out-of-scope-for-now)).

## 3. Proportionality
The full flow costs usage ([PLAN §9](../PLAN.md#9-cost-and-limits)). A small, safe issue doesn't need all of it.

| Issue | Refuters | E2E | Questions |
|---|---|---|---|
| Effort `S` and Review level `green` | none: the planner reviews its own draft against the areas table | by the implementing agent, no separate agent | as many as needed |
| Anything else | every area | a separate agent | as many as needed |

The plan verdict and the PR are never skipped.

## 4. Epics
An issue becomes an Epic when it needs more than one PR, or its Effort would be `L` ([issue structure §3](../issue-structure.md#effort-in-detail)). Each sub-issue goes through the whole flow on its own. Order between them is "blocked by" ([issue structure §1](../issue-structure.md#1-rules-of-thumb)).

## 5. Until the pieces exist
The flow is decided; some of its tools are not built yet. They are the sub-issues of [Build the work flow, from an idea to a PR](https://github.com/ferrarolabs/agent-kit/issues/150). Until each exists, this holds:

| Piece | Until it exists |
|---|---|
| Spec skill | The owner writes the issue from the form; the agent asks its questions on the issue before planning |
| Refuters | The planning agent starts them itself, with the Agent tool, one per area |
| Review-level check | The independent agent's verdict is a line in the PR description |
| PR template | The PR follows [§2.7](#27-the-pr) |
