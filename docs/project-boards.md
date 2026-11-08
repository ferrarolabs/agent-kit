# Project boards — design

> Status: **accepted** in [ADR 0024](decisions/0024-the-board-on-issue-fields.md), for [Define the project template's board](https://github.com/ferrarolabs/agent-kit/issues/140). It replaces the design of [ADR 0007](decisions/0007-project-boards.md), whose full text and research are kept [at `89f8515`](https://github.com/ferrarolabs/agent-kit/blob/89f8515/docs/project-boards.md).
> **Nothing here is built yet.** [Configure the "Agent work" project template once](https://github.com/ferrarolabs/agent-kit/issues/20) applies it to the org template. Then the repo projects are created as copies ([ADR 0008](decisions/0008-numeric-priority-and-projects-from-the-template.md)). The rows marked ❓ in §3 are checked live there first.

The board's job, in one line: **show the owner what needs them and where everything is, at a glance, from a phone, without asking an agent.**

It sits on top of the [issue structure](issue-structure.md) ([ADR 0022](decisions/0022-issue-structure-types-and-fields.md)): five issue types and six issue fields. The board adds nothing of its own except Status, which it can't remove.

---

## 1. What the owner needs

### Now (1–2 repos)
1. **What needs me?** Plans to approve, decisions, finished PRs to review, device checks. Open this first, every time.
2. **What can an agent pick up?** If this is empty, the agents are idle and *my* job is to write specs.
3. **Where is everything?** One flow view, per repo.
4. **How far is the milestone?**

### Later (3–5 repos, agents running for hours)
5. **One place across all repos** for questions 1 and 2.
6. **Which agent has stalled?** A `Working` issue with no activity for a day is a dead session.
7. **Are the agents good, and are they cheap?** See §9.
8. **Someone else can join** without the boards being rebuilt.

### Constraints
- **Agents can't reach Projects.** Cloud sessions get 403 on GraphQL and on project pages (§3, F8). Whatever an agent reads or signals is on the issue: its type and its fields.
- **Stage is the source of truth** ([issue structure §3](issue-structure.md#stage-in-detail)). The board shows it; it never holds a second copy that can disagree for long.
- **Solo and part-time.** Anything that needs cards dragged by hand rots within a week.

---

## 2. Decisions

Taken by Elia on [the issue](https://github.com/ferrarolabs/agent-kit/issues/140) on 2026-11-02 and 2026-11-06 ([plan v3](https://github.com/ferrarolabs/agent-kit/issues/140#issuecomment-6686741739)).

1. **No project fields, except Status.** Everything the board shows, groups, sorts and filters is an issue field or the issue type.
2. **The board's columns are Stage**, the issue field. Every view and chart uses Stage.
3. **Status stays aligned with Stage, both ways**, by a job every 10 minutes ([Stage ⇄ Status reconciler](https://github.com/ferrarolabs/agent-kit/issues/78)). No view uses Status, but it can't be removed and it shows in every issue's sidebar. Someone may edit it, so the job copies in both directions: the most recent change wins, and on a tie Stage wins ([ADR 0009](decisions/0009-issue-data-in-issue-fields.md)).
4. **The project is private**, with the owner as its only admin.
5. **Agents and jobs reach the project through one token, held only by Actions.** A cloud session starts the Action with `workflow_dispatch` ([Project scripts run in an Action](https://github.com/ferrarolabs/agent-kit/issues/83)) and never holds the token.
6. **Research first, invent nothing.** Every choice below cites a source (§11).

---

## 3. What GitHub can do with issue fields

✅ docs = GitHub's docs say it ([S1](#11-sources)). ✅ live = seen on a real project. ❓ = inferred or documented only for project fields; each ❓ has its cheapest test in §10.

| # | Capability | Status | Consequence |
|---|---|---|---|
| F1 | A board's columns can be "any single select or iteration field". Issue fields can "group by column on the board layout" | ✅ docs, ❓ live: the board page never names issue fields | Stage can be the board's columns. Test T8 |
| F2 | Group, filter and sort by issue fields, "in both table and board layouts". Charts can use them | ✅ docs | Every view below uses Stage, Priority, Effort, Review level |
| F3 | Built-in workflows set **only Status**. Auto-add filters take only `is`, `label`, `reason`, `assignee`, `no` | ✅ docs | No workflow can set Stage. Auto-add can't filter on type or fields |
| F4 | View filters: `type:"Bug"`, `has:FIELD`, `no:FIELD`, `-field:A,B` (none of these values), `parent-issue:`, numeric ranges, `@today`. Terms separated by a space are AND; a comma is OR within one field. There is no `is:blocked` | ✅ docs | Flow's `Ready` column can't hide blocked issues by filter. GitHub marks them with an icon instead |
| F5 | PRs, draft issues and other-org issues show **empty** issue-field cells | ✅ docs | Views filter on `is:issue`. PRs show through *Linked pull requests* |
| F6 | Dragging a card to another column writes that column's value | ✅ docs for Status, ❓ for an issue field | A drag on the board would write Stage on the issue. Test T8 |
| F7 | Only fields with **Public** visibility show in public or internal projects | ✅ docs | A private project shows every field, whatever its visibility |
| F8 | From a cloud session, GraphQL and project pages return 403 | ✅ live, 2026-11-06 | Nothing about the project can be checked or changed from a session; only through an Action |
| F9 | A project holds up to 50,000 items, archived ones included | ✅ docs | Not a constraint. No auto-archive is needed |
| F10 | A board can set a **column limit**: the count is highlighted when over it; nothing is blocked | ✅ docs | Used on `Working` (§5) |
| F11 | Free allows **one** *auto-add to project* workflow per project. *Auto-add sub-issues* is a separate built-in workflow, not a copy of it | ✅ docs | One repo per project by auto-add. A hub needs an Action to add items (§8) |

---

## 4. The views

Five views, the same in every repo. Each answers needs from §1. The fields are the issue fields of [issue structure §3](issue-structure.md#3-issue-fields); Status's options are in §6. Table views show three fields at most, for the phone; Flow is a board, for a computer. On a board, the sort applies inside each column ([S1](#11-sources): "when a board is sorted, you cannot manually reorder items within a column"). On a phone: GitHub Mobile shows projects as lists with collapsible groups, not boards (T6).

| View | Layout | Filter | Group, sort | Fields | Answers |
|---|---|---|---|---|---|
| **Needs me** | table | `is:issue is:open -stage:Inbox,Ready,Working,Done` | group by Stage; sort Priority desc | Title, Stage, Priority | 1, and new issues that nobody has triaged (the *No Stage* group) |
| **Flow** | board | `is:issue is:open` | columns Stage; sort Priority desc | Type, Priority, Effort, Review level | 2 (the `Ready` column), 3 |
| **Stalled** | table | `is:issue is:open stage:Working updated:<@today-1d` | sort Updated, oldest first | Title, Updated, Linked pull requests | 6 |
| **Epics** | table | `is:issue is:open type:"Epic"` | group by Milestone; sort Priority desc | Title, Sub-issues progress, Target date | 4 |
| **Shipped** | table | `is:issue is:closed` | sort Updated, newest first | Title, Type, Linked pull requests | 4, and throughput |

- **Why five.** GitHub's guidance pairs a table for the backlog with a board for progress ([S2](#11-sources)). Solo setups do the same with one or two views ([S6](#11-sources), [S7](#11-sources)). ADR 0007's *Ready for agents* is now Flow's `Ready` column, and *Incomplete* is the `no:stage` group in Needs me. Fewer views means fewer places to drift.
- **Needs me filters on two values, not one.** `Asking` (stuck) and `In validation` (a complete PR) are different queues ([issue structure §3](issue-structure.md#stage-in-detail)). The group shows which is which.
- **One filter, by exclusion.** Listing `Asking`, `In validation` *and* `no:stage` can't be one filter: terms separated by a space are AND (F4). Excluding the other four values keeps the issues with no Stage. If that doesn't hold live (T9), the triage group becomes its own view, `is:issue is:open no:stage`.
- **No Stage is a group, not a value.** Auto-add can't set Stage (F3), so a new issue arrives without one. Kubernetes' SIG Node board starts every new item in a **Triage** column and moves it out only once its required data is set ([S4](#11-sources)). `no:stage` in Needs me is that column.
- **Epics on a table, not a roadmap.** Solo and part-time, a planned date is a guess ([issue structure §3](issue-structure.md#dates)). The dates are optional, so a roadmap would be mostly empty. Milestones carry the phase.
- **Repo-specific views** are allowed on top, never instead (jamly's *Audit inbox*, for example).

### Filters, and how sure each one is

| Filter | Status | Evidence |
|---|---|---|
| `is:issue`, `is:open`, `is:closed` | ✅ docs | [S1](#11-sources), filtering-projects: "is" qualifier |
| `-stage:Inbox,Ready,Working,Done` keeps issues with no Stage | ❓ | `-field:A,B` is documented with project fields only, and what it does to an empty value isn't stated. T9 |
| `no:stage` on an issue field (the fallback) | ❓ | `no:FIELD` is documented with project fields only. T9 |
| `stage:Working` | ❓ | Single-value filters are documented for project fields; issue fields are said to filter "just like any other project field". T9 |
| `type:"Epic"` | ✅ docs | filtering-projects: `type:"bug"` |
| `stage:Working updated:<@today-1d` | ✅ live for `updated`; ❓ for `stage:` | T5: `<` means older on live items. The docs' wording reads the other way; the run wins. One day is ADR 0007's threshold for a dead session ([old design §1](https://github.com/ferrarolabs/agent-kit/blob/89f8515/docs/project-boards.md#1-what-i-need), need 6) |

---

## 5. Who moves what

Stage says whose turn it is ([issue structure §3](issue-structure.md#stage-in-detail)). The board doesn't change that.

| Column | Moved into by | On the board |
|---|---|---|
| (no Stage) | auto-add | the triage group |
| `Inbox` | whoever triages | the owner may drag here |
| `Ready` | **the owner only** | the owner may drag here. It is the signal that an agent may start |
| `Working` | the agent, on the issue (agents can't reach the project) | never dragged by hand. **Column limit: 1** while one session runs at a time ([Run 2–3 agent sessions in parallel](https://github.com/ferrarolabs/agent-kit/issues/51) raises it) |
| `Asking` | the agent | never dragged by hand |
| `In validation` | the agent | never dragged by hand |
| `Done` | closing the issue | never dragged by hand: close the issue instead |

- The column limit follows the personal-kanban practice of capping work in progress ([S7](#11-sources)). Above 1, two agents may be on the same issue, or a dead session holds a slot.
- **Nobody but the owner sets `Ready`, on the board or anywhere.** The project is private, with the owner as its only admin (§2.4). So only the owner and the Actions' token can write Status or drag a card. The rule for the token is in §6.

---

## 6. Status, the job and the token

- **Status has Stage's six values**, in the same order: `Inbox`, `Ready`, `Working`, `Asking`, `In validation`, `Done`.
- **The reconciler** runs every 10 minutes ([Stage ⇄ Status reconciler](https://github.com/ferrarolabs/agent-kit/issues/78)). When Stage and Status differ, the most recent change wins; on a tie, Stage wins. An issue with no Stage gets no Status.
- **On close**, the built-in workflow sets Status `Done` at once (§7), and the reconciler copies it to Stage. If the workflow is off or missed, the reconciler sets Stage `Done` on any closed issue itself. Either way the result is the same.
- **The token.** A fine-grained token with org **Projects: read and write**, and **Issues: read and write** on the repos, for Stage. It is stored as an Actions secret and used only by Actions: the reconciler, the project scripts ([Project scripts run in an Action](https://github.com/ferrarolabs/agent-kit/issues/83)) and, later, the hub's item adder (§8). No agent holds it.
- **The `Ready` rule.** No job or script that holds the token writes `Ready`, to Stage or to Status. The reconciler only copies, and sets `Done` on close: a `Ready` it copies was set by the owner, on the issue or on the project. The [threat model](threat-model.md#leg-2-untrusted-content) carries the same line.
- **Why both ways is safe enough.** Under a one-way copy, an edit to Status would be undone silently. Both ways, it reaches Stage, but only the owner and the token can make that edit, and the token never writes `Ready`.

---

## 7. Workflows

| Workflow | Setting | Why |
|---|---|---|
| Auto-add to project | **on**: this repo, `is:issue is:open` | Every new issue lands in the triage group. PRs carry no Stage (F5). ❓ `is:open` in auto-add: T10 |
| Auto-add sub-issues to project | **on** | An Epic's work shows with it |
| Item closed → Status: Done | **on** | Agrees with Stage `Done` on close; the reconciler copies it |
| Item added → Status | **off** | It would make `Inbox` the newest change and overwrite a `Ready` Stage through the reconciler |
| Item reopened, pull request linked, code review events | **off** | Only Stage and closing drive Status |
| Auto-archive | **off** | 50,000 items is far away (F9), and Shipped needs the history |
| Auto-close issue | **off** | Closing drives Status, never the other way |

GitHub's two defaults are *closed → Done* and *merged → Done* ([S1](#11-sources)). The first is kept. The second is moot: no PR is in the project.

---

## 8. Several repos and the hub

- **Issue fields are org-wide**, so the same view works on any repo's issues. A hub needs no field of its own.
- **The hub still waits** until 3+ repos have agents running ([ADR 0007](decisions/0007-project-boards.md), decision 3). Until then, saved searches.
- **How items will reach it.** Free allows one auto-add per project (F11). So an Action with the same token adds items from every repo. That is the only change the hub needs.

---

## 9. Metrics

The metrics in [ADR 0007](decisions/0007-project-boards.md), decision 4, hold: time waiting on me → stalled agents → usage per issue and per model → throughput → quality. Their design is [at `89f8515`, §4](https://github.com/ferrarolabs/agent-kit/blob/89f8515/docs/project-boards.md#4-metrics). What changes:

- Stalled agents is the **Stalled** view (§4). Throughput is **Shipped**, and a chart.
- Cost $, Opus share % and Waited on me (h) become **issue fields** when their metric exists ([issue structure §7](issue-structure.md#7-alternatives-rejected)): [usage ledger](https://github.com/ferrarolabs/agent-kit/issues/33), [board metrics](https://github.com/ferrarolabs/agent-kit/issues/34). Not project fields.
- **Charts now:** open issues by Stage; open issues by Type. Historical charts only if [the test on Free](https://github.com/ferrarolabs/agent-kit/issues/26) passes.

### Needs → views

| Need (§1) | Answered by | Or deferred, because |
|---|---|---|
| 1. What needs me? | Needs me | |
| 2. What can an agent pick up? | Flow, `Ready` column | |
| 3. Where is everything? | Flow | |
| 4. How far is the milestone? | Epics, Shipped | |
| 5. One place across repos | | the hub (§8); saved searches until then |
| 6. Which agent has stalled? | Stalled | |
| 7. Good and cheap? | | needs the usage ledger and board metrics (above) |
| 8. Someone else can join | | a second admin on a private project. The views need nothing |

### What is lost compared with project fields

| Was possible with project fields | With issue fields | Accepted because |
|---|---|---|
| Workflows set the column field | Workflows set only Status (F3) | The reconciler copies it; agents set Stage themselves |
| A PR card carries the column value | PR cells are empty (F5) | PRs are reached from their issue |
| Auto-add filters on the field | Auto-add filters on labels and state only (F3) | New issues land in the triage group |
| A field private to one project | Fields are org-wide | That is the point: one value everywhere |

---

## 10. Hypotheses to test

T1–T7 are [at `89f8515`, §7](https://github.com/ferrarolabs/agent-kit/blob/89f8515/docs/project-boards.md#7-hypotheses-to-test-before-building). They still hold: T1 (cloud sessions set issue fields over REST), T5 (`updated:<` means older), T6 (Mobile shows lists, not boards), T7 (`issues: field_added` triggers Actions). T2 is [its own issue](https://github.com/ferrarolabs/agent-kit/issues/26).

Each new one is checked on the org template, in [Configure the template once](https://github.com/ferrarolabs/agent-kit/issues/20), in this order. The order is by risk: T8 decides decision 2.

| # | Hypothesis | Cheapest test | If it fails |
|---|---|---|---|
| T8 | Stage can be a board's column field, and a drag writes Stage on the issue (F1, F6) | Add a board view, pick Stage as Column field, drag a throwaway issue from `Inbox` to `Done` and back; read the issue | Flow becomes a table grouped by Stage. Nothing else changes |
| T9 | `-stage:Inbox,Ready,Working,Done` keeps issues with no Stage; `stage:Working` and `no:stage` work on an issue field | Paste each into a table view holding one issue per Stage value and one with none | A separate *Triage* view, `no:stage`; or, if issue fields can't be filtered at all, the issue list's own search |
| T10 | Auto-add accepts `is:issue is:open` | Save the workflow with that filter; open a throwaway issue | Drop `is:open` |
| T11 | A column limit can be set on an issue-field column | Set 1 on `Working` | The Stalled view is the only signal |

---

## 11. Sources

GitHub's docs were read from their source, [github/docs](https://github.com/github/docs) at `c9d8b26` (2026-11-06), because `docs.github.com` is not reachable from a cloud session. Paths are under `content/issues/planning-and-tracking-with-projects/`.

| # | Source | What it gave |
|---|---|---|
| S1 | GitHub Docs: `understanding-fields/about-issue-fields.md`, `customizing-views-in-your-project/customizing-the-board-layout.md`, `filtering-projects.md`, `automating-your-project/using-the-built-in-automations.md`, `adding-items-automatically.md`, `archiving-items-automatically.md`; `managing-issue-fields-in-your-organization.md`; `data/variables/projects.yml` | F1–F7, F9–F11 |
| S2 | GitHub Docs: `learning-about-projects/best-practices-for-projects.md`, `quickstart-for-projects.md` | "Maintain a single source of truth"; a board "based on the status field by default"; views for backlog and progress |
| S3 | GitHub's [public roadmap](https://github.com/github/roadmap) (README at `d47b19f`) | Every item is an issue; one field gives the columns; shipped items are closed with a link |
| S4 | Kubernetes [SIG Node triage](https://github.com/kubernetes/community/blob/307ae50/contributors/devel/sig-node/triage.md) (`kubernetes/community` at `307ae50`) | Columns by whose turn it is: Triage, Waiting on Author, Waiting on Reviewer, Waiting on Approver, Done. A new item enters Triage and leaves only once its data is set |
| S5 | Rust's `S-waiting-on-*` labels ([issue structure, S6](issue-structure.md#6-sources)) | Whose turn it is, as one value |
| S6 | Bitovi, [GitHub Projects for solo developers](https://bitovi.com/blog/github-projects-for-solo-developers) | One table as the backlog, one board as the kanban: Ready, In Progress, Done |
| S7 | Super Productivity, [Personal kanban for developers](https://super-productivity.com/blog/personal-kanban-for-developers/) | Backlog, Ready, Doing, Waiting; work-in-progress limits, e.g. one card in Doing |

S6 and S7 were read through a web search summary: the pages themselves are not reachable from a cloud session. S7 is written by the maker of a productivity app. Its limits are a suggestion, used here for one column.

### Where the sources agree, and where the kit differs
- **Columns are whose turn it is.** Kubernetes (S4), Rust (S5) and the solo setups (S7, *Waiting*) all split the work by who must act next. Stage does the same, so the board takes Stage's values as they are.
- **A triage entry.** Kubernetes (S4) has a Triage column with a rule for leaving it. Here it is the `no:stage` group, since auto-add can't set Stage (F3).
- **The kit differs on Done.** Every source keeps a Done column on the board. Here Flow shows open issues only, and Shipped holds the closed ones. On a phone, a Done column longer than every other is noise.

---

## 12. Alternatives rejected

| Alternative | Why not |
|---|---|
| Status as the column field, mirrored from Stage (ADR 0007, 0009) | Two copies of one value on the board. Stage can be the column itself (F1) |
| No reconciler: Status left at its defaults | Status shows in every issue's sidebar; a stale value there misleads. Elia's decision 3 |
| A one-way reconciler (Stage → Status) | An edit to Status would be undone silently. Elia's decision 3 |
| A public project | Only Public fields would show (F7), and anyone with Write could drag a card to `Ready` |
| Seven views (ADR 0007) | *Ready for agents* duplicates Flow's `Ready` column; *Incomplete* duplicates the triage group |
| A roadmap layout for Epics | The dates are optional and mostly empty ([issue structure §3](issue-structure.md#dates)) |
| PRs in the project | Their Stage cells are empty (F5). They are reached from their issue |
| Auto-archive after 14 days (ADR 0007's spec) | Shipped would empty; the item cap is far (F9) |
| A Done column on Flow | It grows without bound; Shipped holds the history |

---

## 13. What this changes in open issues

No issue is edited until Elia approves this design. Then:

| Issue | Change |
|---|---|
| [Configure the "Agent work" project template once](https://github.com/ferrarolabs/agent-kit/issues/20) | Applies §4–§7 to the template, runs T8–T11 in order, and rewrites `project-template.json` |
| [build-project.js: create repo projects by copying the org template](https://github.com/ferrarolabs/agent-kit/issues/21) | `--check` compares views on Stage and issue fields; `statusFromLabels` goes. Runs in an Action ([Project scripts run in an Action](https://github.com/ferrarolabs/agent-kit/issues/83)) |
| [Create the Jamly and agent-kit projects as copies](https://github.com/ferrarolabs/agent-kit/issues/22) | Each copy is private, with Elia as its only admin |
| [Project sync](https://github.com/ferrarolabs/agent-kit/issues/66), [Detect drift](https://github.com/ferrarolabs/agent-kit/issues/67) | The spec they apply and check is §4–§7, with the column field Stage |
| [Stage ⇄ Status reconciler](https://github.com/ferrarolabs/agent-kit/issues/78) | Kept, both ways (ADR 0009). It gets the token of §6, the `Ready` rule, and *no Stage → no Status* |
| [Project scripts run in an Action](https://github.com/ferrarolabs/agent-kit/issues/83) | Its token is the one in §6: Projects and Issues read and write, held only by Actions |
| [Completeness check](https://github.com/ferrarolabs/agent-kit/issues/75) | The `no:stage` group in Needs me shows the same gap live; the check still covers the other fields |
| [An agent starts on its own](https://github.com/ferrarolabs/agent-kit/issues/76) | Unchanged, and still bound by the threat model: the trigger checks who set `Ready` |
| [Run 2–3 agent sessions in parallel](https://github.com/ferrarolabs/agent-kit/issues/51) | Raises the `Working` column limit |
| jamly's [board page](https://github.com/ferrarolabs/jamly/blob/dev/docs/process/42-project-board.md) | Through the jamly-first port (ADR 0014): columns on Stage, both ways, *item added* off, Audit inbox on issue fields |
