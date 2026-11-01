# 0014 · The kit is aligned with the pilot at every harness merge

**Status:** accepted · 2026-11-01 · supersedes [ADR 0001](0001-separate-kit-piloted-on-jamly.md) on *when* extraction happens

## Context
[ADR 0001](0001-separate-kit-piloted-on-jamly.md) builds every piece on jamly first and extracts the generic ones into `template/` in Phase 4.

Two days into Phase 1, jamly already holds many harness pieces the kit doesn't record: deny rules, CI, issue templates, labels, the "Working as an agent" contract. One is already lost. The probe that proved [12 ways to push to a protected branch denied](https://github.com/ferrarolabs/jamly/pull/5) ran in a session and was never committed. Its result lives in a PR description; the script is gone.

Waiting for Phase 4 means rebuilding from memory. Elia asked for the kit to follow the pilot as it changes (2026-11-01).

Copying every change at once has its own cost. With no sync script yet, two copies of the same file have no rule for which one is right, and they drift.

## Decision
- **An inventory in the kit.** [docs/inventory.md](../inventory.md) lists every harness piece on jamly: generic or jamly-only, proven or not, and its target in `template/`. Nothing on the pilot is unknown to the kit, even before it is ready.
- **Alignment at every harness merge.** When a PR on jamly that changes how agents work (`area:harness`) merges, the agent that owns it opens the matching PR in agent-kit: the generic part goes into `template/`, and the inventory row is updated. Same work, two repos, one flow.
- **Proven means merged, and seen failing once** where it is a check. Only proven pieces enter `template/`. That part of ADR 0001 stands.
- **Who holds the original.** jamly holds it until `sync-kit` exists. From then on the kit does, and changes flow kit → projects.
- **Each file in `template/` links the PR or issue where it was proven.**

The rest of ADR 0001 holds: a separate kit repo, piloted on a real project.

## Consequences
- Phase 4 shrinks. Splitting files and filling `template/` happen along the way; Phase 4 keeps the scripts (`bootstrap`, `sync-kit`) and the second project.
- Every harness PR on jamly costs a second small PR in agent-kit.
- A template copy can lag jamly by one merge. The inventory says when it does.
- Until `sync-kit` exists, a change made directly in `template/` is a mistake: it is overwritten by the next port from jamly.
