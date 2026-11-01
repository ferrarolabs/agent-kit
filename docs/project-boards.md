# Project boards — design

> Status: **accepted** — decisions in ADR 0006 and ADR 0007. Nothing here is built yet, except what jamly's [42-project-board](https://github.com/ferrarolabs/jamly/blob/dev/docs/process/42-project-board.md) already specifies.
> When decided, the choices become ADRs. The template moves to `template/` only after it has run on jamly (ADR 0001).

The board's job, in one line: **show Elia what needs him, and show him whether the agents are working well — at a glance, from a phone.**

---

## 1. What I need

### Now (1–2 repos, mostly from a computer)
1. **What needs me?** Plans to approve, PRs to review, device checks, product questions. Open this first, every time.
2. **What can an agent pick up?** If this is empty, the agents are idle and *my* job is to write specs.
3. **Where is everything?** One flow view, per repo.
4. **How far is the milestone?**

### Later (3–5 repos, mostly from a phone, agents running for hours)
5. **One place across all repos** for questions 1 and 2.
6. **Which agent has stalled?** An `agent:working` issue with no activity for a day is a dead session: a usage limit, a crash, a question nobody saw.
7. **Are the agents good, and are they cheap?** See §4.
8. **Someone else can join** (a friend, a brother) without the boards being rebuilt.

### Constraints that shape everything
- **Agents can't reach Projects.** Cloud sessions see issues and labels through REST, not Projects (jamly D46). Whatever an agent reads or signals must be on the issue.
- **Labels are the agents' state.** The board shows that state; it must never become a second source of truth.
- **Solo and part-time.** Anything that needs me to drag cards by hand will rot within a week.
- **GitHub Free, personal account.** See §2 for what that rules out.

---

## 2. What GitHub can actually do (checked 2026-10-30)

✅ = checked against the GraphQL schema, the docs, or a run. ❓ = not confirmed; listed in §7 as a test.

| Capability | Status | Consequence |
|---|---|---|
| Create project, fields (text, number, date, single select, **multi select**, iteration) via API | ✅ schema | Scriptable |
| Create views via API: name, layout (table, board, roadmap), filter, visible fields | ✅ schema (`createProjectV2View`, `updateProjectV2View`) | Mostly scriptable |
| Set a view's **group by, sort, board column field** via API | ✅ **not available** | A short manual step per view |
| Enable built-in workflows via API | ✅ **not available** (read and delete only) | Manual step |
| `copyProjectV2`: copies views, fields, workflows **except auto-add**, insights; not items or repo links | ✅ docs | Copy is the highest-fidelity template on a personal account |
| Mark a project as a template | ✅ **organizations only** | |
| Auto-add workflows per project | ✅ Free: **1**, Pro/Team: 5 | A cross-repo hub can't auto-add from more than one repo on Free |
| Auto-add picks up existing items | ✅ **no**, only new or updated ones | Backfill by script |
| Max fields per project | ✅ 50 | Not a constraint |
| Project status updates (On track / At risk…) via API | ✅ schema (`createProjectV2StatusUpdate`) | A weekly digest can be posted automatically |
| Sub-issues, `parent-issue:` filter, Parent / Sub-issue progress fields | ✅ docs | Splitting an L becomes structure, not a label |
| "Blocked by" dependencies | ✅ schema (`addBlockedBy`); ❓ filtering on them in a project view | |
| **Issue fields** (custom fields that live on the issue: single select, text, number, date; REST + GraphQL; usable as project columns) | ✅ GA July 2026, **organizations only**, Free included | The fix for "agents can't see Projects" — but needs an org |
| Issue types (Feature / Bug / Task) | ✅ organizations only | Would replace `type:*` labels |
| Fine-grained token for a **user-owned** project | ✅ docs: not supported, classic PAT with `project` scope needed | Any automation on a personal account needs a broad token |
| GitHub Actions `GITHUB_TOKEN` on Projects | ✅ not enough | Same |
| Historical charts on Free | ❓ docs don't say | |
| GitHub Mobile: project views and field editing | ✅ list views and field editing; ❓ board layout | Design for table views on the phone |
| Claude Code exposes usage **per model** | ✅ run: headless result has `modelUsage` with tokens and `costUSD` per model; transcripts carry `model`, `usage`, `gitBranch`, `isSidechain` on every message | Cost per issue and per model is measurable without any external service |

