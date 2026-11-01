# Roadmap

Each phase is useful on its own and has a verifiable **exit criterion**. We don't move to the next phase until it's met. The pilot is **jamly**: pieces are built there, and the generic ones are ported into this repo at every harness merge (ADR 0014). Phase 4 adds the scripts and a second project.

## Phase 0 · Plan ✅
- [x] Goal, principles and architecture in [PLAN.md](PLAN.md)
- [x] First decisions in [decisions/](decisions/)

**Exit:** the plan is written and approved by me.

## Phase 1 · Foundations (on jamly) — in progress
- [x] jamly's `CLAUDE.md` written as a short contract, with the definition of done and who holds each line ([jamly#1](https://github.com/ferrarolabs/jamly/pull/1))
- [x] Permissions in `.claude/settings.json`: deny secrets and irreversible commands ([jamly#1](https://github.com/ferrarolabs/jamly/pull/1))
- [x] CI on GitHub Actions: test, lint, typecheck, on pushes to every long-lived branch ([jamly#1](https://github.com/ferrarolabs/jamly/pull/1))
- [x] Issue templates: feature and bug ([jamly#1](https://github.com/ferrarolabs/jamly/pull/1))
- [x] Labels as code and a project board spec: labels carry the agent workflow, the Project is for planning ([jamly#1](https://github.com/ferrarolabs/jamly/pull/1))
- [x] One project template, built and checked by `scripts/projects/build-project.js` ([board design](project-boards.md), ADR 0007): the org template [Agent work](https://github.com/orgs/ferrarolabs/projects/3). Its `--check` mode was seen failing on a hand-edited filter
- [ ] Template finalised by hand (sorts, grouping, workflows), then the repo projects created as copies of it (ADR 0008)
- [ ] Board views: group-by, sort and workflows set by hand (the API can't)
- [ ] Action that sets Status from labels (ADR 0007)
- [ ] Issue data in org issue fields; Stage mirrored with Status by a [10-minute reconciler](https://github.com/ferrarolabs/agent-kit/issues/78) (ADR 0009, proposed). Cloud sessions [can read and set them](https://github.com/ferrarolabs/agent-kit/issues/24); Stage will [replace the agent labels](https://github.com/ferrarolabs/agent-kit/issues/82)
- [x] Claude GitHub App on the `ferrarolabs` org, all repos: a cloud session pushed a branch and opened a PR (2026-10-31)
- [x] [`gh` working in cloud sessions](https://github.com/ferrarolabs/agent-kit/issues/70) with an org token: REST only; GraphQL and org paths are blocked, so project scripts go through [an Action](https://github.com/ferrarolabs/agent-kit/issues/83)
- [x] Branch protection on `dev`, `staging`, `main`: PR + green CI required. Proven: a direct push is rejected, a red PR is blocked, a green one merges ([jamly#2](https://github.com/ferrarolabs/jamly/issues/2))
- [ ] [Merge queue on `main`](https://github.com/ferrarolabs/agent-kit/issues/111) (ADR 0015): CI runs on `merge_group`. Proven once a PR leaves the queue on red and `main` stays green
- [x] Push deny rules probed: 12 ways to push to a protected branch denied, feature branches allowed ([jamly#5](https://github.com/ferrarolabs/jamly/pull/5)). The probe is now a kit script, [scripts/probe/](../scripts/probe/README.md): its first run found `--force-with-lease` not denied
- [x] Repos public (rulesets need it on Free), under the `ferrarolabs` organization (ADR 0005, ADR 0006)
- [x] Agents recover before they escalate (ADR 0010): in this repo's `CLAUDE.md` and in `account/CLAUDE.md`
- [ ] [Agents own their PR to the end](https://github.com/ferrarolabs/agent-kit/issues/89) (ADR 0012): rule written in `account/CLAUDE.md` and this repo's `CLAUDE.md`. Checked once a session subscribes to its PR unasked
- [ ] [Every feature PR ships a learn note](https://github.com/ferrarolabs/agent-kit/issues/91) (ADR 0013): rule written in `account/CLAUDE.md`. Checked once Elia says the format works on a note he didn't ask for
- [x] `account/CLAUDE.md` installed by the cloud setup script (2026-10-31). A session started with the file in `~/.claude/` loads it as global instructions
- [ ] [Org first, then sync](https://github.com/ferrarolabs/agent-kit/issues/85): settings at org level, the rest synced from agent-kit (ADR 0011, proposed)
- [ ] Cloud environment configured: setup script, network allowlist (`*.supabase.co` allowed), no Supabase secret keys. Until real users, the live project's URL, publishable key and a test account are allowed for agent tests (ADR 0016)
- [x] [Kit aligned with jamly at every harness merge](https://github.com/ferrarolabs/agent-kit/issues/101) (ADR 0014): [inventory](inventory.md) of every harness piece on jamly
- [x] [Sessions open from the repo root](https://github.com/ferrarolabs/agent-kit/issues/3): [guide](guides/open-sessions-from-the-repo-root.md), proven by a headless probe. Multi-repo cloud sessions [load no project deny rules](https://github.com/ferrarolabs/agent-kit/issues/103)
- [ ] [Account deny floor](https://github.com/ferrarolabs/agent-kit/issues/103) (ADR 0017): `account/settings.json` and a SessionStart hook, installed by `account/install.sh`. Probed: 19 of 19 push cases and `rm -rf` denied with only the floor loaded. Checked once the setup script runs the installer and a two-repo cloud session denies `rm -rf` and says the project rules didn't load

**Exit:** a real issue implemented by a cloud session started from my phone, with a PR and green CI, without me writing code.

## Phase 2 · Sensors
- [ ] `verify-done` skill: runs every machine-checkable line of the definition of done and reports one row per line
- [ ] Stop hook that refuses to finish with red tests, lint or typecheck, and sends back the real error
- [ ] PostToolUse hook: format and lint on changed files
- [ ] `critic` subagent
- [ ] Every hook made to fail on purpose once

**Exit:** I've watched an agent try to finish with a red test, get blocked, and fix it on its own.

## Phase 3 · Long autonomy
- [ ] `docs/progress.md` convention
- [ ] Idempotent `resume-work` skill
- [ ] Cloud scheduled task that resumes work
- [ ] "I need you" signal when the agent is blocked
- [ ] [An agent starts on its own](https://github.com/ferrarolabs/agent-kit/issues/76) when an issue gets `agent:ready`
- [ ] Command log (Record column)

**Exit:** a feature moves forward for 24 hours without me, across at least one usage limit.

## Phase 4 · Extraction into the kit
- [ ] Split jamly's generic files from its project-specific ones: done along the way in the [inventory](inventory.md) (ADR 0014)
- [ ] Fill `template/` in this repo, including the generic labels (type, agent state) and the board spec: done along the way, one port per harness merge (ADR 0014)
- [ ] `scripts/bootstrap.sh` and `scripts/sync-kit.sh`
- [ ] Account-level skills: `write-spec`, `critic`, `explain-feature`
- [ ] This repo set up as a GitHub template repository

**Exit:** a second project set up with the kit in under 30 minutes, and a kit update propagated to jamly with the script.

## Phase 5 · Continuous quality
- [ ] `explainer` subagent and `docs/learn/`
- [ ] Weekly codebase auditor, one theme at a time, at most 5 issues
- [ ] Harness eval set: 10 tasks in `evals/` drawn from real failures
- [ ] Every recurring agent mistake becomes a rule, a hook or an eval task

**Exit:** a month of auditor issues triaged, and the eval set running on every change to the kit.

## Phase 6 · Parallelism
- [ ] 2–3 sessions in parallel on different areas of the code
- [ ] PR auto-fix
- [ ] Agent teams for review and debate on hard decisions
- [ ] (Optional) a view of what the agents are doing

**Exit:** a week with several features moving in parallel, with no conflicts between branches.
