# 0031 · A trivial small issue needs no plan verdict, and night runs pick them

**Status:** accepted · 2026-11-19 · from [Night picks: an agent implements trivial small issues between 00:30 and 05:00](https://github.com/ferrarolabs/agent-kit/issues/188). Narrows [ADR 0023](0023-the-work-flow-from-an-idea-to-a-pr.md) (points 3, 4, 6 and 8) and [ADR 0018](0018-agents-set-the-priority-of-the-issues-they-open.md) (which issues agents take). Part 1 holds now. Part 2 takes effect when that issue merges.

## Context
The work flow needs the owner twice before any code: Stage `Ready`, then the plan verdict. ADR 0023 says "the plan verdict and the PR are never skipped". For an issue whose body already says exactly what to do, the verdict adds nothing. It only makes the owner act once more.

That cost is why small, low-priority issues never get done. Bigger work always passes them, so they stay open for good. Agent capacity at night is unused.

The owner's usage is the constraint at night. A usage window lasts 5 hours from its first message. Night work must never leave a window open into the day.

Elia decided both parts on 2026-11-19, while [Night picks](https://github.com/ferrarolabs/agent-kit/issues/188) was written.

## Decision

### Part 1 · Trivial small issues, in every session
1. **One reviewer decides if an issue is trivial.** It applies to an issue with Effort `S`. An agent on a clean context reads the issue body and the repo's `CLAUDE.md`. It answers one question: is the issue trivial, meaning the body already says exactly what to do, with no choice left to make? It gives the reason.
2. **On yes, the reviewer also sets the Review level**, by the floor of [work flow §2.3](../guides/work-flow.md#23-the-review-level). No other agent sets it, and no agent re-checks it on the PR. This narrows ADR 0023 point 4 for these issues.
3. **On yes, there is no plan verdict.** The agent posts its plan on the issue as a record, does not set `Asking`, and implements. There are no refuters and no separate e2e agent. This narrows ADR 0023 points 3 and 8.
4. **On no, or with no Effort `S`**, the full flow of ADR 0023 holds.
5. **Review level does not filter.** A trivial issue may be `green`, `yellow` or `red`. The owner reviews the PR as the level says. No agent merges ([PLAN principle 7](../PLAN.md#2-principles)).
6. **What does not change**: an agent still starts only on `Ready`, or on an issue the owner names. The PR is still complete, follows the template, and states its Review level and the reviewer's reason. If the work turns out to need a choice the body doesn't settle, the agent stops and goes back to the full flow: plan comment, `Asking`.

### Part 2 · Night picks
7. **A night run may take an `Inbox` issue** with Effort `S`, type Feature, Bug or Task, and no open "blocked by". It runs Part 1's reviewer on each. On yes it implements. ADR 0018's "agents take only ready issues" still holds for every other session.
8. **A "no" is remembered.** The run posts a `night-skip` comment with the reason. The issue is skipped until its body is edited, or a comment is added or edited.
9. **Night picks stop without `Asking`.** An unfinished pick stays `Working`, and the next night run resumes it from the issue. A pick that turns out to need a choice goes back to `Inbox` with a `night-skip` comment. This narrows ADR 0023 point 6 for night picks.
10. **No night window reaches 10:00.** The night config sets the time windows must close by (10:00). The hard stop is 5 hours earlier (05:00). Runs fire hourly from 00:30, and none spends a token after the hard stop.
11. **One config, at org level.** The window belongs to the owner's account, not to a repo. Each repo only opts in.

## Alternatives rejected
- **Keep the plan verdict for every issue.** The owner acts twice per small issue, which is why these issues never move.
- **Skip the verdict only at night.** Elia: a trivial small issue needs no approval, whoever takes it.
- **Only Review level `green`.** Elia: triviality and size are the filter, not the level. A red PR is still reviewed in full.
- **Two reviewers, or a separate agent for the level.** Elia: one reviewer is enough for a trivial issue.
- **A text checklist or a size limit.** Elia: the reviewer decides.
- **Per-repo night hours.** Every repo spends the same account's usage, so per-repo hours could add up into the morning.
- **Night runs until 08:00.** A run at 07:30 would keep a window open until 12:30.

## Consequences
- For a trivial small issue, the owner acts twice: `Ready`, then the merge. A night pick needs only the merge.
- An agent may edit harness, CI or deny-rule files with no plan approved, when the issue is trivial. The `red` level and the owner's review of the code are the guard.
- One reviewer call per `S` issue costs a little usage, and saves a full round trip to the owner.
- [The threat model](../threat-model.md) relies on "Stage is always `Inbox`, so an injected sentence can't put work in front of an agent". Part 2 breaks that: an `Inbox` body becomes work. The threat model must be updated before night picks run, as part of [Night picks](https://github.com/ferrarolabs/agent-kit/issues/188).
- Part 1 is in the [work flow guide §3](../guides/work-flow.md#3-proportionality), `docs/PLAN.md` §5, and the work-flow rules of `CLAUDE.md` and `account/CLAUDE.md`. Part 2 joins them in the night-picks PR.
- jamly's and `template/`'s copies of the rules follow by port ([ADR 0014](0014-kit-aligned-at-every-harness-merge.md)).
