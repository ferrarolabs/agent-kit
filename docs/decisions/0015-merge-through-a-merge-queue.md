# 0015 · Merge to `main` through a merge queue

**Status:** accepted · 2026-11-01

## Context
[PR 109](https://github.com/ferrarolabs/agent-kit/pull/109) and [PR 106](https://github.com/ferrarolabs/agent-kit/pull/106) were each green, and both merged. Together they turned `main` red. PR 109 added a link to a file that doesn't exist. PR 106 added the check that catches it. Each PR's CI had run against a `main` without the other. [PR 110](https://github.com/ferrarolabs/agent-kit/pull/110) fixed it.

A green PR only proves that it passes against the `main` it was branched from. Elia wants every PR tested against the latest `main` before it lands ([Decide: require PR branches to be up to date with main before merge?](https://github.com/ferrarolabs/agent-kit/issues/111)). Nothing should have to guess when he means to merge.

## Decision
`main` is merged through GitHub's **merge queue**.

- Elia clicks "Merge when ready". That click is the signal.
- GitHub builds a temporary `gh-readonly-queue/main/...` branch with the latest `main` plus the PR, and CI runs on it. If CI is green, `main` moves to that commit. If it's red, the PR leaves the queue and `main` stays as it was.
- The PR branch is never changed.
- CI runs on the `merge_group` event, so the queue gets its check.
- GitHub never resolves conflicts. A conflicting PR can't enter the queue, and one that starts conflicting with a PR ahead of it is taken out of the queue. The PR's owner resolves it. For an agent's PR, that's the agent ([ADR 0012](0012-agents-own-their-pr-to-the-end.md)).

Merging stays Elia's ([ADR 0003](0003-agents-propose-i-decide.md)).

## Alternatives rejected
- **"Require branches to be up to date before merging."** It blocks a PR whose branch is behind and shows "Update branch". Every PR merged after another needs an extra click and a wait before the merge.
- **An agent that watches for "branch behind" and merges `main` in.** It needs a session kept alive for a job GitHub does natively, which costs usage.

## Consequences
- `main` holds only commits whose CI passed on exactly what landed.
- A merge takes one CI run longer, about 15 seconds here.
- Turning the queue on is a ruleset setting, so it's Elia's. It must come after `merge_group:` is on `main`. Otherwise the queue waits for a check that never runs.
- The queue is proven once a PR is seen leaving it on red CI and `main` stays green.
- Later, not decided here: a failed queue run could label the PR automatically, and an agent would then fix it and re-queue it. Tracked on the same issue.
- jamly's `dev` should get the same setup, in its own PR.
