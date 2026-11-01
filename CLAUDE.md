# agent-kit

This repo is the **kit**, not an application. It holds the plan and, over time, the files that get copied into projects.

## Where things are
- `docs/PLAN.md` is the source of truth for the goal. If a change contradicts it, stop and ask.
- `docs/ROADMAP.md` says what to do now. Work only on the current phase; don't get ahead of it.
- `docs/inventory.md` lists every harness piece on jamly and where it stands in the kit.
- `docs/guides/` holds how-tos for working with the kit, such as [opening sessions from the repo root](docs/guides/open-sessions-from-the-repo-root.md).
- `template/` holds **only** generic files that work for any project. No references to jamly or any other specific project.

## Rules
- **Everything in this repo is in English**: files, decisions, issues, PRs, commit messages.
- Every non-obvious choice becomes an ADR in `docs/decisions/`, numbered in sequence, with context, decision and consequences.
- Nothing goes into `template/` until it has been proven on a real project (see ADR 0001).
- The kit follows the pilot (ADR 0014). When a harness PR merges on jamly, port its generic part into `template/` in a PR here, and update `docs/inventory.md`. Until `sync-kit` exists, never change a `template/` file directly.
- Every hook or check added comes with proof that it can fail.
- Short sentences.
- Refer to issues, PRs, ADRs and projects by their name, as a clickable link. Never by a bare number.
- An issue that needs my approval is atomic: one question or one task, readable in under a minute. Bigger work becomes a parent issue with sub-issues.
- Nothing deferred lives only in chat: it becomes an issue.
- When something fails, recover before asking: read the real error, try the alternatives, fix what's reversible. Ask only for what only I can do, and come with options and a recommendation (ADR 0010).
- A PR you open is yours until it is merged or closed: follow it in the same turn, without asking, and drive it to green (ADR 0012).

## Working as an agent
These hold whenever you work on your own, for example in a cloud session started from an issue.

- **One issue, one branch, one PR.** Branch `<type>/<issue>-<slug>`, e.g. `chore/55-harness-agent-kit`, cut from `main`. Open the PR against `main`; never merge it, never push to `main`. It merges through the merge queue after my approval (ADR 0015). Always push with the branch named: `git push -u origin <your-branch>`. A bare `git push`, `git push origin` or `... HEAD` is denied, because it can't be told apart from a push to `main`.
- **Labels are the handshake.** Start only on issues labelled `agent:ready`, or on one I name in the session; add `agent:working` when you start. If you stop for any reason other than done, add `needs:elia` and comment why.
- **Product questions stop you.** If the issue doesn't settle a choice that is mine (scope, what the kit should do, a trade-off between principles in `docs/PLAN.md`), don't guess: ask in the PR and stop.
- **Deny rules change, the probe runs.** A PR that touches `.claude/settings.json` or `account/settings.json` pastes the output of [`scripts/probe/`](scripts/probe/README.md) run on the branch.
- **Before saying done**, run what CI runs: `npx --yes markdownlint-cli2@0.18.1 && node scripts/check/check-links.js && node --test`.

## Definition of done
- The current phase's checklist in `docs/ROADMAP.md` is updated.
- Decisions taken are recorded as ADRs.
- `docs/PLAN.md` still matches what's in the repo.
- Merged to `main` only after my approval.
