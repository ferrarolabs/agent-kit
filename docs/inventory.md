# Inventory: the pilot's harness, piece by piece

Every harness piece on [jamly](https://github.com/ferrarolabs/jamly), the pilot, and where it stands in the kit ([ADR 0014](decisions/0014-kit-aligned-at-every-harness-merge.md)).

A harness piece is anything that shapes how agents work: rules, permissions, hooks, CI, templates, labels, conventions. Product code is not here.

**Update this file in the same PR that ports a piece, and whenever a harness PR merges on jamly.**

## Columns
- **Scope:** *generic* (any project), *split* (a generic core plus jamly-only parts), or *jamly* (stays in jamly).
- **Proven:** the PR or issue where it was merged and, for a check, seen failing. *No* means it isn't ready for `template/`.
- **Template:** where it goes, or went, in `template/`. *Ported* or *to port*.

Checked against jamly `dev` at `35b6077` (2026-11-01). One harness merge since `6e28048` is not ported yet: [jamly#33](https://github.com/ferrarolabs/jamly/pull/33) (every force-push spelling denied), tracked in [agent-kit#121](https://github.com/ferrarolabs/agent-kit/issues/121). [jamly#29](https://github.com/ferrarolabs/jamly/pull/29) (board doc and labels) is checked below, and [jamly#31](https://github.com/ferrarolabs/jamly/pull/31) (command log) is ported.

## Contract and conventions

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `CLAUDE.md` · "Working as an agent" | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1), [jamly#5](https://github.com/ferrarolabs/jamly/pull/5), [jamly#14](https://github.com/ferrarolabs/jamly/pull/14) | `CLAUDE.md.template` · ported | Generic: one issue one branch one PR, labels handshake, push with the branch named, recover before you stop, product questions stop you. jamly-only: Supabase and EAS lines |
| `CLAUDE.md` · definition of done, with who holds each line | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D44) | `CLAUDE.md.template` · ported | The "who holds it" column is generic; device, offline and dark lines are jamly's |
| `CLAUDE.md` · project context, five pitfalls, stack, layout | jamly | — | — | |
| `AGENTS.md` (read the Expo v57 docs) | jamly | — | — | |
| `docs/process/41-decision-log.md` + `docs/tech/adr/` convention | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `docs/decisions/README.md` · ported | Generic: big decision → ADR, never edited, superseded; small → decision log. The entries are jamly's |
| `docs/process/40-ways-of-working.md` | jamly | — | — | Solo-project rhythm. Its "Working with AI" section is already covered by the contract |
| `docs/process/42-project-board.md` | jamly | [jamly#29](https://github.com/ferrarolabs/jamly/pull/29) | — | Up to date with [ADR 0007](decisions/0007-project-boards.md) and [ADR 0008](decisions/0008-numeric-priority-and-projects-from-the-template.md): Status derived, Project built from the template, "Not built yet" section. It links to the generic design in [project-boards.md](project-boards.md) and only says how it applies to jamly. Nothing to port: the kit has no board page for `template/` |
| `docs/tech/33-conventions.md` · definition of done | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `CLAUDE.md.template` · ported | Same list as in `CLAUDE.md` |
| `docs/learn/<story>.md` | generic | [jamly#17](https://github.com/ferrarolabs/jamly/pull/17) ([ADR 0013](decisions/0013-every-feature-pr-ships-a-learn-note.md)) | `docs/learn/README.md` · ported | The format, not the note |

## Permissions

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `.claude/settings.json` · deny reading `.env` | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.claude/settings.json` · ported | |
| `.claude/settings.json` · push deny rules for `dev`, `staging`, `main` | generic | [jamly#5](https://github.com/ferrarolabs/jamly/pull/5): 12 of 12 denied, 4 feature pushes allowed | `.claude/settings.json` · ported | Branch names are the kit's default long-lived branches |
| `.claude/settings.json` · deny force-push, `rm -rf` | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.claude/settings.json` · ported | |
| `.claude/settings.json` · ask before editing workflows | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.claude/settings.json` · ported | |
| `.claude/settings.json` · deny Supabase and EAS writes, ask on `config.toml` and `eas.json` | jamly | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D42) | — | The pattern is generic: deny the project's irreversible commands |
| `.claude/settings.json` · allow npm checks, Expo plugin | jamly | — | — | |
| Deny-rule probe | generic | [jamly#5](https://github.com/ferrarolabs/jamly/pull/5); rebuilt and seen failing in [Probe for deny rules as a reusable Sensor](https://github.com/ferrarolabs/agent-kit/issues/2) | `scripts/probe/` in the kit · ported | The first script was never committed. The rebuild lives in the kit, not in `template/`: it runs from the kit against any project ([README](../scripts/probe/README.md)) |

## CI and GitHub

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1), [jamly#15](https://github.com/ferrarolabs/jamly/pull/15) (fails on format, D50), [jamly#38](https://github.com/ferrarolabs/jamly/pull/38) (`merge_group`) | `.github/workflows/ci.yml` · ported | Generic shape: on PRs, on pushes to long-lived branches and on `merge_group` (the merge queue, [ADR 0015](decisions/0015-merge-through-a-merge-queue.md)); typecheck, lint, format, test. The npm commands are the project's |
| `.github/ISSUE_TEMPLATE/feature.yml` | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D45) | `.github/ISSUE_TEMPLATE/feature.yml` · ported | Generic: why, acceptance criteria, out of scope, tests, decisions taken, data changes, manual check. jamly-only: story IDs, musician wording |
| `.github/ISSUE_TEMPLATE/bug.yml` | split | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | `.github/ISSUE_TEMPLATE/bug.yml` · ported | Generic except the platform list |
| `.github/labels.yml` · `type:*`, `agent:*`, `needs:elia`, `area:harness` | generic | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) (D46), [jamly#29](https://github.com/ferrarolabs/jamly/pull/29) (still the same set on `dev`) | `.github/labels.yml` · ported | `agent:*` and `needs:*` are due to be replaced by Stage ([ADR 0009](decisions/0009-issue-data-in-issue-fields.md)) |
| `.github/labels.yml` · `needs:device-check` | open | [jamly#1](https://github.com/ferrarolabs/jamly/pull/1) | — | Waits on [Decide: is "Device check" a generic Status?](https://github.com/ferrarolabs/agent-kit/issues/73) |
| `.github/labels.yml` · `priority:*` | — | [jamly#29](https://github.com/ferrarolabs/jamly/pull/29) | — | Removed from jamly: Priority is an org number field ([ADR 0008](decisions/0008-numeric-priority-and-projects-from-the-template.md)). The kit's `.github/labels.yml` never had them |
| `.github/labels.yml` · `epic:*` | jamly | — | — | |
| `.github/project-extra-views.json` | jamly | [jamly#11](https://github.com/ferrarolabs/jamly/pull/11) | — | The mechanism (`build-project.js --extra`) is already in the kit |
| Branch rulesets on `dev`, `staging`, `main` | generic | [jamly#2](https://github.com/ferrarolabs/jamly/issues/2) | `scripts/bootstrap.sh` · to build | Not a file: GitHub settings. [Bootstrap script](https://github.com/ferrarolabs/agent-kit/issues/4) |

## Hooks

| Piece on jamly | Scope | Proven | Template | Notes |
|---|---|---|---|---|
| `.claude/hooks/command-log.js` + its test, the `hooks` block in `.claude/settings.json`, `.claude/logs/` gitignored | generic | [jamly#31](https://github.com/ferrarolabs/jamly/pull/31): a real session logged ok, failed, denied and redacted commands, and upserted the comment; each of the 11 redaction patterns seen failing (D58) | `.claude/hooks/command-log.js` · ported | The kit's test uses `node:test`, jamly's uses Jest ([ADR 0020](decisions/0020-template-hooks-tested-with-node-test.md)). Same cases. Comment examples made generic |

## Not on jamly yet

Skills, subagents, the other hooks and `docs/progress.md`. They are Phase 2 and 3. Each gets a row here when its first PR merges on jamly.

Screen capture ([scripts/screens/](../scripts/screens/capture.js)) runs from the kit against a project's web build, like the probe. It was tried on jamly `dev` at `35b6077` from the kit and is not in `template/`. It gets a row here when a jamly issue or PR uses it.