---

## 3. Ideas, and the case against each

Each idea is stated, attacked, and what survives is kept. The order follows §1.

### 3.1 A "Status" field with columns, moved by hand
**Attack.** It duplicates the labels (D46: "when they disagree, the labels win"). If they can disagree, the board lies, and a board that lies once is never trusted again. And I won't drag cards: part-time, often from a phone.
**Attack on the obvious fix** (drop Status, use labels only). A board layout needs a single-select field for its columns; labels can't be columns. Without a board, "where is everything" becomes a filtered table — fine on a phone, poor on a computer.
**What survives.** Keep Status, but **nobody sets it by hand**. It is derived from labels and events by an automation (§5.3). Built-in workflows cover what they can (added → Inbox, closed → Done, merged → Done). An Action maps the agent labels onto Status.
**Residual risk.** The Action on a personal account needs a classic PAT with `project` scope stored as a secret in a public repo. The token is broad. Mitigation: dedicated token, `project` scope only (public repos need no `repo`), triggered only by `issues` and `pull_request` events, never runs code from a PR. Or the org option (§3.8), where a fine-grained token works.

### 3.2 "Needs me" as a project view
**Attack.** On the phone, a project view is two taps deep, and nothing pushes it to me. I'll find out a plan has been waiting three days when I happen to open it.
**Attack on the alternative** (GitHub notifications only). Notifications mix everything — CI emails, my own comments — and have no priority.
**What survives.** Both, with different jobs. The **view** is the list, sorted by priority and by how long it has waited. The **push** is decision #13 (how "I need you" reaches me): the view doesn't replace it. On the hub (§3.6), "Needs me" is grouped by repo.

### 3.3 "Agent queue" (`agent:ready -agent:working`)
**Attack.** Agents can't read Projects, so the queue is no use to them: they find work through the labels.
**Answer.** True, and beside the point: the queue is for **me**. Empty means idle agents. More than a week's worth means I'm specifying faster than they build. Both are signals. **Keeps**, renamed "Ready for agents", with a count.

### 3.4 Size S / M / L
**Attack.** I estimate badly, agents can't read it, and nothing checks it. "L = split it" is the only part that does work.
**What survives.** Replace "L" with structure: an L becomes a parent issue with sub-issues, and the project shows *Sub-issue progress*. Keep S/M as a **prediction**, and compare it with the measured cost (§4). If S and M cost the same, the field is noise and goes. In an org, Size becomes the built-in *Effort* issue field, which agents can read.

### 3.5 Measuring everything
**Attack.** Projects count items and sum number fields. They don't measure *durations* — and "time waiting on me", the metric that matters most, is a duration. Every extra metric is something to build and keep alive. A dashboard nobody opens is cost without benefit.
**What survives.** Metrics live where the data is, not in Projects (§4). The project shows only their result, as number fields and a weekly status update. Built in order of value per effort.

### 3.6 One "hub" project across all repos
**Attack 1 — two sources of truth.** An issue can sit in several projects, but each project has its own fields. If both the repo project and the hub have a Status, they drift.
**Attack 2 — auto-add.** Free allows one auto-add workflow per project. A hub over five repos can auto-add from one.
**Attack 3 — it may not need to be a project at all.** A saved issue search (`user:EliaFerraro is:open label:needs:elia`) is cross-repo, free, never drifts, and works in GitHub Mobile.
**What survives.** The hub holds **no fields of its own except Status, synced by the same automation**. It shows the cross-repo questions only: Needs me, Stalled, Ready for agents, Shipped this week, and the cost and quality charts. Items get there through the automation that already runs (§5.3), not through auto-add. Until there are 3+ repos with agents running, **saved searches are enough** and the hub waits.
**Precondition.** It only works if every repo uses the **same labels**. So a common `labels.yml` is part of the template, not a nice-to-have.

