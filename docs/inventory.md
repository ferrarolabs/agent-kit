# Inventory: the pilot's harness, piece by piece

Every harness piece on [jamly](https://github.com/ferrarolabs/jamly), the pilot, and where it stands in the kit ([ADR 0014](decisions/0014-kit-aligned-at-every-harness-merge.md)).

A harness piece is anything that shapes how agents work: rules, permissions, hooks, CI, templates, labels, conventions. Product code is not here.

**Update this file in the same PR that ports a piece, and whenever a harness PR merges on jamly.**

## Columns
- **Scope:** *generic* (any project), *split* (a generic core plus jamly-only parts), or *jamly* (stays in jamly).
- **Proven:** the PR or issue where it was merged and, for a check, seen failing. *No* means it isn't ready for `template/`.
- **Template:** where it goes, or went, in `template/`. *Ported* or *to port*.

Checked against jamly `dev` at `6e28048` (2026-11-01).

## Contract and conventions

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `CLAUDE.md` · "Working as an agent" | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1), [jamly#5](https://github.com/ferrarolabs/jamly/pull/5), [jamly#14](https://github.com/ferrarolabs/jamly/pull/14) | `CLAUDE.md.template` · to port | Generic: one issue one branch one PR, labels handshake, push with the branch named, recover before you stop, product questions stop you. jamly-only: Supabase and EAS lines |
| `CLAUDE.md` · definition of done, with who holds each line | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D44) | `CLAUDE.md.template` · to port | The "who holds it" column is generic; device, offline and dark lines are jamly's |
| `CLAUDE.md` · project context, five pitfalls, stack, layout | jamly | — | — | |
| `AGENTS.md` (read the Expo v57 docs) | jamly | — | — | |
| `docs/process/41-decision-log.md` + `docs/tech/adr/` convention | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `docs/decisions/README.md` · to port | Generic: big decision → ADR, never edited, superseded; small → decision log. The entries are jamly's |
| `docs/process/40-ways-of-working.md` | jamly | — | — | Solo-project rhythm. Its "Working with AI" section is already covered by the contract |
| `docs/process/42-project-board.md` | jamly | — | — | **Out of date**: says Status is moved by hand and projects are built by hand, against [ADR 0007](decisions/0007-project-boards.md) and [ADR 0008](decisions/0008-numeric-priority-and-projects-from-the-template.md). The generic design is [project-boards.md](project-boards.md) |
| `docs/tech/33-conventions.md` · definition of done | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `CLAUDE.md.template` · to port | Same list as in `CLAUDE.md` |
| `docs/learn/<story>.md` | generic | [jamly#17](https://github.com/ferrarolabs/jamly/pull/17) ([ADR 0013](decisions/0013-every-feature-pr-ships-a-learn-note.md)) | `docs/learn/README.md` · to port | The format, not the note |

## Permissions

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `.claude/settings.json` · deny reading `.env` | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.claude/settings.json` · to port | |
| `.claude/settings.json` · push deny rules for `dev`, `staging`, `main` | generic | [jamly#5](https://github.com/ferrarolabs/jamly/pull/5): 12 of 12 denied, 4 feature pushes allowed | `.claude/settings.json` · to port | Branch names are the kit's default long-lived branches |
| `.claude/settings.json` · deny force-push, `rm -rf` | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.claude/settings.json` · to port | |
| `.claude/settings.json` · ask before editing workflows | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.claude/settings.json` · to port | |
| `.claude/settings.json` · deny Supabase and EAS writes, ask on `config.toml` and `eas.json` | jamly | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D42) | — | The pattern is generic: deny the project's irreversible commands |
| `.claude/settings.json` · allow npm checks, Expo plugin | jamly | — | — | |
| Deny-rule probe | generic | [jamly#5](https://github.com/ferrarolabs/jamly/pull/5) | `scripts/probe-deny-rules` · **lost** | The script was never committed. Rebuilt in [Probe for deny rules as a reusable Sensor](https://github.com/ferrarolabs/agent-kit/issues/2) |

## CI and GitHub

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1), [jamly#15](https://github.com/ferrarolabs/jamly/pull/15) (fails on format, D50) | `.github/workflows/ci.yml` · to port | Generic shape: on PRs and on pushes to long-lived branches; typecheck, lint, format, test. The npm commands are the project's |
| `.github/ISSUE_TEMPLATE/feature.yml` | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D45) | `.github/ISSUE_TEMPLATE/feature.yml` · to port | Generic: why, acceptance criteria, out of scope, tests, decisions taken, data changes, manual check. jamly-only: story IDs, musician wording |
| `.github/ISSUE_TEMPLATE/bug.yml` | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.github/ISSUE_TEMPLATE/bug.yml` · to port | Generic except the platform list |
| `.github/labels.yml` · `type:*`, `agent:*`, `needs:elia`, `area:harness` | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D46) | `.github/labels.yml` · to port | `agent:*` and `needs:*` are due to be replaced by Stage ([ADR 0009](decisions/0009-issue-data-in-issue-fields.md)) |
| `.github/labels.yml` · `needs:device-check` | open | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | — | Waits on [Decide: is "Device check" a generic Status?](https://github.com/ferrarolabs/agent-kit/issues/73) |
| `.github/labels.yml` · `priority:*` | — | — | — | **To remove** from jamly: Priority is an org number field ([ADR 0008](decisions/0008-numeric-priority-and-projects-from-the-template.md)) |
| `.github/labels.yml` · `epic:*` | jamly | — | — | |
| `.github/project-extra-views.json` | jamly | [jamly#11](https://github.com/ferrarolabs/jamly/pull/11) | — | The mechanism (`build-project.js --extra`) is already in the kit |
| Branch rulesets on `dev`, `staging`, `main` | generic | [jamly#2](https://github.com/ferrarolabs/jamly/issues/2) | `scripts/bootstrap.sh` · to build | Not a file: GitHub settings. [Bootstrap script](https://github.com/ferrarolabs/agent-kit/issues/4) |

## Not on jamly yet

Hooks, skills, subagents and `docs/progress.md`. They are Phase 2 and 3. Each gets a row here when its first PR merges on jamly.
