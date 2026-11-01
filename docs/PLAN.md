# Plan — agent-kit

> Living document. It describes **where we want to end up**. What to do and in which order lives in [ROADMAP.md](ROADMAP.md); why each choice was made lives in [decisions/](decisions/).

## 1. Goal

A reusable agentic system that lets me build my projects with Claude Code agents that work **on their own, for long stretches** (12–24 hours without me looking), while I only own:

- **product decisions**: what to build and why;
- **architectural decisions**: how the system is shaped and which trade-offs we accept;
- **approval**: merging PRs by looking at tests and behaviour, not at every line.

I own the feature, not every line of code. To understand what the agents write, every feature produces a learning note (`docs/learn/`). Until the explainer exists, the implementing agent writes it in the feature's PR (ADR 0013).

The system is **opt-in**: in any repo I can keep working by hand or in chat. Agents work only when I ask them to, or when I've switched on an automation for that repo.

### How I know it works

1. I write an issue, put my phone away, and the next day there's a PR with green CI that meets the definition of done.
2. If I run out of usage halfway through, the work resumes on its own after the reset, from where it stopped.
3. A new project is set up with the kit in under 30 minutes.
4. When an agent gets something wrong, the fix becomes a rule, a hook or a test in the kit, and the mistake doesn't repeat in any project.

## 2. Principles

Taken from the *Harness Engineering* method (Alexio Cassani, Codemotion 2026) and adapted.

1. **Agent = Model + Harness.** I don't control the model; I control everything else. The work is on the harness.
2. **State lives in the repo, not in the session.** Spec, plan, progress and decisions are committed files. A session can die at any moment without losing anything.
3. **Irreversible → boundary, not instruction.** A sentence in `CLAUDE.md` only raises a probability. What can't be undone is prevented by permissions, sandboxing and branch protection.
4. **The definition of done is enforced, not just stated.** The contract states it, a skill runs it, a Stop hook refuses to finish until it passes.
5. **Evidence, not verdicts.** When a check fails, the agent gets the real error output back.
6. **Every check must be seen failing.** A check never seen red may not be wired up at all.
7. **Agents propose, I decide.** No agent merges to a protected branch or changes the architecture on its own.
8. **Short contract.** `CLAUDE.md` holds only what the code can't say: pitfalls, reasons, the right commands, the definition of done.
9. **Build bottom-up.** Use it on a real project first (jamly), then port what's generic into the kit at every merge (ADR 0014).
10. **Everything in a repo is in English.** Code, docs, decisions, issues, PRs and commit messages. The apps themselves can be in any language.

## 3. Architecture: three levels

The technical constraint that shapes everything: **a cloud session sees only what is committed to the repo, plus the skills enabled on my claude.ai account.** My machine's configuration (`~/.claude/`) doesn't reach the cloud on its own, and plugins declared in the repo aren't installed in cloud sessions. The one exception is the account's always-on rules: the cloud environment's setup script installs them as `~/.claude/CLAUDE.md` (ADR 0010).

| Level | Where it lives | What it holds | Applies to |
|---|---|---|---|
| **Account** | Skills on my claude.ai account | The *method*: writing specs, implementing an issue, critiquing, explaining, resuming work | Every cloud session, on every repo |
| **Account rules** | `account/CLAUDE.md`, installed as `~/.claude/CLAUDE.md` by the setup script and on my machine | Rules that hold everywhere, always on (a skill only loads when it matches) | Every session, cloud or local, on every repo |
| **Kit** | This repo, copied into projects | Roles (subagents), hooks, permissions, rules, issue templates, baseline CI, a `CLAUDE.md` skeleton | Every project that adopts it |
| **Project** | The project's repo | Project-specific `CLAUDE.md`, architectural decisions, `progress.md`, `docs/learn/` | That project only |

The kit is distributed like a library: **this repo is the original**, each project holds a **copy**. Until `sync-kit` exists, jamly holds the original of each piece and the kit follows it at every merge; [inventory.md](inventory.md) tracks each one (ADR 0014). Each project needs its own copy because a cloud session clones only the repo it works on. A sync script updates the generic files without touching the project-specific ones. No git submodules.

### Final layout of this repo

```text
agent-kit/
├── CLAUDE.md                 # how to work on this repo
├── docs/
│   ├── PLAN.md               # this file
│   ├── ROADMAP.md            # phases and checklists
│   ├── inventory.md          # every harness piece on the pilot, and its place in template/
│   └── decisions/            # the kit's ADRs
├── template/                 # what gets copied into every project
│   ├── CLAUDE.md.template
│   ├── .claude/
│   │   ├── settings.json     # permissions + hooks
│   │   ├── agents/           # roles
│   │   ├── skills/           # development skills
│   │   ├── rules/            # style, testing, security (path-scoped)
│   │   └── hooks/            # hook scripts
│   ├── .github/
│   │   ├── ISSUE_TEMPLATE/   # feature, bug
│   │   └── workflows/ci.yml  # test, lint, typecheck
│   └── docs/
│       ├── decisions/        # where the project records its ADRs
│       ├── learn/            # learning notes
│       └── progress.md       # state of the work in progress
├── account/
│   └── CLAUDE.md             # always-on rules, installed as ~/.claude/CLAUDE.md
├── account-skills/           # sources of the skills to enable on the account
├── evals/                    # tests for the harness itself
└── scripts/
    ├── bootstrap.sh          # set up the kit in a repo
    └── sync-kit.sh           # update the kit in a repo
```

