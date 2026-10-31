# 0012 · Agents own their PR to the end

**Status:** accepted · 2026-10-31

## Context
On [feat(16): set what I play in this band](https://github.com/ferrarolabs/jamly/pull/17), the agent opened the PR and then asked Elia: "should I follow it?". The answer is always yes. The question cost an interaction and left the PR unwatched until he answered.

[ADR 0010](0010-agents-recover-before-they-escalate.md) says what an agent does when something fails. It doesn't say what happens after the PR is open. Elia reviews from his phone. Red CI that nobody watches goes unseen until he opens the PR.

## Decision
A PR an agent opens is the agent's until it is merged or closed.

1. **It follows the PR in the same turn it opens it:** it subscribes to CI, reviews and comments. It never asks whether to.
2. **It drives it.** Red CI, a merge conflict or a review comment is work now, not "waiting on review".
3. **It hands the PR over when green**, the way the repo says (in jamly, the `needs:device-check` label), and lists what Elia should check.
4. **It keeps a safety-net check-in** while the PR waits, if the session can schedule one. It stops when the PR is merged or closed, or when Elia says stop.

Merging stays Elia's ([ADR 0003](0003-agents-propose-i-decide.md)).

## Consequences
- Elia opens a PR that is already green, or one whose failure the agent has already explained.
- A session stays alive, or comes back, for as long as its PR is open. That costs usage while the PR waits. The check-ins are spaced out and stop after a few with nothing new.
- Same placement as ADR 0010: `account/CLAUDE.md` for every session, plus a line in this repo's `CLAUDE.md`. jamly gets its line separately.
- Next steps build on this: what the PR must contain ([Every agent PR is ready for Elia to try and learn from](https://github.com/ferrarolabs/agent-kit/issues/88)), and how Elia's review comments come back to the agent ([Review loop: Elia comments and flags the PR; the agent formalises the comment, then does it](https://github.com/ferrarolabs/agent-kit/issues/95)).