### 3.7 The template: script or copy?
**Copy** (`copyProjectV2` from a "template" project): highest fidelity, because it keeps group-by, sort and workflows. **Attack:** the template then lives only in GitHub's UI. It isn't reviewable or diffable, and it drifts silently — against ADR 0002 (state lives in the repo).
**Script** (create everything from a spec file): reviewable, lives in the kit. **Attack:** the API can't set group-by, sort or workflows, so every new project still needs manual clicks.
**What survives — both, with the spec as the truth.**
1. `project-template.yml` in the kit declares fields, views (filter, visible fields, *and* the intended group-by and sort), workflows and labels.
2. A script creates a project from it. Group-by, sort and workflows are printed as a short checklist.
3. The script also has a **check** mode: it reads a live project back and diffs it against the spec. That's the Sensor that catches drift — the part copy can't give.
4. Once one project matches the spec, later projects can be copied from it to save the clicks, then checked against the spec.

### 3.8 Move the repos into a free GitHub organization?
Not something I'd thought of before the research. It changes several answers above.
**For.** Issue fields (Priority, Effort, dates live **on the issue**, agents can read and set them over REST, the project shows them) — the cleanest fix for "agents can't see Projects". Issue types instead of `type:*` labels. Project templates for real. Fine-grained tokens for project automation instead of a broad classic PAT. A natural home if someone joins.
**Against.** Migration: transfer each repo (GitHub redirects old URLs), reinstall the Claude GitHub App, recreate cloud environments, re-check rulesets. One more account surface. Auto-add is still 1 per project on Free. For the portfolio, repos sit under the org name — pinnable on my profile, but one step removed. And it's all unproven for **our** case: ❓ can a Claude cloud session actually read and write issue fields through its GitHub proxy?
**What survives.** Don't decide on reading — run a **spike** (§7, T1). If cloud sessions can use issue fields, the org pays for itself. If not, stay personal and use labels plus the token.

### 3.9 Roadmap layout, iterations, dates
**Attack.** Solo and part-time, dates are fiction, and a roadmap full of missed dates is demoralising, not informative.
**What survives.** Milestones only, no iterations. A roadmap view **grouped by milestone**, no date fields. Revisit if someone joins.

### 3.10 Views per repo: how many?
**Attack.** Every view is something to keep correct. Five views × five repos = 25 places to drift.
**What survives.** Few views, identical in every repo (the template guarantees it), each answering one question. Anything a view can't answer, a filter typed on the spot can.

---

## 4. Metrics

Ranked by value for effort. Each one says where its data comes from, because that decides whether it is cheap.