## 4. Agent roles

| Role | When it works | What it produces | What it can't do |
|---|---|---|---|
| **Spec writer** | When I ask | An explicit issue from my idea: context, acceptance criteria, out of scope, test cases | Make product decisions for me |
| **Planner** | At the start of every issue | A plan in `docs/plans/<issue>.md`, with the architectural decisions I need to approve | Write code |
| **Implementer** | After the plan is approved | Code + tests on a branch, small commits, `progress.md` kept current | Merge, touch secrets or deployments |
| **Critic** | Before the PR | Concrete objections to the implementer's work, on a clean context | Change the code |
| **Test writer** | Alongside the implementer | Tests anchored to the acceptance criteria, not to the code written | Weaken existing tests |
| **Explainer** | When a feature is closed | `docs/learn/<feature>.md`: structure, framework concepts, alternatives rejected, where to look in the code | — |
| **Codebase auditor** | Weekly, one theme at a time | At most 3–5 `audit` issues with evidence and a proposal, never duplicating issues already open or rejected | Fix things directly |

## 5. The flow of a feature

```text
idea → [spec writer] → issue → [planner] → plan ──(I approve)──▶
[implementer + test writer] ⇄ hooks/CI ⇄ [critic] → green PR ──(I merge)──▶
[explainer] → docs/learn
```

I step in at two points: **I approve the plan** and **I merge**. Everything else runs on its own.

## 6. Long autonomy and resuming after limits

Goal: the feature moves forward for 12–24 hours without me, including across a usage limit.

- **State in a file:** `docs/progress.md` says which issue is in progress, what's done, what's left, the next step and any blockers. It's updated after every completed step, with a commit.
- **Small, frequent commits:** saved work is work pushed to the branch.
- **Automatic resume:** a cloud scheduled task runs at regular intervals with the instruction "resume from `progress.md`". When I'm out of usage, runs are rejected until the reset; the first one after the reset picks up from the saved point.
- **Idempotence:** resuming twice must do no harm. If the work is already done, or blocked waiting for me, the resume does nothing.
- **Asking for help:** if the agent is blocked on a decision of mine, it writes it in `progress.md`, stops, and flags it to me (an issue or a PR comment).

## 7. Boundaries

| Ring | What it prevents |
|---|---|
| **Permissions** (the repo's `.claude/settings.json`) | Reading `.env` and secrets, destructive commands (`rm -rf`, `git push --force`), changing deploy and CI config without asking |
| **Cloud environment** | Network limited to the domains needed; keys stored as network secrets, which the agent uses without seeing; no production credentials |
| **GitHub** | Protected branches: changes land only through a PR with green CI and my approval |
| **Hooks** | A Stop gate on the definition of done; a pre-action gate on dangerous commands |

Branch protection is the real safety net: it doesn't depend on how the agent behaves. Deny rules are a guardrail: they match the command text an agent usually writes, not every way of running a program.

## 8. Harness matrix: target state

Five components by four roles. This is the grid the kit must fill by the end; the current state is checked at every phase.

| | Guide | Sensor | Boundary | Record |
|---|---|---|---|---|
| **Context** | Short `CLAUDE.md`, definition of done | "run the checks before saying done" | Paths and secrets kept out of context | Session transcripts |
| **Tools** | Skills with precise descriptions | Tool errors that explain how to retry | Allow/deny per tool | Tool-call log |
| **Infrastructure** | Cloud environment setup script | Runnable tests, lint, typecheck | Limited network, no production credentials | Branches and commits as snapshots |
| **Orchestration** | Role definitions | Critic and auditor on a clean context | Tools scoped per role | `progress.md` and plans as handoff |
| **Hooks** | SessionStart injecting the current state | PostToolUse: format and lint | PreToolUse: gate on dangerous commands | Command log keyed by session |

## 9. Cost and limits

Cloud sessions draw on the same plan budget (5-hour window + weekly cap), in proportion to how many run at once. So:

- realistic parallelism: **2–3 sessions**, not ten;
- agent teams only for review and debate, not routine implementation;
- weekly auditor, not daily;
- every automation has a deliberate interval, not "as often as possible".

## 10. Out of scope (for now)

- A graphical "isometric agents" view: the system first, the visualisation maybe later. The session list on claude.ai/code and the app's notifications are enough to see who needs me.
- Agents deploying to production.
- Using the company laptop or network: the kit lives only on personal accounts and machines.

## 11. Open questions

To be settled along the way; each becomes an ADR:

- Reference test stack for frontend projects (Vitest + Playwright? jamly uses Jest + jest-expo).
- How often the resume scheduled task runs (every 1 or 2 hours?).
- How "I need you" reaches me (issue, PR comment, app notification).
- Which skills live at account level and which stay in the kit.
