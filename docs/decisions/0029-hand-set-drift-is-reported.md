# 0029 · What only the UI can set is reported, workflows included

**Status:** accepted · 2026-11-18 · from [Detect drift in what the API can't set](https://github.com/ferrarolabs/agent-kit/issues/67). Supersedes one bullet of [ADR 0027](0027-the-sync-is-additive.md): "What only the UI can set … is shown in the run summary, not fixed and not reported."

## Context
The nightly sync already read each view's group, sort and column field and compared them with the spec. A difference went only to the run summary, which nobody reads. Workflows were not read at all. The API reads a workflow's name and whether it is on. It doesn't read its target value or auto-add's filter, and it doesn't list four of the UI's workflows ([run 44387184676](https://github.com/ferrarolabs/agent-kit/actions/runs/44387184676)).

## Decision
- **The reference is the spec**, not the template board. The template is one more board compared with it.
- **Workflows are in the spec as data**: `workflowStates` in `scripts/projects/project-template.json`, on or off for the template and for repo boards. A workflow the API doesn't list counts as off.
- **Each result line has a kind, set where it is compared**: `drift` (the sync should have fixed it), `manual` (only the UI can set it), `spec` (GitHub has a workflow the spec doesn't know). The kind is never read from the message, because the message holds names a board controls.
- **`manual` lines are reported** in the existing report issue, under "To do by hand": one plain sentence, from the spec only, and a link to the view or to the board's workflows. The same click on several boards is one line. `spec` lines have their own section: fix the spec by PR.
- **A difference on purpose is a spec change.** There is no per-board exception: repo views are "on top, never instead" ([board design §4](../project-boards.md#4-the-views)).
- **Board-controlled names reach the issue only escaped**: one line, no backticks, at most 64 characters, in a code span. The report has at most 80 lines.
- **A workflow's target value is an accepted risk.** The API can't read it. The guard against a `Ready` set by a workflow is [its own issue](https://github.com/ferrarolabs/agent-kit/issues/182).

## Consequences
- A sort changed by hand is in the report issue the next morning, with the link to fix it. The issue closes on the first run after it is fixed.
- A board kept different from the spec keeps the issue open. That is the point: the spec says what every board is.
- A GitHub rename of a workflow opens the issue until the spec is updated.
- `enabled: true` doesn't prove a workflow works: after Status's options change, "Item closed" shows a red ! until re-saved. The sync's existing re-save action stays the signal for that.
