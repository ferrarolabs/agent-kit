# 0017 · A deny floor at account level, and a warning when project rules don't load

**Status:** accepted · 2026-11-01

## Context
Claude Code loads a project's `.claude/settings.json` only from the folder a session starts in ([Guide: open sessions from the repo root](../guides/open-sessions-from-the-repo-root.md)). A cloud session with several repos starts in the folder that holds them all, so **no repo's deny rules load**. Proven on 2026-11-01: started in `/home/user`, `rm -rf` on a test folder ran; started in `/home/user/jamly`, it was denied ([Cloud sessions with several repos load no project deny rules](https://github.com/ferrarolabs/agent-kit/issues/103)).

Two-repo sessions are not rare. Every port from jamly into the kit needs both repos ([ADR 0014](0014-kit-aligned-at-every-harness-merge.md)). Branch rulesets on GitHub still hold. The guardrails on secrets, force-push and `rm -rf` did not.

Options weighed:
- **(a) A deny floor at account level:** `~/.claude/settings.json` loads wherever a session starts.
- **(b) A warning:** a SessionStart hook says when the project rules didn't load.
- **(c) One repo per cloud session:** simple, but it rules out cross-repo work.

Elia chose (a) and (b) on 2026-11-01.

## Decision
- **`account/settings.json`** holds the floor: the generic denies proven on jamly. Reading `.env`, every spelling of a force-push, pushes to `dev`, `staging` and `main`, `rm -rf`. It carries nothing project-specific: Supabase, EAS and other irreversible commands stay in each project's settings.
- **`account/hooks/project-rules-check.js`**, a SessionStart hook registered in that file. When the start folder has no `.claude/settings.json` but a folder right below it does, it puts a note into the session's context. The agent tells Elia in its first reply, and reads a repo's settings before running commands in it.
- **`account/install.sh`** installs the whole account layer: `CLAUDE.md`, `settings.json`, the hook. The cloud environment's setup script runs it. It never overwrites a `settings.json` that differs (a local machine may have its own); it writes `settings.kit.json` next to it instead.
- **Proof** comes from the deny-rule probe in `--account` mode: user settings only, session started above the repo.
- The floor is built in the kit, not on jamly first. It is account-level, not a project file, so [ADR 0014](0014-kit-aligned-at-every-harness-merge.md)'s port flow doesn't apply. Its rules are copies of jamly's, already proven there.

## Consequences
- In a multi-repo session, the generic guardrails hold again. Proven: 19 of 19 push cases and `rm -rf` denied with only the floor loaded; with `rm -rf` taken out of a copy, the probe exits 1.
- Project-specific denies (Supabase, EAS) are still missing in such a session. The hook makes that visible, and the agent holds itself to them. That is a promise, not a guardrail: the boundaries are still GitHub's rulesets and the environment's credentials.
- The floor's deny list is a copy of jamly's. When jamly's generic denies change, the floor changes in the same port PR. `sync-kit` will remove the copy.
- A rule in the floor applies to every repo. A project can't turn off a floor deny, only add its own.
- The setup script needs one more line, and only Elia can edit the environment.
