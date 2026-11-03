# Issue structure

> Status: **proposed** in [ADR 0022](decisions/0022-issue-structure-types-and-fields.md), for [Define the issue structure](https://github.com/ferrarolabs/agent-kit/issues/139). Nothing here is created on GitHub yet. Creating the types and fields, and migrating the open issues, is a follow-up once Elia approves.

What an issue is made of, in every `ferrarolabs` repo: its **type**, its **fields**, its **place in the hierarchy**, and the few **labels** left. Every choice cites a source. Nothing is invented where a source already does it.

## 1. Rules of thumb

Four decisions taken by Elia on 2026-11-02 frame everything below:

1. The kind of work is an **issue type**, not a label.
2. Agent ⇄ Elia communication is **one issue field**.
3. **No project fields.** Every piece of data is an issue field. The project's Status is the one exception, mirrored with the issue's Stage.
4. The rest is open, and settled by the research.

From the sources, three more follow:

- **Hierarchy is sub-issues, not types.** GitHub classifies with types "alongside sub-issues" ([S1](#6-sources)). So there is no *Sub-task* type: any issue can be a sub-issue, up to eight levels ([S3](#6-sources)).
- **Order is Priority plus "blocked by".** Dependencies are native ([S4](#6-sources)); they are not a field.
- **A field nobody writes is not created.** An empty field fails the [completeness check](https://github.com/ferrarolabs/agent-kit/issues/75) on every issue.

## 2. Issue types

Five types, org-wide. Three are GitHub's defaults, kept with their names. Two are added.

| Type | One line | Source | Was |
|---|---|---|---|
| **Feature** | Something a user of the product can do or see that they couldn't before. A *user story*. | GitHub default ([S1](#6-sources)); Jira *Story* ([S7](#6-sources)) | `type:feature` |
| **Task** | Work with no user-visible change: tooling, CI, refactor, docs, harness. A *technical story*. | GitHub default ([S1](#6-sources)); Jira *Task* ([S7](#6-sources)) | `type:chore`, `type:docs` |
| **Bug** | Something that behaves wrongly against what it should do. | GitHub default ([S1](#6-sources)); Jira *Bug* ([S7](#6-sources)); `kind/bug` ([S5](#6-sources)); `C-bug` ([S6](#6-sources)) | `type:bug` |
| **Epic** | A goal too big for one PR. Its work is its sub-issues; it is done when they are. | Jira's parent level ([S7](#6-sources)); Rust's `C-tracking-issue` ([S6](#6-sources)); GitHub's "large initiatives" issue ([S2](#6-sources)) | jamly's `epic:*` labels |
| **Decision** | One question only Elia can answer. The answer becomes an ADR. | `kind/design`, `kind/proposal` ([S5](#6-sources)); this repo's *Decide:* template and ADR 0003 | `type:docs` + `needs:elia` |

**How to pick.** Does a user notice? → Feature, or Bug if it's wrong today. Is it a question for Elia? → Decision. Does it need more than one PR? → Epic, with the work as sub-issues. Everything else → Task.

**Issue forms set the type.** An issue form's `type:` key sets the type on create ([S9](#6-sources)). Next.js does it (`type: Bug`, `type: Documentation`, [S8](#6-sources)). So each template here sets its type, not a `type:*` label.

### Why these names
- **Feature, not Story.** GitHub ships *Feature* and pins fields to it by default ([S1](#6-sources)). Renaming it to *Story* buys nothing and loses the defaults. "User story" is how a Feature is written, not a separate type.
- **Task, not Chore or Technical story.** Same reason: it's the default. One word covers chore, docs and refactor; the title says which.
- **Decision, not Discussion.** The deliverable is an answer recorded as an ADR, not an open conversation. Open-ended talk belongs in GitHub Discussions ([S2](#6-sources)), if it's ever needed.

## 3. Issue fields

Org-level fields, the same in every repo. Six, against a limit of 25 ([S1](#6-sources)). Review level was added by [ADR 0023](decisions/0023-the-work-flow-from-an-idea-to-a-pr.md).

| Field | Data type | Values | Who writes it | Source |
|---|---|---|---|---|
| **Stage** | Single select | `Inbox`, `Ready`, `Working`, `Asking`, `In validation`, `Done` | Elia (`Inbox` → `Ready`); the agent (`Working`, `Asking`, `In validation`); the reconciler (`Done` on close) | Decision 2; ADR 0009; Rust's `S-waiting-on-*` ([S6](#6-sources)) |
| **Priority** | Number | 1–100, 100 = do first | The agent that opens the issue; Elia adjusts | ADR 0008, ADR 0018 |
| **Effort** | Single select | `S`, `M`, `L` | Whoever writes the spec | GitHub default, T-shirt sizes suggested ([S1](#6-sources)); [board design §3.4](project-boards.md#34-size-s--m--l) |
| **Start date** | Date | any | Optional | GitHub default ([S1](#6-sources)) |
| **Target date** | Date | any | Optional | GitHub default ([S1](#6-sources)) |
| **Review level** | Single select | `green`, `yellow`, `red` | A separate agent on the plan; re-checked on the PR | [Work flow §2.3](guides/work-flow.md#23-the-review-level), ADR 0023 |

### Stage, in detail
Stage answers one question: **whose turn is it?** That's what Rust's `S-waiting-on-author` / `S-waiting-on-review` do with labels ([S6](#6-sources)), and what Kubernetes' `triage/needs-information` does ([S5](#6-sources)).

| Value | Means | Replaces |
|---|---|---|
| `Inbox` | Written, not yet ready for an agent. The default. | no label |
| `Ready` | Spec complete. An agent may start. | `agent:ready` |
| `Working` | An agent is on it. Don't start a second one. | `agent:working` |
| `Asking` | The agent has asked the owner something: a plan verdict, a decision, a credential, a setting. The issue's last comment says exactly what the owner has to do. No PR yet. The owner answers and sets `Ready` again ([work flow §2.4](guides/work-flow.md#24-the-plan-verdict)). | `needs:elia` when stuck or waiting for a plan verdict |
| `In validation` | The work is done and a complete PR waits for the owner: review, try it, check it on a device. Nothing is stuck. | `needs:elia` on a finished PR, `needs:device-check` |
| `Done` | Closed. | closed state |

- Elia's three values map onto four: `needs:elia` splits in two, because "stuck" and "waiting for my review" are different queues (Elia, [on the PR](https://github.com/ferrarolabs/agent-kit/pull/141#issuecomment-6590082701)). `Inbox` and `Done` exist because Status mirrors Stage and needs a first and a last column (ADR 0009).
- **Generic names.** No value names a person: the kit is for any project and any owner. `Asking`, not `Blocked`: GitHub already shows a *Blocked* icon on issues with an open "blocked by" dependency ([S4](#6-sources)), and the two would be confused.
- **One field, not two.** This *is* ADR 0009's Stage. Its values are now defined here.
- *In review* is **no longer folded** into the "needs me" queue (ADR 0007, decision 5): it is `In validation`. Rust keeps the same two apart, `S-waiting-on-author` and `S-waiting-on-review` ([S6](#6-sources)).
- `In validation` follows rule 4 of [Define the work flow](https://github.com/ferrarolabs/agent-kit/issues/137): a PR arrives only when the work is complete. So an issue in `In validation` always has one complete PR, and an issue in `Asking` has none.
- *Device check* is not a value: it's one more reason to need Elia, written in the comment. This answers [Decide: is "Device check" a generic Status?](https://github.com/ferrarolabs/agent-kit/issues/73) with *no*.

### Effort, in detail
- `S`: one sitting. `M`: a few sittings, one PR.
- `L` means **split it**: an `L` issue becomes an Epic, and its sub-issues get `S` or `M`. Same rule as the [board design](project-boards.md#34-size-s--m--l).
- GitHub's default is `High`, `Medium`, `Low` and its own docs suggest T-shirt sizes ([S1](#6-sources)). Sizes read as size; High/Low reads as importance and gets confused with Priority.
- Effort is a *prediction*. Once the [usage ledger](https://github.com/ferrarolabs/agent-kit/issues/33) measures cost, the two are compared. If `S` and `M` cost the same, the field goes ([board design §4](project-boards.md#4-metrics), M6).
- This answers [Decide: Effort values](https://github.com/ferrarolabs/agent-kit/issues/74).

### Dates
GitHub pins both dates to Feature ([S1](#6-sources)). Solo and part-time, a planned date is a guess ([board design §3.9](project-boards.md#39-roadmap-layout-iterations-dates)). So the two fields stay, but **optional**, and pinned only to **Epic**, where a range on a roadmap means something. When work really started and ended is read from the timeline, not typed.

### Which type needs which field
"Required" means an open issue of that type without it is flagged by the [completeness check](https://github.com/ferrarolabs/agent-kit/issues/75). Pinned fields are the ones the sidebar shows ([S1](#6-sources)).

| Field | Feature | Task | Bug | Epic | Decision |
|---|:-:|:-:|:-:|:-:|:-:|
| Stage | required | required | required | required | required |
| Priority | required | required | required | required | required |
| Effort | required | required | required | — | — |
| Start date | — | — | — | optional | — |
| Target date | — | — | — | optional | — |
| Review level | required | required | required | — | — |

- An Epic has no Effort: its size is its sub-issues.
- A Decision has no Effort: it should take a minute to answer (`CLAUDE.md`, "atomic" issues).

## 4. What GitHub already gives, used as is

| Need | Built-in | Source |
|---|---|---|
| Hierarchy | Sub-issues: 100 per parent, eight levels | [S3](#6-sources) |
| Order and blockers | "Blocked by" / "Blocking" | [S4](#6-sources) |
| Phases | Milestones (`Phase 1 · Foundations`, …) | [S2](#6-sources) |
| Who | Assignees | [S2](#6-sources) |

## 5. Labels: what's left

Labels stay only for what is **multi-valued and per repo**. An issue field can't be multi-select (single select, text, number, date only, [S1](#6-sources)), and it is org-wide.

- **Kept:** `area:*` (`area:harness`, and each repo's own). Kubernetes (`area/*`, `sig/*`, [S5](#6-sources)) and Rust (`A-*`, [S6](#6-sources)) do the same.
- **Dropped**, each with where it goes:

| Label | Goes to |
|---|---|
| `type:feature`, `type:bug` | Type Feature, Bug |
| `type:chore`, `type:docs` | Type Task |
| `type:audit` | The proposal's own type, with Stage `Inbox` (a proposal not yet accepted is exactly `Inbox`) |
| `agent:ready`, `agent:working` | Stage `Ready`, `Working` |
| `needs:elia` | Stage `Asking` (stuck) or `In validation` (a finished PR) |
| `needs:device-check` | Stage `In validation` |
| `priority:*` | Already gone (ADR 0008) |
| `epic:*` (jamly) | An Epic issue, with the work as sub-issues |

GitHub's default labels (`good first issue`, `duplicate`, …) are left alone: they cost nothing and outside contributors know them.

## 6. Sources

Read on 2026-11-02. GitHub's docs were read from their source, [github/docs](https://github.com/github/docs) at its latest commit (2026-11-02), because `docs.github.com` is not on this session's network allowlist.

| # | Source | What it gave |
|---|---|---|
| S1 | GitHub Docs: [Managing issue fields](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization), [Managing issue types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization) | Default types Task, Bug, Feature; up to 25 types. Default fields Priority, Effort, Start date, Target date, and which type each is pinned to. Field types; 25 fields per org; 10 pinned per type. "Issue fields are the source of truth"; "having both can cause confusion" |
| S2 | GitHub Docs: [Planning and tracking work for your team](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project), [Best practices for projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/best-practices-for-projects) | Types "alongside sub-issues"; milestones for the larger goal; "maintain a single source of truth"; issues for decisions, Discussions for open-ended talk |
| S3 | GitHub Docs: [Adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) | 100 sub-issues per parent, eight levels |
| S4 | GitHub Docs: [Creating issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) | Blocked by / blocking, shown on boards |
| S5 | Kubernetes: [`label_sync/labels.yaml`](https://github.com/kubernetes/test-infra/blob/master/label_sync/labels.yaml) | 26 `kind/*` values; `priority/*` bands; `triage/*`, `lifecycle/*` for state; `area/*`, `sig/*` for where |
| S6 | Rust: [`triagebot.toml`](https://github.com/rust-lang/rust/blob/main/triagebot.toml), [issue templates](https://github.com/rust-lang/rust/tree/main/.github/ISSUE_TEMPLATE) | `C-*` category (`C-bug`, `C-tracking-issue`), `S-waiting-on-*` for whose turn it is, `A-*` area, `P-*` priority |
| S7 | Atlassian: [Jira issue types](https://confluence.atlassian.com/servicedeskcloud/issue-types-1097176086.html) | Three levels: Epic; Story, Task, Bug; Subtask |
| S8 | Next.js: [issue forms](https://github.com/vercel/next.js/tree/canary/.github/ISSUE_TEMPLATE) | Uses org issue types from forms: `type: Bug`, `type: Documentation` |
| S9 | GitHub Docs: [Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) | The `type` key sets the issue type on create |
| S10 | VS Code: [issue templates](https://github.com/microsoft/vscode/tree/main/.github/ISSUE_TEMPLATE) and triage bot config | Still labels (`bug`, `feature-request`, `info-needed`), set by a bot. A counter-example: it predates issue types |

### Where the sources disagree, and what is followed
- **Priority: bands or a number?** Every source uses bands: GitHub (Urgent…Low), Kubernetes (`critical-urgent`…`backlog`), Rust (`P-critical`…`P-low`). The kit keeps a number (ADR 0008): with 60+ issues, four bands left fifteen tied. Bands suit a team that triages weekly; one person ordering everything needs a total order.
- **How many types?** Kubernetes has 26 kinds; GitHub ships 3; Jira 5. Followed: GitHub's 3 plus the two this repo already uses in practice (Epic in jamly, Decision here). More kinds would be filters nobody uses.
- **Type or label for kind?** Kubernetes, Rust and VS Code use labels, because they predate types. Next.js, newer to it, uses types. Followed: types, as Elia decided.

## 7. Alternatives rejected

| Alternative | Why not |
|---|---|
| A *Sub-task* type (Jira) | Sub-issues already are the hierarchy, and any type can be one ([S3](#6-sources)) |
| *Story* and *Technical story* as types | Same split as Feature / Task, minus GitHub's defaults |
| *Documentation* as a type (Next.js) | For this kit, docs is a Task. Next.js gets outside docs reports; we don't |
| A *Severity* field on Bug (GitHub's own example, [S1](#6-sources)) | One person, one queue: Priority already says how urgent it is |
| A value that names the owner (`Needs Elia`) | The kit is generic. Rejected by Elia on the PR |
| *Needs dev* as the stuck value | It reads as "needs a developer", which is the agent's own job |
| Separate fields for Stage and agent state | Decision 2 and ADR 0009: one field. Two would drift |
| Cost $, Opus share %, Waited on me (h) as fields now (ADR 0009) | No writer yet. They're created with the metric that fills them ([usage ledger](https://github.com/ferrarolabs/agent-kit/issues/33), [board metrics](https://github.com/ferrarolabs/agent-kit/issues/34)) |
| An `Area` single-select field | Areas differ per repo and an issue can have two; fields are org-wide and single-valued |
| Iterations | Solo and part-time; milestones are enough ([board design §3.9](project-boards.md#39-roadmap-layout-iterations-dates)) |

## 8. What this changes in open issues

Nothing is edited until Elia approves. Then:

| Issue | Change |
|---|---|
| [Migrate type labels to org issue types](https://github.com/ferrarolabs/agent-kit/issues/46) | Becomes the migration: create Epic and Decision, set each open issue's type, remove `type:*`. Its "if the cloud test passes" is moot |
| [Decide: Effort values](https://github.com/ferrarolabs/agent-kit/issues/74) | Answered: `S`, `M`, `L` (§3). Close |
| [Decide: is "Device check" a generic Status?](https://github.com/ferrarolabs/agent-kit/issues/73) | Answered: no. A device check is one way of validating a finished PR: Stage `In validation` (§3). Close |
| [Move the project's number fields to org issue fields, and add Stage](https://github.com/ferrarolabs/agent-kit/issues/77) | Narrows to creating Stage with the values above. The number fields wait for their metrics |
| [Replace the agent labels with Stage](https://github.com/ferrarolabs/agent-kit/issues/82) | Unchanged in goal; the value names are now fixed (`Ready`, `Working`, `Asking`, `In validation`), and `needs:elia` maps to two of them |
| [Action: keep project Status in step with labels](https://github.com/ferrarolabs/agent-kit/issues/19) | Obsolete: labels stop carrying state. Replaced by the [Stage ⇄ Status reconciler](https://github.com/ferrarolabs/agent-kit/issues/78). Close as not planned |
| [Stage ⇄ Status reconciler](https://github.com/ferrarolabs/agent-kit/issues/78) | Status gets the same six values as Stage |
| [Completeness check](https://github.com/ferrarolabs/agent-kit/issues/75) | Checks the "required" cells of §3, per type |
| [Define the project template's board](https://github.com/ferrarolabs/agent-kit/issues/140) | Starts from this: columns are Stage's values, views filter on type and fields |
| The issue templates (`.github/ISSUE_TEMPLATE/`, `template/.github/ISSUE_TEMPLATE/`) and `template/.github/labels.yml` | Set `type:` instead of `type:*` labels; `labels.yml` keeps only `area:*`. Through the jamly-first port (ADR 0014) |
| Every "Decide:" issue | Type Decision |
