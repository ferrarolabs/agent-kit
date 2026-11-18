# 0027 · The project sync is additive, and finds boards by number

**Status:** accepted · 2026-11-16 · from [Boards follow the spec every night](https://github.com/ferrarolabs/agent-kit/issues/175), part of [Project sync](https://github.com/ferrarolabs/agent-kit/issues/66)

## Context
A board is copied from the spec once. After that, spec changes don't reach it, and hand edits stay. On 2026-10-30 a script that replaced Status's options wiped every card's Status. Deleting a field or a view deletes its data the same way.

## Decision
- **A job keeps every board in line with the spec**: on every push to `main` that touches the project scripts, and every night at 03:17 UTC. The boards are listed in `scripts/projects/projects.json`.
- **It adds and fixes, never deletes.** Views, filters, visible fields and issue fields are created or corrected. Nothing is removed. Pruning stays a one-off, by hand, on the template.
- **It never touches Status's options** and never adds items. Status is [its own piece](https://github.com/ferrarolabs/agent-kit/issues/176); items are auto-add's job, later the [reconciler](https://github.com/ferrarolabs/agent-kit/issues/78)'s.
- **A board is found by its number, never by title, and never created again.** A board that can't be found is reported.
- **What only the UI can set** (group, sort, column field) is shown in the run summary, not fixed and not reported. *Superseded by [ADR 0029](0029-hand-set-drift-is-reported.md): it is reported, workflows included.*
- **One report issue** says what needs Elia: errors, missing boards, differences the sync could not fix. It comments only when that list changes, and closes itself when a run finds nothing. The run goes red only on an error.
- A repo's `.github/project-extra-views.json` is read from its default branch every night, and passes a schema before use.

## Consequences
- A spec change reaches every board in one run, and a hand edit lasts at most a day.
- Removing a view from the spec leaves it on the boards. A removal is a human step.
- A new board is added to the registry by PR: the Action can't commit to `main`.
- A broken token makes every night red until fixed. That is the one failure that should be loud.
