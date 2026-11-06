# 0008 · Priority is a number from 1 to 100; projects only come from the template

**Status:** accepted · 2026-10-31

## Context
Priority started as `priority:now|next|later` labels, then as the org's single-select Priority field (Urgent, High, Medium, Low). With 60+ issues, four levels leave fifteen issues tied, and the order between them lives only in someone's head.

The first Jamly and agent-kit projects were built by script before the org template existed, so they had no sorts, grouping or workflows, and were not copies of anything.

## Decision
- **Priority is the org issue field `Priority`, a number from 1 to 100**, 100 = do first. Every open issue has one, spread over the whole scale, with a rationale stored on the value. There are no bands and no `priority:*` labels.
- Agents don't need priority: they take only `agent:ready` issues, and Elia decides which issues become ready, in priority order. Order among issues is the number plus the native "blocked by" dependencies.
- **Repo projects are created only as copies of the finished org template** ("Agent work"). The two early projects were deleted; Status is derived from labels, so nothing was lost.

## Consequences
- Views sort by Priority descending. "Ready for agents" also excludes blocked issues.
- New issues get a score between their neighbours, then the scale is re-spread when it gets crowded.
- `labels.yml` (jamly, and the kit's shared one) drops `priority:*`.
- The template must be finalised by hand before any repo project exists.

## Later
- 2026-11-05: "they take only `agent:ready` issues" now reads Stage `Ready` ([ADR 0022](0022-issue-structure-types-and-fields.md)). The rest holds.
