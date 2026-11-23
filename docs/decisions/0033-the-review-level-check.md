# 0033 · The `Review level` check: posted by an App, started by the level's comment

**Status:** accepted · 2026-11-23 · from [Review-level check](https://github.com/ferrarolabs/agent-kit/issues/153). Builds on [ADR 0032](0032-the-review-level-is-the-prs-own-field.md) and step 2.7 of [ADR 0023](0023-the-work-flow-from-an-idea-to-a-pr.md).

## Context
Every agent PR carries its review level in its own `Review level` field (ADR 0032). An agent judging its own work tends to say `green`, and nothing checked it. Elia decided the open points on the issue, 2026-11-23:
- the floor is `red` or nothing;
- the check is required;
- it targets the default branch;
- it is posted by a dedicated App;
- it runs only when the level is written.

Three facts shaped the design:
- A check made with Actions' built-in token comes from the app "GitHub Actions". **Any** workflow in the repo can post one with the same name. So a PR could add a workflow that posts a passing `Review level`.
- In the merge queue, GitHub runs the workflows of the merge commit, which holds the PR's changes.
- An org ruleset that requires a workflow pinned to `main` would close both, but it needs the Team plan. ferrarolabs is on Free.

## Decision
- **A check run `Review level`, posted as the App `ferrarolabs-review-level`.** It shows the level and the floor in its title, for example `green · floor red`. Its summary lists the files that set the floor and quotes the reason. The ruleset requires `Review level` **from that App**, so a look-alike from GitHub Actions doesn't count.
- **The App's key sits in the environment `review-level`**, whose only deployment branch is the default branch. A job gets it only when its run's ref is the default branch. Each run mints a token scoped to `checks: write` alone, whatever the App holds. Setup: [Create the Review-level GitHub App and its environment](https://github.com/ferrarolabs/agent-kit/issues/198).
- **It runs on the default branch's code only, on two events:**
  - `issue_comment`: a marked comment (`<!-- review-level -->`) from an `OWNER`, `MEMBER` or `COLLABORATOR`. `set.js` posts one on every run. The comment is only a signal: the field and the files are re-read from GitHub.
  - `workflow_run`: CI finished on a `gh-readonly-queue/**` commit. The queue's own `merge_group` run is never trusted with the key.

  Nothing runs when a PR opens or a push arrives. A head with no `Review level` can't merge once the check is required, so it fails closed. The agent runs `set.js` again after each push.
- **The floor is `red` or nothing.** It is `red` when a file, by its new path or its old one, matches a glob in `.github/review-level-red.txt`: `.claude/**`, `account/**`, `.github/**`, `scripts/**`, `template/**`, `**/CLAUDE.md`. The list is under `.github/**`, so editing it is red. Code outside those paths can be `green` (Elia).
- **Only PRs into the default branch.** That is `dev` in the projects, where features land, and `main` here. Promotion PRs (`dev` → `staging` → `main`) only deploy what was reviewed, so they aren't checked.
- **It fails closed.** These all fail the check:
  - a missing level;
  - a level under the floor;
  - a file list shorter than the PR's `changed_files`, or at GitHub's cap of 3,000;
  - an unknown value;
  - any read error;
  - a queue group it can't explain.
- **The queue group is the first-parent chain of GitHub's merge commits** from the head to the merge base. It holds at most 5 entries, the ruleset's `max_entries_to_merge`. Each entry must read `Merge pull request #N from …`, and the newest must match the `pr-N` in the queue branch. Every PR in the group is checked, and one under its floor fails the group, named in the title.
- **It never runs the PR's code.** It does a sparse checkout of the default branch's `scripts/review-level/` and the red list, with no persisted credentials. Event values reach the script only through `env`, and are validated. Actions are pinned by commit SHA. Reads use Actions' token, with three read permissions. The only write is the check run, made with the App token.
- **`scripts/review-level/lib.js` holds what the writer and the grader share**: the field, the levels, the comment format, the floor and the verdicts. It is pure. `gh.js` is the only network layer.

## Limits, said plainly
- **The boundary is the environment's branch rule**, a repo setting. If it lets another branch in, a PR's workflow could mint the App token. The rule is tested live (a run from another ref must be refused), and must be re-checked whenever the environment changes.
- **"Set by the independent agent" stays a rule.** The check sees the value, not who wrote it. It guarantees the floor, not the judgement above it.
- **The queue logic relies on GitHub's merge commit message and on `MERGE` as the merge method.** If either changes, the check fails closed and the queue stops, rather than passing.
- **Each run takes the environment**, so it may add a deployment entry to the PR's timeline.

## Alternatives rejected
- **Actions' built-in token as the poster.** It can be forged by any workflow (the first fact above).
- **The Team plan and an org required workflow.** It is cleaner, but it is paid.
- **Accepting the gap.** Offered as option A; Elia chose the App.
- **Running on every push and PR open, plus a dispatch from `set.js` after it writes the field.** Before a level exists, every run just fails. The dispatch needed `actions: write`, a use that can also cancel or re-run other workflows. The comment needs no new access.
- **A `yellow` floor for code.** Rejected by Elia: well-tested code can be `green`.
- **Checking promotion PRs.** They only deploy what was already reviewed in `dev`.

## Consequences
- After this merges, the check shows on every PR but blocks nothing. It is proven live on test PRs. Then Elia requires `Review level`, from the App, in the default branch's ruleset. Then the queue and the forgery case are proven.
- Every push needs a new `set.js` run before merging.
- jamly and other repos get the check through [Every org repo follows agent-kit](https://github.com/ferrarolabs/agent-kit/issues/85). Each needs the App installed and its own `review-level` environment on its default branch.
- Renaming the workflow `CI` breaks the queue's check, so it fails closed. A test ties the two names together.
