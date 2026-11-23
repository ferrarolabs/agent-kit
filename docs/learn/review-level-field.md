# The review level as the PR's own field

## The feature
Every agent PR carries a review level: `green` (the owner merges without reading), `yellow` (he reads the description) or `red` (he reviews the code). Until now it was a line in the PR description. Now it is the PR's own `Review level` issue field, the same field the issues use. An independent agent decides the level. One script, `scripts/review-level/set.js`, writes it and posts a comment that shows it:

```sh
echo "Touches CLAUDE.md and account/CLAUDE.md: harness rules." | node scripts/review-level/set.js 196 red
# ferrarolabs/agent-kit#196 yellow -> red https://github.com/ferrarolabs/agent-kit/pull/196#issuecomment-…
```

## Why a field, and why a script
A line in a description is prose: nothing can read it reliably, and nothing fails when it is missing. A field has a fixed set of values, so the coming `Review level` check run can read it and fail when it is under the floor.

**Issue fields on PRs are undocumented.** GitHub's docs say issue fields "only apply to issues", but a PR is an issue underneath: it shares the issue number and the `repos/{owner}/{repo}/issues/{n}` endpoints. The REST call `POST …/issues/{pr}/issue-field-values` stores the field and reads it back. The PR page doesn't show it, so the comment is where the owner reads it for now.

**Why not let the agent call the API itself?** The same endpoint writes **every** org field, `Stage` included, and `Stage` `Ready` is the owner's alone. A one-purpose script narrows what agents are told to run. It can write one field, three values, on an open PR of its own repo. It's a narrowing, not a guard: raw `gh api` still works. [ADR 0032](../decisions/0032-the-review-level-is-the-prs-own-field.md) says so, and [a decision issue](https://github.com/ferrarolabs/agent-kit/issues/194) asks whether the deny rules should stop it.

**Why an agent still decides.** A function can compute the *floor* from the files touched: anything in `.claude/`, `account/` or CI is `red`. It can't tell a typo fix (`green`) from a doc that changes a rule (`yellow`). So the judgement is an agent's, and the write is deterministic.

## How it is layered

```text
stdin reason ─┐
pr, level ────┴─▶ checkInput ─▶ GET pulls/{pr} (open?) ─▶ GET field ─▶ POST field ─▶ GET field (read-back = level?)
                                                                                          │ no → exit 1, no comment
                                                                                          ▼ yes
                                            latest marked comment by me shows it? ─▶ yes → done, nothing new
                                                                                    no  → POST comment (from the read-back)
```

- **`setReviewLevel({ pr, level, reason, repo, api })`** is the logic. `api` is injected, so the tests pass a fake GitHub that records every call.
- **The CLI wrapper** reads the reason from stdin and the repo from the checkout's own `origin` remote, never the current directory. It calls `gh` with `execFileSync` and an argument array.

## Concepts worth knowing
- **Why stdin, not an argument.** In `node set.js 7 red "$(…)"` the shell expands `$(…)` **before** the script starts. If the reason quoted an issue comment holding `$(cat ~/.config/gh/hosts.yml)`, the token would end up in a public comment. Text on stdin is never expanded. `execFileSync('gh', [...args])` runs no shell either, unlike `execSync('gh api ' + path)`.
- **Read-back before you announce.** The comment is posted only after a GET returns the value that was POSTed. If the order were reversed, a failed write would leave a comment saying `red` on a PR whose field is empty.
- **Write the comment from what you read, not from what you meant.** Here the two must be equal for the script to post at all, so the rule costs nothing.
- **A constant id, checked by name.** A cloud session can't list the org's fields (`orgs/…` is 403), and the endpoint takes an id, not a name. So `49500036` is a constant. Every response carries `issue_field_name`, so if the id ever means another field, the script stops before writing.
- **New comment, not an edit.** GitHub notifies on a new comment, never on an edit. A level raised by an edit would go unseen.
- **Matching a marker *and* an author.** Anyone can post `<!-- review-level -->` on a public repo. The script counts only comments by its own account. The field stays the truth either way.

## Decisions
- [ADR 0032](../decisions/0032-the-review-level-is-the-prs-own-field.md): the PR's own field; one script writes it; limits said plainly.
- [ADR 0023](../decisions/0023-the-work-flow-from-an-idea-to-a-pr.md), decision 4, amended by it.

## Alternatives rejected
- A `review:*` label: shared with issues, it would sit next to the field it copies.
- The issue's field only: one click away, and it holds the planned level, not the built one.
- Raw `gh api` by hand: no code, but any field writable and no fixed comment.

## What testing found
- The GitHub MCP's `issue_write` can't write a field on a PR ("Could not resolve to an Issue"): it goes through GraphQL's Issue type.
- `POST issue-field-values` **merges**: setting Stage left Priority, Effort and Review level as they were.
- It refuses `field_name` in place of `field_id`.
- Breaking each guard in `set.js` turned its test red; a third writer planted under `scripts/` failed the repo-wide scan.

## Where to look
- `scripts/review-level/set.js` and `set.test.js`.
- [Work flow §2.7](../guides/work-flow.md#27-the-pr): how and when the agent runs it.
