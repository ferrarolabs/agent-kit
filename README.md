# agent-kit

A harness that lets AI coding agents ([Claude Code](https://claude.com/claude-code)) build software on their own, for hours, while I keep the decisions that matter: what to build, how it's shaped, and what gets merged.

**Status:** Phase 1 of 6, foundations. Built on a real project first, [jamly](https://github.com/ferrarolabs/jamly), a mobile app for bands. See the [roadmap](docs/ROADMAP.md).

## The problem

An agent can write a feature. Left alone, it can also push to `main`, read a secret, skip a failing test, or stop at the first error with "it doesn't work". A sentence in a prompt only makes those less likely.

The model isn't mine to change. Everything around it is: the instructions it reads, the tools it may use, the checks it must pass, the limits it can't cross. That's the harness. **Agent = Model + Harness.**

## How it's built: three levels

A cloud session sees only what is committed to the repo it works on, plus what's on the account. So the kit lives at three levels:

| Level | Where | Holds |
|---|---|---|
| **Account** | `account/CLAUDE.md`, installed in every session | Rules that hold everywhere: recover before you escalate, own your PR to the end, ship a learn note |
| **Kit** | This repo, copied into each project | Permissions, hooks, CI, issue templates, labels: the generic parts |
| **Project** | The project's own repo | What only that project knows: its stack, its irreversible commands, its decisions |

## Four roles every piece plays

Each piece of the harness has one job:

- **Guide** tells the agent what to do. A short `CLAUDE.md`, a definition of done that says who checks each line.
- **Sensor** notices when something is wrong. CI, tests, and checks on the harness itself.
- **Boundary** stops what can't be undone, whatever the agent intends. Branch rulesets, deny rules, no production credentials in the cloud.
- **Record** keeps what happened. Decisions as ADRs, state in the repo, not in a chat.

The rule that ties them together: **irreversible things get a boundary, not an instruction.** A deny rule is a guardrail; the branch ruleset on GitHub is the boundary, because it holds even when the agent writes the command a new way.

## Evidence that the checks can fail

A check never seen red may not be wired up at all. So every one is made to fail once.

- **Branch protection.** On `dev`, `staging` and `main`: a direct push is rejected, a PR with red CI is blocked, a green one merges ([jamly: branch protection](https://github.com/ferrarolabs/jamly/issues/2)).
- **Push deny rules.** A probe ran one headless session per command: the first rules denied only 3 of 12 ways of pushing to a protected branch. The rewritten ones deny all 12, and still allow 4 feature branches whose names contain `dev` or `main` ([jamly PR 5](https://github.com/ferrarolabs/jamly/pull/5)).
- **Formatting.** Without a failing check, unformatted files went from 2 to 45 in a few days. CI now fails on them ([jamly PR 15](https://github.com/ferrarolabs/jamly/pull/15)).
- **Account rules reach the cloud.** A cloud session started with `account/CLAUDE.md` installed by the setup script loads it as its global instructions.

## How it works day to day

1. I write an issue and mark it ready.
2. An agent picks it up, works on a branch, opens a PR, and follows it until CI is green.
3. The PR carries a learn note: what was built, why, and the concepts behind it, so I understand the feature I own, not just approve it.
4. I review and merge. Promoting to `staging` and `main` is mine too.

The decisions behind each choice are in [docs/decisions/](docs/decisions/), one per file. Start with [agents propose, I decide](docs/decisions/0003-agents-propose-i-decide.md) and [agents recover before they escalate](docs/decisions/0010-agents-recover-before-they-escalate.md).

## Where to look

- [docs/PLAN.md](docs/PLAN.md): the target. Goal, principles, architecture, roles, boundaries.
- [docs/ROADMAP.md](docs/ROADMAP.md): six phases, each with an exit test. Long autonomy across usage limits and parallel agents come later; they aren't built yet.
- [docs/decisions/](docs/decisions/): why it's like this.
- [account/CLAUDE.md](account/CLAUDE.md): the rules every session gets.

## Licence
[MIT](LICENSE).
