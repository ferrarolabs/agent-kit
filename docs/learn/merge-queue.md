# Learn — merge queue on `main`

> What [Decide: require PR branches to be up to date with main before merge?](https://github.com/ferrarolabs/agent-kit/issues/111) changed, and why. Decision: [ADR 0015](../decisions/0015-merge-through-a-merge-queue.md).

## The feature in one paragraph

A PR merges to `main` through a queue. Elia clicks "Merge when ready". GitHub tests the latest `main` plus the PR on a temporary branch. Only if that is green does `main` move. Two PRs that are green alone but red together can no longer break `main`.

## How it's layered

```text
main ruleset                    "Require merge queue" (a setting, Elia's)
└─ merge queue                  builds gh-readonly-queue/main/pr-<n>-<sha>
   └─ .github/workflows/ci.yml  on: merge_group  → runs the same job there
      └─ required check         "Docs, links, JSON, scripts" → green: main moves
```

## Concepts worth knowing

### 1. Green on a branch is green against an old `main`
CI on a PR tests the PR's merge with `main` as it was when the run started. If another PR lands afterwards, that result is stale. The PR 106 and PR 109 failure was exactly that: each was green, and the combination was never run.

### 2. The queue tests what will land
The queue makes the merge commit first, on a temporary branch, and runs CI on it. With several PRs queued, each is tested on top of the ones ahead of it. If one fails, it leaves the queue and the ones behind it are re-tested without it.

### 3. `merge_group` is a separate event
A workflow runs only on the events in its `on:` list. The queue's branch triggers `merge_group`, not `pull_request` or `push`. Without it in the list, the required check never reports and the queue waits forever.

```yaml
on:
  pull_request:
  push:
    branches: [main]
  merge_group:
```

### 4. Order matters
The trigger merges first, the setting comes after. Turning the queue on before `merge_group:` is on `main` would block every merge.

### 5. Conflicts are not the queue's job
The queue only merges cleanly or refuses. Whoever owns the PR merges `main` into it and resolves the conflict. For an agent's PR, that's the agent (ADR 0012).

## Alternatives rejected
- **"Require branches to be up to date"**: same safety, but an "Update branch" click and a wait every time `main` moves.
- **An agent that updates branches**: a session kept alive for something GitHub does on its own.

## What running it found
Nothing yet. This PR only adds the trigger. The queue is proven once Elia turns it on and a PR is seen leaving it on red.

## Where to look
- `.github/workflows/ci.yml`, the `on:` block
- [ADR 0015](../decisions/0015-merge-through-a-merge-queue.md)
- The `main` ruleset in the repo settings, once the queue is on
