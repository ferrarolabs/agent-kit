# 0032 · The review level is the PR's own field

**Status:** accepted · 2026-11-20 · from [Review level as a field on the PR, not a line in its description](https://github.com/ferrarolabs/agent-kit/issues/160). Amends [ADR 0023](0023-the-work-flow-from-an-idea-to-a-pr.md) (decision 4).

## Context
ADR 0023 gives every PR a review level, `green`, `yellow` or `red`, re-assessed by an independent agent. Until now it was a line in the PR description. Elia wanted the same `Review level` issue field the issues use, on the PR itself.

GitHub's docs say issue fields "only apply to issues". The REST API says otherwise. `POST repos/{owner}/{repo}/issues/<pr>/issue-field-values` stores the field on a PR and reads it back. That was proven on [PR 159](https://github.com/ferrarolabs/agent-kit/pull/159) on 2026-11-06. But the PR page shows it nowhere (Elia checked, 2026-11-06). The GitHub MCP can't write it at all: its `issue_write` answers "Could not resolve to an Issue" on a PR number (2026-11-20). A cloud session can't list the org's fields either (`orgs/…` returns 403), and the endpoint takes a field id, not a name.

Elia chose, on the issue: the field holds the value, and the `Review level` check run ([Review-level check](https://github.com/ferrarolabs/agent-kit/issues/153)) shows it. On a PR, a deterministic tool writes it; an agent only decides it.

## Decision
- **The PR's field is the only source of truth** for the level of what was built. The issue's field keeps the plan's level. When the PR's level is higher, the agent raises the issue's field to match. It never lowers it.
- **The independent agent decides; one script writes.** Agents are told to use `scripts/review-level/set.js` and nothing else ([work flow §2.7](../guides/work-flow.md#27-the-pr) has the how). A function can compute the floor from the files touched, but not the judgement above it: a typo fix is `green`, a doc that changes a rule is `yellow`.
- **The script writes one field, on one kind of target.** The field id is a constant, checked against the name each response gives (`issue_field_name`), so a wrong id exits 1 instead of writing on. It writes only on an open PR of the repo the checkout comes from. The reason comes on stdin, so no shell expands quoted text.
- **The comment is a note for the owner, written from the read-back.** It is posted only once the read-back matches. A change posts a new comment, because an edited comment notifies nobody. The description carries no value; it says where to read it. Anything that looks for the comment matches the marker and the author, never the text. The author check only keeps outsiders out: the token may be the owner's own.
- **The level is re-assessed only when asked, or when a push changes the files touched.** Not on every push: each run is an agent run.

## Limits, said plainly
- "Set by the independent agent", "never Stage `Ready`" and "only this script writes" are rules, not guards. Raw `gh api` and the MCP can still write issue fields; nothing in the deny rules stops them ([threat model](../threat-model.md)). Whether the deny floor should block raw `gh api` writes is [its own decision](https://github.com/ferrarolabs/agent-kit/issues/194).
- The real guard is the floor check of the Review-level check. Until it exists, nothing enforces the floor.
- The API is undocumented. If GitHub stops accepting the field on PRs, the script exits 1 and the check fails "no level", so the break is loud. Then this ADR is revisited.

## Alternatives rejected
- **A `review:*` label.** Labels are shared by issues and PRs in a repo, so it would sit next to the field it duplicates, and ADR 0022 keeps labels for `area:*` only.
- **The field on the issue only.** It is one click away from the PR, and it holds the plan's level, not the built one.
- **A line in the PR description.** Nothing can read it reliably, and nothing fails when it is missing.
- **Raw `gh api` by hand.** No code, but every field is writable and nothing fixes the comment's format.
- **A function that computes the whole level.** It can compute only the floor.

## Consequences
- Every agent PR gets one script run and one marked comment. The owner reads the level in that comment until the check run exists.
- Under `scripts/`, the writers of issue field values are `projects/report-sync.js` and `review-level/set.js`; `projects/status-step.js` only reads. `set.test.js` fails on any other.
- The field id `49500036` belongs to the `ferrarolabs` org. A repo in another org needs its own.
