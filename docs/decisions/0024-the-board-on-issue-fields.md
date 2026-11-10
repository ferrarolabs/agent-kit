# 0024 · The board on issue fields: columns on Stage, Status aligned both ways, a private project

**Status:** accepted · 2026-11-08 (proposed 2026-11-06) · supersedes parts of [ADR 0007](0007-project-boards.md), keeps [ADR 0009](0009-issue-data-in-issue-fields.md)'s reconciler

## Context
The "Agent work" project template was designed before the [issue structure](../issue-structure.md) ([ADR 0022](0022-issue-structure-types-and-fields.md)). Its columns were Status, set from the agent labels, and it held its own number fields. The labels are gone: Stage, an issue field, carries whose turn it is.

GitHub's docs say issue fields can group, filter, sort and be a board's columns, like project fields ([board design §3](../project-boards.md#3-what-github-can-do-with-issue-fields)). Built-in workflows still set only Status, and Status can't be removed from a project.

Elia decided on [Define the project template's board](https://github.com/ferrarolabs/agent-kit/issues/140) ([plan v3](https://github.com/ferrarolabs/agent-kit/issues/140#issuecomment-6686741739)).

## Decision
- **The board's columns are Stage.** Every view, filter and chart uses issue fields and the issue type. The project has no field of its own except Status.
- **Five views:** Needs me, Flow, Stalled, Epics, Shipped ([board design §4](../project-boards.md#4-the-views)). An issue with no Stage shows in a triage group in Needs me.
- **On close**, the built-in workflow sets Status `Done` and the reconciler copies it to Stage; the reconciler also sets Stage `Done` on any closed issue itself.
- **Status is kept aligned with Stage, both ways**, by the reconciler every 10 minutes: the most recent change wins, and on a tie Stage wins (ADR 0009, unchanged). No view uses Status; it stays because it can't be removed and it shows in every issue's sidebar.
- **Built-in workflows:** auto-add issues and sub-issues, and *item closed → Done*. *Item added → Status* is off: through the reconciler it would overwrite Stage. No auto-archive.
- **Access:** the project is private, base role **No access**, with Elia as its only admin.
- **Automation reaches the project through one token, held only by Actions:** a fine-grained token with org Projects read and write, and Issues read and write. Agents start those Actions with `workflow_dispatch` and never hold it.
- **No job or script that holds the token writes `Ready`**, to Stage or Status. Only the owner sets `Ready`.
- **`Working` has a column limit of 1** while one agent session runs at a time.

## Supersedes
- **ADR 0007, decision 2:** "A GitHub Action … sets Status from the agent labels … Labels stay the source of truth." Now Stage is the source and the columns, and the reconciler aligns Status.
- **ADR 0007, decision 3, first bullet:** "the same labels in every repo". Already superseded by ADR 0022; this ADR adds that the views need nothing per repo, because issue fields are org-wide.
- **`scripts/projects/project-template.json`:** its `statusFromLabels`, its views and its workflows. Rewritten by [Configure the template once](https://github.com/ferrarolabs/agent-kit/issues/20).

ADR 0007's decisions 1, 3 (the hub later), 4 (metrics order) and 5 (as amended by ADR 0022) hold. ADR 0009 holds as is, including the reconciler and its rule.

## Consequences
- The reconciler ([its issue](https://github.com/ferrarolabs/agent-kit/issues/78)) is still needed, and gets its token and its rule from here.
- The [threat model](../threat-model.md) gains a line: the project token never writes `Ready`.
- Four hypotheses (T8–T11) are checked on the live template before the repo projects are copied from it. If Stage can't be a board column (T8), Flow becomes a table grouped by Stage and nothing else changes.
- jamly's [board page](https://github.com/ferrarolabs/jamly/blob/dev/docs/process/42-project-board.md) changes through the jamly-first port (ADR 0014).
- A hub, when it comes, needs an Action with the same token to add items: Free allows one auto-add per project.
