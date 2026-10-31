# agent-kit

This repo is the **kit**, not an application. It holds the plan and, over time, the files that get copied into projects.

## Where things are
- `docs/PLAN.md` is the source of truth for the goal. If a change contradicts it, stop and ask.
- `docs/ROADMAP.md` says what to do now. Work only on the current phase; don't get ahead of it.
- `template/` holds **only** generic files that work for any project. No references to jamly or any other specific project.

## Rules
- **Everything in this repo is in English**: files, decisions, issues, PRs, commit messages.
- Every non-obvious choice becomes an ADR in `docs/decisions/`, numbered in sequence, with context, decision and consequences.
- Nothing goes into `template/` until it has been proven on a real project (see ADR 0001).
- Every hook or check added comes with proof that it can fail.
- Short sentences.
- Refer to issues, PRs, ADRs and projects by their name, as a clickable link. Never by a bare number.
- An issue that needs my approval is atomic: one question or one task, readable in under a minute. Bigger work becomes a parent issue with sub-issues.
- Nothing deferred lives only in chat: it becomes an issue.
- When something fails, recover before asking: read the real error, try the alternatives, fix what's reversible. Ask only for what only I can do, and come with options and a recommendation (ADR 0010).
- A PR you open is yours until it is merged or closed: follow it in the same turn, without asking, and drive it to green (ADR 0012).

## Definition of done
- The current phase's checklist in `docs/ROADMAP.md` is updated.
- Decisions taken are recorded as ADRs.
- `docs/PLAN.md` still matches what's in the repo.
- Merged to `main` only after my approval.
