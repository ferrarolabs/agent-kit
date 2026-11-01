# template/

This is where the files the kit copies into every project go: `.claude/` (permissions, hooks, agents, skills, rules), `.github/` (issue templates, CI), a `CLAUDE.md` skeleton and the `docs/` folders.

Only what has worked on jamly goes in. Pieces are ported at every harness merge on jamly, and [docs/inventory.md](../docs/inventory.md) says where each one stands ([ADR 0014](../docs/decisions/0014-kit-aligned-at-every-harness-merge.md)). Each file here links the PR or issue where it was proven. The planned layout is in [PLAN.md](../docs/PLAN.md#final-layout-of-this-repo).

Until `sync-kit` exists, jamly holds the original. Don't change a file here directly: port the change from jamly.
