# The `Review level` check

## The feature
A PR's review level (`green`, `yellow`, `red`) is now checked. Each time the agent writes it with `set.js`, a check run named `Review level` appears in the PR's *Checks* list:

```text
Review level — green · floor red      ✗
```

It fails when the level is missing or lower than the **floor**. The floor is `red` when the PR touches a harness path: `.claude/`, `account/`, `.github/`, `scripts/`, `template/` or any `CLAUDE.md`. Once the ruleset requires it, a harness change declared `green` can't merge.

## Why it is built this way
**The judgement is an agent's; the floor is a rule.** A function can't tell a typo from a rule change, but it can tell that a file is under `.claude/`. So the agent decides the level and the check enforces the minimum.

**Why an App, not the built-in token.** A check run made with Actions' built-in token comes from the app "GitHub Actions". Any workflow can post one, under any name. A PR could add `.github/workflows/x.yml` that posts a green `Review level`, and a ruleset requiring that name couldn't tell. A ruleset *can* require a check **from a specific App**. So the check is posted as `ferrarolabs-review-level`, and only the default branch can reach its key.

**How "only the default branch" is enforced.** The key sits in an *environment* whose deployment branch is the default branch. A job that names the environment gets its secrets only if its run's ref matches.
- `issue_comment` and `workflow_run` runs use the default branch's ref and the default branch's workflow file.
- A PR's own `pull_request` run uses `refs/pull/N/merge`, and the queue's `merge_group` run uses `gh-readonly-queue/…`. Neither matches, so neither gets the key.

**Why the comment is the trigger.** GitHub has no event for "an issue field changed". `set.js` already posts a marked comment, and a comment *is* an event. That needs no new access, unlike dispatching the workflow (`actions: write`). The comment carries no authority: the check re-reads the field and the files.

## How it is layered

```text
set.js ─▶ field + marked comment ──issue_comment──▶ review-level.yml (default branch's code, env: review-level)
                                                     ├─ mint App token (checks: write only)
                                                     └─ check.js: read field + files (Actions token) ─▶ verdict ─▶ POST check-runs (App token)
CI on gh-readonly-queue/** ──workflow_run──▶ same job, queue mode: first-parent merge commits ─▶ every PR ─▶ one group verdict
```

- **`lib.js`**, pure:
  - the field;
  - the comment format, with `comment()` and `parseComment()`;
  - globs to RegExp;
  - `redFiles`;
  - `verdict`, `groupVerdict` and `errorVerdict`;
  - the queue parsers.
- **`check.js`**: two modes, `comment` and `queue`. `read()` and `write()` are injected, so the tests use a fake GitHub.
- **`gh.js`**: the only network layer, `gh api` with an argument array.

## Concepts worth knowing
- **`pull_request_target` vs `issue_comment`.** Both run the default branch's workflow, but `pull_request_target` fires on opens and pushes, before a level exists. The comment fires when there is something to check.
- **Fail closed.** A head with no check can't merge once the check is required. A file list shorter than `changed_files` fails, because GitHub stops at 3,000 files and a red file could hide past that. A queue group that doesn't read as GitHub's merge commits fails too. Silence never passes.
- **A glob that matches the root.** `**/CLAUDE.md` must match `CLAUDE.md` itself. So `**/` becomes `(?:.*/)?` (zero or more directories), not `.*/`.
- **Scoping a token below its App.** `create-github-app-token` takes `permission-checks: write`, so this run's token can't do anything else, even if the App is later given more.
- **Untrusted text in a trusted place.** The quoted reason comes only from members' comments, and is shown as plain text in a code block with backticks removed.

## Decisions
- [ADR 0033](../decisions/0033-the-review-level-check.md): the App, the comment trigger, the floor, failing closed.
- [ADR 0032](../decisions/0032-the-review-level-is-the-prs-own-field.md): the PR's own field.

## Alternatives rejected
- The built-in token: forgeable.
- An org required workflow: needs the Team plan.
- Running on every push: it fails before a level exists, and the dispatch needs `actions: write`.
- A `yellow` floor for code: Elia chose `red` or nothing.

## What testing found
- A dry probe PR showed Actions' token can read the field and the file list, and post a check run with a custom title.
- 52 unit tests. Breaking each of 27 guards turned a test red, among them the glob anchors, the old-path rule, truncation, the queue chain, the token scope, a literal `main`, and `${{ }}` inside `run:`.
- `node --test <dir>` runs nothing here: pass the files (`*.test.js`).

## Where to look
- `.github/workflows/review-level.yml`, `.github/review-level-red.txt`.
- `scripts/review-level/lib.js`, `check.js`, and their tests.
