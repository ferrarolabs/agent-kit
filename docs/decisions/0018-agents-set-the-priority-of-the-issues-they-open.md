# 0018 · Agents set the priority of the issues they open

**Status:** accepted · 2026-11-01 · amends [ADR 0008](0008-numeric-priority-and-projects-from-the-template.md) on *who* sets Priority

## Context
[ADR 0008](0008-numeric-priority-and-projects-from-the-template.md) says every open issue has a Priority from 1 to 100, with a rationale. It also says agents don't need priority, and issues written by agents ended with "**Priority**: not set. Elia to score it."

So new issues waited for Elia to score them, and some never were: on 2026-11-01 ten open issues had none. An unscored issue sorts nowhere in the views. Elia asked (2026-11-01) for agents to pre-set the value; he changes it when he disagrees.

## Decision
- **The agent that opens an issue sets its Priority**, calibrated against the open issues' values, and writes the reason on the issue's last line.
- **Elia adjusts.** A value he changed is his: an agent doesn't move it back.
- **An open issue found without a Priority gets one** the same way, and the agent says so.
- The rule lives in `account/CLAUDE.md`, so it holds in every repo that has the field.

ADR 0008 still holds for the rest: agents don't use priority to pick their work, they take only `agent:ready` issues.

## Consequences
- Every new issue sorts in the views from the moment it exists.
- Elia's work moves from scoring every issue to correcting the ones he disagrees with.
- An agent's value can be wrong. The reason on the last line makes it quick to judge.
- First applied on 2026-11-01: the ten unscored issues in agent-kit were set, from 3 to 70.
