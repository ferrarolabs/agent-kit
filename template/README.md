# template/

This is where the files the kit copies into every project go: `.claude/` (permissions, hooks, agents, skills, rules), `.github/` (issue templates, CI), a `CLAUDE.md` skeleton and the `docs/` folders.

Only what has worked on jamly goes in. Pieces are ported at every harness merge on jamly, and [docs/inventory.md](../docs/inventory.md) says where each one stands ([ADR 0014](../docs/decisions/0014-kit-aligned-at-every-harness-merge.md)). Each file here links the PR or issue where it was proven. The planned layout is in [PLAN.md](../docs/PLAN.md#final-layout-of-this-repo).

Until `sync-kit` exists, jamly holds the original. Don't change a file here directly: port the change from jamly.

## What's here, and where it was proven

| File | Proven | Notes |
|---|---|---|
| `CLAUDE.md.template` | [jamly PR 1](https://github.com/ferrarolabs/jamly/pull/1), [jamly PR 5](https://github.com/ferrarolabs/jamly/pull/5), [jamly PR 14](https://github.com/ferrarolabs/jamly/pull/14) | "Working as an agent" and the definition of done with who holds each line |
| `.claude/settings.json` | [jamly PR 1](https://github.com/ferrarolabs/jamly/pull/1), [jamly PR 5](https://github.com/ferrarolabs/jamly/pull/5) | Deny secrets, force-push, pushes to `dev`/`staging`/`main`, `rm -rf`; ask before editing workflows. A project adds its own irreversible commands. Run the [probe](../scripts/probe/README.md) after any change |
| `.github/workflows/ci.yml` | [jamly PR 1](https://github.com/ferrarolabs/jamly/pull/1), [jamly PR 15](https://github.com/ferrarolabs/jamly/pull/15) | Typecheck, lint, format, test; replace the commands |
| `.github/ISSUE_TEMPLATE/feature.yml`, `bug.yml` | [jamly PR 1](https://github.com/ferrarolabs/jamly/pull/1) | |
| `.github/labels.yml` | [jamly PR 1](https://github.com/ferrarolabs/jamly/pull/1) | No `priority:*` (ADR 0008); `needs:device-check` waits on [Decide: is "Device check" a generic Status?](https://github.com/ferrarolabs/agent-kit/issues/73) |
| `docs/decisions/README.md` | [jamly PR 1](https://github.com/ferrarolabs/jamly/pull/1) | The ADR convention |
| `docs/learn/README.md` | [jamly PR 17](https://github.com/ferrarolabs/jamly/pull/17) | The learn note format (ADR 0013) |

This table is where every file links its proof, so the files themselves stay free of any project's name. This README is the kit's, and is not copied into projects.
