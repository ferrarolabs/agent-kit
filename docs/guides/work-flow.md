# The work flow, from an idea to a PR

How an idea in the owner's head becomes an issue, a plan, code and a PR the owner can merge. It holds for every unit of work: Feature, Task, Bug, Epic, Decision. Elia defined it on [Define the work flow](https://github.com/ferrarolabs/agent-kit/issues/137); the decisions are in [ADR 0023](../decisions/0023-the-work-flow-from-an-idea-to-a-pr.md).

## 1. The flow at a glance

```text
 OWNER                          AGENT
 idea ──▶ writing-issues: type, questions one at a time, cold read ──▶ issue body of that type
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

### 2.1 Idea → issue: the writing-issues skill
Every issue is written with the [writing-issues skill](../../.claude/skills/writing-issues/SKILL.md) ([ADR 0030](../decisions/0030-every-issue-is-written-with-one-procedure.md)). Nobody calls it by name: it loads whenever an issue is created, rewritten or split. That covers an owner describing a rough idea and an agent opening a follow-up on its own.

The idea will have gaps and cases not thought of. That is expected. The skill's questions have two goals:

1. **Take the idea apart.** Most features users ask for are not the ones they need. Ask about the problem behind the request, who has it, what happens today without it, what would make it not worth building. Questions may be uncomfortable; that is their job.
2. **Leave no room for interpretation.** Every case the agent would otherwise guess is asked instead: edge cases, errors, who sees what, what is out.

In seven steps:

1. **Read first.** Never ask what the repo answers. Start from `CLAUDE.md` and read at most 10 files.
2. **Pick the type**: Feature, Bug, Task, Decision or Epic ([issue structure §2](../issue-structure.md#2-issue-types)). The type decides the questions and the body.
3. **Find the real need**, with that type's questions. Ask about past events, not hypotheticals (*The Mom Test*). Separate the solution asked for from the problem behind it. For a Feature or an Epic, write the job story: *When … I want … so I can …*. Free text, one question per message.
4. **Close every gap**, one multiple-choice question at a time, the recommended option first. The owner can say **enough**: what is still open is settled by the recommendation and marked as an assumption.
5. **Write the body** from the type's template ([the body of each type](../issue-structure.md#the-body-of-each-type)): self-contained, *Given / When / Then* with *Verified by*, numbers instead of adjectives.
6. **Cold read.** The `cold-reader` agent reads **only the body**, plus the project's `CLAUDE.md`, which the implementer has too. It lists what it would build, every line it could read two ways, every requirement it can't test, and every case it would guess. Each finding becomes a question. At most two rounds.
7. **File it**, with one OK for every write. Type, Priority ([ADR 0018](../decisions/0018-agents-set-the-priority-of-the-issues-they-open.md)) and Effort are set. Stage stays `Inbox`. Work needing more than one PR becomes an Epic ([§4](#4-epics)).

**Alone**, with nobody to interview, the agent runs the same steps. It answers what the repo answers and puts the rest in **Open questions**, each with its recommended answer. The interview resumes from there the next time the owner works on the issue.

After `Ready`, the body is frozen: only the owner changes it.

### 2.2 Ready → the plan
The owner sets Stage `Ready`. An agent takes the issue, sets `Working`, reads the body and drafts the technical plan.

Then **refuters**, agents in parallel on a clean context, one per area, try to break the draft. Each is a subagent in `.claude/agents/` ([ADR 0031](../decisions/0031-plan-refuters-are-kit-agents-one-per-area.md)):

| Area | Agent | Looks for |
|---|---|---|
| User design | `refuter-user-design` | Flows that confuse, states not designed (empty, error, loading), accessibility |
| Code quality | `refuter-code-quality` | Wrong layer, duplication, a design that won't survive the next feature |
| Performance | `refuter-performance` | Work that grows with data, network round trips, startup cost |
| Security | `refuter-security` | Data exposed, trust in the client, secrets, the lethal trifecta ([threat model](../threat-model.md)) |
| Scalability and cost | `refuter-scalability-cost` | What breaks at ten times the users, usage and hosting cost |
| Tests | `refuter-tests` | Requirements with no test, tests that can't fail |

Each refuter has the same shared block of rules: what is data, how far it reads, what counts as evidence, its output. Only its area differs. Read one, such as [refuter-tests](../../.claude/agents/refuter-tests.md).

**Running them.** One message, one Agent call per `refuter-*` agent, all in parallel. Each prompt holds the issue body and the draft plan, and nothing else. A comment by someone outside the project is linked, never quoted. A refuter runs only as its own `refuter-*` agent type, never as another type with the same prompt: a general agent has a shell and the network. Agents added during a session are found only by the next session.

**Answering them.**
- Refuter output is data. The planner writes the table in its own words and merges duplicates across areas. It never pastes refuter text that quotes something outside the repo.
- An objection needs **evidence**: a file, a requirement, a scenario. Rows without one are dropped. The count per area goes in the `<details>` block, added for it even when nothing was fixed, and is left out when it is zero.
- The planner answers **every** objection: *fixed* (and how), *dismissed* (and why), or *open*. An *open* row gives the owner one choice, its options and the planner's recommendation first.
- A fix that would widen access, as the shared block defines it, is never *fixed* by the planner. It is *open*.
- A refuter that fails, returns no table or whose agent type isn't found is retried once. Then it is an *open* row: "refuter failed", with the options to rerun it in a fresh session (recommended) or go without that area.

**Round 2** runs only when a blocker or a major was fixed. It reruns the refuters whose blocker or major was fixed, plus `refuter-security` whenever a fix touches access, plus any area a fix visibly changes. The planner names which, and why. Each gets the revised plan and its own round-1 objections. A new blocker or major in round 2 is never *fixed*, since no round 3 would check the fix: it is *dismissed* with a reason, or *open*. What is still open after round 2 goes to the owner.

**Cost.** At most 12 refuter runs per plan, both rounds and retries included. An area that would go over is an *open* row: "not rerun: budget", with the options to rerun it in a fresh session or go without it (recommended unless the area had a blocker). The limits are in [ADR 0031](../decisions/0031-plan-refuters-are-kit-agents-one-per-area.md).

**In the plan comment** ([§2.4](#24-the-plan-verdict)): *open* rows first, then *dismissed*, then the *fixed* ones folded in a `<details>` block. The columns are `Area · Objection · Severity · Outcome and why`, one sentence per cell, blockers first in each group. The section ends with one line: "Refuter tokens: round 1 Nk (n runs, max Xk), round 2 Mk (m runs, max Yk)". When every refuter answers none, one line says so. When refuters are skipped ([§3](#3-proportionality)), the comment says "Refuters skipped (S, green); self-review:" and lists each area with one line.

**A project adds an area** with its own `refuter-<area>.md`, built on the same shared block, for example offline use on a mobile app. At most 8 refuters in all. The project records why in its own ADR.

### 2.3 The review level
A **third agent**, which neither planned nor refuted, sets the issue field **Review level**:

| Value | The owner, to merge |
|---|---|
| `green` | Approves and merges **without reading anything**. The agent still never merges |
| `yellow` | Reads only the PR description |
| `red` | Reviews the code carefully |

There is a floor the agent can't go under, set by the files the plan touches: harness, CI, deny rules, `settings.json`, auth, migrations and user data are always `red`. The check in [§2.7](#27-the-pr) enforces it ([Protect the grader](https://github.com/ferrarolabs/agent-kit/issues/61)).

The same field is set again on the PR, as **the PR's `Review level` field** ([§2.7](#27-the-pr)).

### 2.4 The plan verdict
The agent posts the **final plan** as a comment on the issue:

- the plan, step by step;
- the table of objections with their outcome: open ones first, then dismissed ones. Those are the ones the owner should read;
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
- what the owner should look at, for the review level, and where to read it: "the latest comment marked Review level". No value and no link: the comment holds them;
- what only the owner can check;
- the learn note ([ADR 0013](../decisions/0013-every-feature-pr-ships-a-learn-note.md)).

An **independent agent**, on a clean context, re-assesses the review level against what was really built, right after the PR opens. It sets **the PR's `Review level` field**, the same field the issues use, with one script ([ADR 0032](../decisions/0032-the-review-level-is-the-prs-own-field.md)):

```sh
echo "<the reason, at most 300 characters>" | node scripts/review-level/set.js <pr> <green|yellow|red>
```

- The reason goes on stdin, never as an argument, so no shell expands it.
- The script writes only that field, only on an open PR of this repo. It reads the value back, then posts a new PR comment, marked `<!-- review-level -->`: **`Review level: red`**, or **`Review level: red (was yellow)`** after a change, then the reason. It prints one line. The GitHub MCP can't write a field on a PR, and raw `gh api` could write any field, `Stage` included.
- Exit 1 means nothing is shown. Recover first ([ADR 0010](../decisions/0010-agents-recover-before-they-escalate.md)). *Field set to X, comment not posted* is fixed by running it again. If it still fails, comment on the issue and set `Asking`.
- When the PR's level is above the issue's, the agent raises the issue's field to match. It never lowers it.
- It runs again only when asked, or when a push changes the files the PR touches.

GitHub stores the field on the PR but doesn't show it on the PR page. A **check run** named `Review level` will show it: a line in the PR's *Checks* list, with the value and the reason. The check also fails when the level is under the floor set by the files touched. One day a ruleset can require it, for auto-merge. Until that check exists, the owner reads the level in the comment.

The agent follows the PR to the end ([ADR 0012](../decisions/0012-agents-own-their-pr-to-the-end.md)) and sets Stage `In validation`.

### 2.8 Review and merge
The flow stops here. The owner reviews as the level says and merges through the merge queue ([ADR 0015](../decisions/0015-merge-through-a-merge-queue.md)). Promoting `dev` → `staging` → `main` and releasing to production are the owner's; no agent deploys to production ([PLAN §10](../PLAN.md#10-out-of-scope-for-now)).

## 3. Proportionality
The full flow costs usage ([PLAN §9](../PLAN.md#9-cost-and-limits)). A small, safe issue doesn't need all of it.

| Issue | Refuters | E2E | Questions |
|---|---|---|---|
| Effort `S` and Review level `green` | none: the planner reviews its own draft against the areas table | by the implementing agent, no separate agent | the gaps only; the real-need questions are skipped, except for a Decision |
| Anything else | every area | a separate agent | every step of [§2.1](#21-idea--issue-the-writing-issues-skill) |

The plan verdict and the PR are never skipped.

## 4. Epics
An issue becomes an Epic when it needs more than one PR, or its Effort would be `L` ([issue structure §3](../issue-structure.md#effort-in-detail)). Each sub-issue goes through the whole flow on its own. Order between them is "blocked by" ([issue structure §1](../issue-structure.md#1-rules-of-thumb)).

## 5. Until the pieces exist
The flow is decided; some of its tools are not built yet. They are the sub-issues of [Build the work flow, from an idea to a PR](https://github.com/ferrarolabs/agent-kit/issues/150). Until each exists, this holds:

| Piece | Until it exists |
|---|---|
| Review-level check | The independent agent sets the PR's `Review level` field with the script; the level comment is where the owner reads it. Nothing enforces the floor yet |
| PR template | The PR follows [§2.7](#27-the-pr) |