| # | Metric | Question it answers | Data source | Effort |
|---|---|---|---|---|
| M1 | **Time waiting on me** (per issue, and the total open now) | Am I the bottleneck? | Issue timeline: `needs:elia` / `needs:device-check` labelled → unlabelled | Low: REST, no tokens needed |
| M2 | **Stalled agents** | Which session died? | `agent:working` + last activity older than N hours | Low: a view, plus the resume task (decision #12) |
| M3 | **Usage per issue, per model** | Is each model used for its job? | Claude Code transcripts: every message has `model`, `usage`, `gitBranch` (→ issue number), `isSidechain` (→ subagent) | Medium: one hook (§4.1) |
| M4 | **Throughput** | Is anything moving? | Closed issues and merged PRs per week | Low: built-in chart |
| M5 | **Quality** | Are the agents any good? | Per PR: CI runs failed before green, review rounds, device check failed, reopened issues | Medium |
| M6 | **Estimate vs actual** | Is Size worth keeping? | Size (§3.4) vs M3 | Free once M3 exists |

### 4.1 Usage per issue and per model (M3)

**Model names.** The policy and every subagent's `model:` name the **full id** (`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`), or the ledger checks what an alias resolved to. On 2026-10-30, CLI 2.1.190 resolved `haiku` → Haiku 4.5 and `sonnet` → Sonnet 4.6; after updating to 2.1.314 they resolved to 5.5.

**The goal.** See whether the model policy is followed: **Haiku** for atomic, well-defined work with no interpretation; **Sonnet** for complex but defined work; **Opus** for coordination, reasoning, planning. Whether that policy is *right* is a separate question; this measures whether it is *followed*.

**How.** A `SessionEnd` hook (❓ or `Stop`, made idempotent) reads the session transcript, including subagent transcripts, and sums tokens per model. It then upserts one **usage ledger** comment on the issue: one row per session, then totals per model. The issue number comes from `gitBranch`. Comments are on the issue, so agents, Actions and I can all read them, and they survive the session.

```text
Usage ledger — #12
| session | model  | role (main/subagent) | input | output | cache read | cache write | est. $ |
| …       | opus   | main                 | …     | …      | …          | …           | …      |
| …       | haiku  | subagent             | …     | …      | …          | …           | …      |
Totals: opus 61% · sonnet 30% · haiku 9% of est. $
```

The automation (§5.3) copies the totals into project number fields: `Cost $`, `Opus share %`. The hub then charts them: cost per issue, model mix per repo, cost by Size.

**Against.**
- *Tokens are the truth, dollars are a guess.* Transcripts carry tokens, not prices, so cost needs a price table that goes stale. Store tokens; compute dollars when reporting.
- *On a subscription, dollars aren't what I pay.* What I spend is my **usage limits**, and Opus drains them fastest. The model mix is still the right signal; label the dollar figure "API-equivalent".
- *Goodhart.* Optimising for cheap models invites cheap mistakes. Only read M3 next to M5: a cheaper issue that needed two extra review rounds wasn't cheaper.
- *Coverage.* Only sessions that run the hook are counted. A chat on claude.ai about an issue isn't. Good enough: it's the agents I'm measuring.
- *Cloud.* ❓ The hook must be able to comment from a cloud session (REST through the proxy). That's test T3.

---

## 5. The design

### 5.1 One template, applied to every repo

`project-template.yml`, in the kit — declarative, reviewable:

```yaml
labels: labels.yml            # the same labels in every repo (precondition for the hub)
fields:
  Status:  [Inbox, Ready, In progress, Needs me, Device check, Done]   # set by automation only
  Size:    [S, M]             # an L becomes a parent issue with sub-issues
  Cost $:  number             # from the usage ledger
  Opus share %: number
  Waited on me (h): number    # M1
  # built in: Milestone, Labels, Assignees, Parent issue, Sub-issue progress, Repository
views:
  - name: Needs me
    layout: table
    filter: 'label:needs:elia,needs:device-check'
    sort: [priority, Waited on me (h) desc]          # manual step
  - name: Flow
    layout: board
    filter: '-status:Done'
    columns: Status                                   # manual step
  - name: Ready for agents
    layout: table
    filter: 'label:agent:ready -label:agent:working'
    sort: [priority]
  - name: Stalled
    layout: table
    filter: 'label:agent:working updated:<@today-1d'  # ❓ T5: confirm the syntax in project filters
  - name: Milestone
    layout: table
    group_by: Milestone                               # manual step
    filter: '-status:Done'
  - name: Shipped
    layout: table
    filter: 'status:Done'
    sort: [updated desc]
workflows:                     # manual step: the API can't enable them
  - item added → Status: Inbox
  - item closed → Status: Done
  - pull request merged → Status: Done
  - auto-add: this repo, is:issue,pr              # 1 allowed on Free
  - auto-archive: Done for 14 days
charts:
  - Throughput: closed per week
  - Cost by Size
  - Model mix
```

Repo-specific views (jamly's *Audit inbox*, an epic filter) are allowed **on top**, never instead.

### 5.2 Per-repo project vs hub
- **Per repo:** the whole template. Planning lives here.
- **Hub ("Command center"), later:** the same fields, only the cross-repo views (Needs me grouped by repo, Ready for agents grouped by repo, Stalled, Shipped, the charts). Items arrive through the automation. **Not built until 3+ repos have agents running**; until then, three saved searches.

### 5.3 The automation (the part that makes it work)
One GitHub Action, the same in every repo, on `issues` and `pull_request` events plus a nightly schedule:
1. Adds the item to the repo project, and to the hub when it exists. This also covers backfill.
2. Sets Status from labels: `agent:ready` → Ready, `agent:working` → In progress, `needs:elia` → Needs me, `needs:device-check` → Device check, closed → Done.
3. Nightly: computes *Waited on me (h)* from the timeline (M1), copies the usage ledger totals (M3), and posts a weekly project status update on the hub.

Harness roles: the labels are the **Record**; the Action is a **Sensor** that turns the Record into a view; the template's check mode is a **Sensor** on the boards themselves; nothing here is a **Boundary**.

**Against the Action.**
- *Token* — see §3.1.
- *Another moving part that can break silently.* It writes a heartbeat (last run) into the weekly status update; no update means it's broken.
- *Racing a human edit.* Labels win, by rule. The Action overwrites Status; anyone who wants to change Status changes the label.

---

## 6. Rollout, in phases, each with an exit check

| Phase | What | Exit check (seen failing once) |
|---|---|---|
| **P0** | jamly project from the template **by hand + script**, without the Action. Saved searches for the cross-repo view | The template script's check mode reports a difference I introduced on purpose |
| **P1** | The Action on jamly: add items + Status from labels | Adding `needs:elia` moves the card within a minute; removing the Action's token makes the heartbeat go stale |
| **P2** | Usage ledger hook | A session on a test issue leaves a ledger with the right models, including a subagent |
| **P3** | M1 and M5 into fields; weekly status update | The number for a test issue matches a hand count |
| **P4** | Template into `template/`; agent-kit gets its own project from it | Applying it to agent-kit needs no edits to the template |
| **P5** | Hub, when 3+ repos have agents running | — |

The org decision (§3.8) sits before P1, because it changes which token the Action uses.

---

## 7. Hypotheses to test before building

| # | Hypothesis | Why it matters | Cheapest test |
|---|---|---|---|
| T1 | ✅ **Verified 2026-10-31**, through the GitHub MCP tools and through `gh api` (REST), on a throwaway issue in `ferrarolabs/agent-kit` (see below). GraphQL is not available from cloud sessions | Decides whether issue fields can carry the agents' state | Done |
| T2 | Historical charts are available on Free | M4 and the charts | Create one in a test project |
| T3 | A hook in a cloud session can comment on its issue | M3 in the cloud | One-line hook on a test issue |
| T4 | ✅ **Verified 2026-10-30.** Each subagent has its own transcript in `<session>/subagents/agent-*.jsonl` (with `isSidechain: true`, its own `model`) plus a `.meta.json` with the agent type. The headless result's `modelUsage` includes subagents. **Raw transcript lines double-count**: dedupe by request id | M3 per role | Done |
| T5 | ✅ **Verified 2026-10-30** on live items via `items(query:)`: `<` means older. `updated:<@today-1d` → 0 and `updated:>@today-1d` → all, on items all updated today. The Stalled filter is right | The Stalled view | Done |
| T6 | ✅ docs: GitHub Mobile shows projects as **lists with collapsible groups**, not as boards | Phone views are tables grouped by Status | Done |
| T7 | ✅ **Documented 2026-10-31** (GitHub docs source, `events-that-trigger-workflows.md`): `issues` has `field_added` (set or changed) and `field_removed`. Live proof comes with the [auto-start](https://github.com/ferrarolabs/agent-kit/issues/76) | Whether Stage can start an agent, as `issues: labeled` does today | Done |

### T1 · what was run (2026-10-31, cloud session)

#### MCP tools

| Step | Call | Result |
|---|---|---|
| List fields, repo level | `list_issue_fields(owner=ferrarolabs, repo=agent-kit)` | Start date, Target date, Effort (High/Medium/Low), Priority (number) |
| List fields, org level | `list_issue_fields(owner=ferrarolabs)` | `Resource not accessible by integration`. This is why the first try returned nothing: the app can't read org-level settings. Always pass `repo` |
| Read | `issue_read(get)` on [Test: can a cloud session read and set issue fields?](https://github.com/ferrarolabs/agent-kit/issues/24) | `field_values: [{Priority: "73"}]` |
| Set on create | `issue_write(create, issue_fields=[Effort=Low, Priority=5])` → [Throwaway: issue-field test](https://github.com/ferrarolabs/agent-kit/issues/80) | Read back: `Priority "5"`, `Effort "Low"` |
| Update and clear | `issue_write(update, issue_fields=[Effort=High, Priority delete])` | Read back: `Effort "High"`, Priority gone |
| Search | `search_issues(..., fields=[field_values])` | Returns field values per issue |
| Fails on a bad option | `Effort = "Huge"` | `issue field option "Huge" was not found for field "Effort"`; value unchanged |
| Fails on a missing field | `Stage = "Ready"` | `issue field "Stage" was not found in ferrarolabs/agent-kit` (Stage doesn't exist yet) |

**`gh api` (REST).** `R=repos/ferrarolabs/agent-kit/issues/80/issue-field-values`. Field ids come from `list_issue_fields`.

| Step | Command | Result |
|---|---|---|
| Read | `gh api $R` | `[{issue_field_name: "Effort", single_select_option: {name: "High"}}]`. The issue itself also carries `issue_field_values` |
| Add or update | `gh api -X POST $R` with `{"issue_field_values":[{"field_id":49251868,"value":"2026-11-15"}]}` | Target date set; Effort kept |
| Replace all | `gh api -X PUT $R` with `{"issue_field_values":[{"field_id":49253581,"value":42}]}` | Priority 42, **and Effort and Target date gone**. PUT wipes every field it doesn't name. Agents use POST |
| Clear one | `gh api -X DELETE $R/49253581` | Read back: `[]` |
| Fails on a bad option | POST Effort with `999` | HTTP 422, `must be a string option name` |
| Fails on a bad value | POST field id `1` with `"x"` | HTTP 422, `Issue field option with name x does not exist` |

**What cloud sessions can't reach**, whatever the token:
- GraphQL: `GitHub GraphQL is not available from Claude Code sessions; use the REST API`.
- Org paths, such as `orgs/ferrarolabs/projectsV2`: `sessions are bound to their configured repositories`. So `gh project list` fails too (`unknown owner type`).
- `gh auth status` reports `The token in GH_TOKEN is invalid` while `gh api user` works. Don't trust it; test with `gh api user`.

**What does reach the Project:** a cloud session can start a workflow (`POST repos/{owner}/{repo}/actions/workflows/{file}/dispatches` passes the proxy) and read its runs. So project scripts run in an Action, started from the cloud ([Project scripts run in an Action, started from cloud sessions](https://github.com/ferrarolabs/agent-kit/issues/83)).

---

## 8. Decisions for Elia

1. **Org or personal account** — after T1. Recommendation: run T1 first; if it passes, move to a free org.
2. **The Action and its token.** Recommendation: yes. Without it Status rots, and the boards with it.
3. **Hub now or later.** Recommendation: later; saved searches until 3+ repos.
4. **Metrics order.** Recommendation: M1 → M2 → M3 → M4 → M5. Two of them, M1 and M3, are what you asked for, and M3 only means something next to M5.
5. **Status values.** The spec in jamly has *In review*; this proposal folds it into *Needs me*, because for one person "a PR waits for my review" and "a question waits for me" are the same queue. Keep or fold?

Related open decisions: #12 (resume task frequency, which drives M2), #13 (how "I need you" reaches me), #14 (skills at account level vs in the kit: the usage hook may be one).
