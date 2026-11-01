# 0013 · Every feature PR ships a learn note

**Status:** accepted · 2026-11-01

## Context
[PLAN.md](../PLAN.md) says every feature produces a learning note in `docs/learn/`, written by the explainer subagent after the merge. The explainer is Phase 5 ([explainer subagent and docs/learn/](https://github.com/ferrarolabs/agent-kit/issues/47)).

Elia wants to learn from each PR now, while he still reviews it. On [feat(16): set what I play in this band](https://github.com/ferrarolabs/jamly/pull/17) he had to ask for the note. The agent wrote [docs/learn/a4-instruments.md](https://github.com/ferrarolabs/jamly/blob/dev/docs/learn/a4-instruments.md), the first one.

## Decision
Until the explainer exists, **the implementing agent writes the learn note in the feature's PR**, before the merge.

- It applies to every PR that adds or changes behaviour. A PR that changes agent rules but no code puts a short Learn section in its description instead. Chores that change no behaviour skip it.
- The note lives in the project's repo, at `docs/learn/<story>.md`. It is written before the merge, so Elia reads it during the review. It is linked at the top of the PR description with a permalink to the commit, which survives the branch being deleted.
- It covers: the feature in one paragraph, how the code is layered, the concepts and technologies behind it, the decisions taken, the alternatives rejected, what testing or running the app found, and where to look.
- It stays true: when review changes the code, the note changes in the same push.

The rule lives in `account/CLAUDE.md`, so it holds in every project.

## Consequences
- Elia reads the note while he reviews. It doubles as part of the review: a note that can't explain a choice is a sign the choice is weak.
- PRs get longer to write. The note costs the agent minutes. It saves Elia questions.
- The author explains its own work, which is less independent than an explainer on a clean context. The explainer (Phase 5) automates the same format and can replace or check the author's note.
- jamly gets a fallback line in its `CLAUDE.md`, like ADR 0010 and ADR 0012.
