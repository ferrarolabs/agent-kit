# 0022 · Issue structure: five types, five fields, labels only for area

**Status:** accepted · 2026-11-05 (proposed 2026-11-02) · supersedes parts of [ADR 0007](0007-project-boards.md) and [ADR 0009](0009-issue-data-in-issue-fields.md), keeps [ADR 0008](0008-numeric-priority-and-projects-from-the-template.md)

## Context
What an issue is made of grew one piece at a time: `type:*` labels, agent labels, org issue fields, project fields. [Labels as code](https://github.com/ferrarolabs/agent-kit/pull/133) was rejected because the labels themselves were never decided.

On 2026-11-02 Elia decided four things ([Define the issue structure](https://github.com/ferrarolabs/agent-kit/issues/139)):

1. the kind of work is an issue type, not a label;
2. agent ⇄ Elia communication is one issue field;
3. no project fields, except Status, mirrored with Stage;
4. the rest comes from research, not invention.

The research and its sources are in [issue-structure.md](../issue-structure.md).

## Decision
- **Five org issue types:** Feature, Task, Bug (GitHub's defaults, names kept), Epic and Decision. Hierarchy is sub-issues, not a type: there is no Sub-task.
- **Five org issue fields:**
  - **Stage**, single select: `Inbox`, `Ready`, `Working`, `Asking`, `In validation`, `Done`. It is ADR 0009's Stage, now with values. It replaces `agent:ready`, `agent:working`, `needs:elia` and `needs:device-check`. `needs:elia` splits in two: `Asking` when the agent is stuck, `In validation` when a complete PR waits for review. No value names a person.
  - **Priority**, number 1–100. Unchanged (ADR 0008, ADR 0018).
  - **Effort**, single select: `S`, `M`, `L`. `L` means split it into an Epic.
  - **Start date**, **Target date**: GitHub's defaults, optional, pinned to Epic only.
- **Required per type:** Stage and Priority on every type; Effort on Feature, Task and Bug.
- **Labels only for `area:*`**, which is multi-valued and per repo. Every other label goes (table in [issue-structure.md §5](../issue-structure.md#5-labels-whats-left)).
- **Issue forms set the type** with their `type:` key.
- **No field without a writer.** Cost $, Opus share % and Waited on me (h) are created with the metric that fills them.

## Supersedes
- **ADR 0007, decision 2**: "Status is set from the agent labels. Labels stay the source of truth." Now Stage, an issue field, is the source, and Status mirrors it (as ADR 0009 already proposed).
- **ADR 0007, decision 3, first bullet**: "the same labels in every repo". Now the same types and fields, which are org-wide by construction. Only `area:*` labels remain, and they may differ per repo.
- **ADR 0007, decision 5**: "One *Needs me* status: *In review* is folded into it." Now they are two values, `Asking` and `In validation`. Elia decided it on the PR: a stuck issue and an idle one waiting for his review are different queues.
- **ADR 0009, "Stage mirrors Status: the same values"**. The values are now Stage's own, defined here. Status takes them.
- **ADR 0009, the list of number fields**. Cost $, Opus share % and Waited on me (h) wait for their metric.

ADR 0008 holds as is, with one wording change: "agents take only `agent:ready` issues" now reads "issues with Stage `Ready`", once Stage exists.

## Consequences
- Answers [Decide: Effort values](https://github.com/ferrarolabs/agent-kit/issues/74) (S, M, L) and [Decide: is "Device check" a generic Status?](https://github.com/ferrarolabs/agent-kit/issues/73) (no: a device check is `In validation`).
- Makes [Action: keep project Status in step with labels](https://github.com/ferrarolabs/agent-kit/issues/19) obsolete. The [reconciler](https://github.com/ferrarolabs/agent-kit/issues/78) replaces it.
- [Migrate type labels to org issue types](https://github.com/ferrarolabs/agent-kit/issues/46) becomes the migration of every open issue.
- Until the migration runs, the labels stay and every rule that names them holds.
- Priority as a number diverges from every source read (all use bands). That is on purpose: ADR 0008.
- Five fields of 25 and five types of 25 leave room ([GitHub's limits](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization)).
