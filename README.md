# agent-kit

A harness for AI coding agents ([Claude Code](https://claude.com/claude-code)). It lets agents build software unattended while a human keeps three decisions: what gets built, how it is shaped, and what gets merged.

## At a glance

| | |
|---|---|
| **Goal** | Agents work for hours on real issues; irreversible actions stay out of their reach |
| **Status** | Phase 1 of 6, foundations ([roadmap](docs/ROADMAP.md)) |
| **Pilot** | [jamly](https://github.com/ferrarolabs/jamly), a mobile app for bands. Each piece is built and proven there first, then ported here ([ADR 0001](docs/decisions/0001-separate-kit-piloted-on-jamly.md), [ADR 0014](docs/decisions/0014-kit-aligned-at-every-harness-merge.md)) |
| **Maintainer** | Elia Ferraro, solo |
| **Licence** | [MIT](LICENSE) |

## The problem

A coding agent can implement a feature. Unsupervised, it can also push to `main`, read a secret, skip a failing test, or stop at the first error. An instruction in a prompt makes these less likely. It does not prevent them.

The model is fixed. Everything around it can be designed: the instructions it reads, the tools it may use, the checks it must pass, the limits it cannot cross. That surrounding layer is the harness: **Agent = Model + Harness**.

## Design

### Three levels

A cloud session sees only what is committed to the repo it works on, plus what is installed on the account. The kit is split accordingly.

| Level | Location | Contents |
|---|---|---|
| **Account** | `account/CLAUDE.md`, installed in every session | Rules that apply everywhere: recover before escalating, own a PR to the end, ship a learn note |
| **Kit** | `template/` in this repo, copied into each project | Generic pieces: permissions, CI, issue templates, labels, the `CLAUDE.md` skeleton |
| **Project** | The project's own repo | What only that project knows: its stack, its irreversible commands, its decisions |

### Four roles

Every piece of the harness has exactly one role.

| Role | Purpose | Examples |
|---|---|---|
| **Guide** | Tells the agent what to do | A short `CLAUDE.md`; a definition of done that names who checks each line |
| **Sensor** | Detects that something is wrong | CI, tests, checks on the harness itself |
| **Boundary** | Stops what cannot be undone, regardless of intent | Branch rulesets, deny rules, no production credentials in the cloud |
| **Record** | Keeps what happened | ADRs, state in the repo rather than in a chat |

The governing principle: **irreversible actions get a boundary, not an instruction.** A deny rule is a guardrail. The GitHub branch ruleset is the boundary, because it holds even when the agent phrases a command a new way.

## Evidence

A check that has never failed may not be wired up. Each check below was made to fail at least once before it was counted.

| Check | Result | Proof |
|---|---|---|
| Branch protection on `dev`, `staging`, `main` | Direct push rejected; PR with red CI blocked; green PR merges | [jamly: branch protection](https://github.com/ferrarolabs/jamly/issues/2) |
| Push deny rules | First version denied 3 of 12 ways to push to a protected branch. Rewritten rules deny 12 of 12 and still allow 4 feature branches whose names contain `dev` or `main` | [jamly PR 5](https://github.com/ferrarolabs/jamly/pull/5) |
| Formatting in CI | Without a failing check, unformatted files grew from 2 to 45 in a few days. CI now fails on them | [jamly PR 15](https://github.com/ferrarolabs/jamly/pull/15) |
| This repo's CI | Markdown lint, links, JSON, scripts, unit tests. A deliberately broken link turned it red, then was reverted | [agent-kit PR 106](https://github.com/ferrarolabs/agent-kit/pull/106) |
| Account rules in the cloud | A cloud session with `account/CLAUDE.md` installed by the setup script loads it as global instructions | [roadmap, Phase 1](docs/ROADMAP.md#phase-1--foundations-on-jamly--in-progress) |

## Workflow

1. The maintainer writes an issue and marks it ready.
2. An agent picks it up, works on a branch, opens a PR, and follows it until CI is green.
3. The PR carries a learn note: what was built, why, and the concepts behind it. The maintainer owns the feature, not only the approval ([ADR 0013](docs/decisions/0013-every-feature-pr-ships-a-learn-note.md)).
4. The maintainer reviews and merges. Promotion to `staging` and `main` is also the maintainer's.

Agents propose; the maintainer decides ([ADR 0003](docs/decisions/0003-agents-propose-i-decide.md)). When an agent hits an error, it recovers before it escalates ([ADR 0010](docs/decisions/0010-agents-recover-before-they-escalate.md)).

## Not built yet

Planned in later phases of the [roadmap](docs/ROADMAP.md), not claimed here:

- Hooks that block an agent from finishing with red checks (Phase 2).
- Long autonomy across usage limits (Phase 3).
- Bootstrap and sync scripts, and a second project (Phase 4).
- Parallel agents (Phase 6).

## Repository map

| Path | Contents |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | The target: goal, principles, architecture, roles, boundaries |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Six phases, each with an exit test |
| [docs/decisions/](docs/decisions/) | Architecture decision records, one per file |
| [docs/inventory.md](docs/inventory.md) | Every harness piece on jamly and where it stands in the kit |
| [account/CLAUDE.md](account/CLAUDE.md) | The rules every session receives |
| [template/](template/) | The generic files copied into projects |
