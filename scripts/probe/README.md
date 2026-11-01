# Deny-rule probe

A Sensor for a Boundary: it checks that a repo's deny rules deny what they should, and nothing more.

```bash
node scripts/probe/probe-deny-rules.js <repo-dir> scripts/probe/push-to-protected-branches.json
```

Exit code 0 when every case got its expected verdict, 1 otherwise. One line per case:

```
PASS  expect deny   got deny           git push origin HEAD:dev
FAIL  expect deny   got allow          git push --force-with-lease origin probe-deny-rules
PASS  expect allow  got allow          git push -u origin feat/0-domain
```

## When to run it
- **After every change to a repo's deny rules**, in the PR that changes them. Paste the output in the PR.
- When a repo adopts the kit.

It needs the `claude` CLI, signed in. Each case is one short headless session on Haiku: 16 cases take about 30 seconds and a few cents.

## How it works, and why
- **A throwaway clone.** The repo is cloned to a temporary folder and its `origin` points at a local bare repo. If a rule fails, the push lands there, never on GitHub. The repo's `.claude/settings.json` is copied as it is on disk, so uncommitted rules are tested too.
- **One session per case**, started in the clone's root. Project settings load only from the folder a session starts in ([guide](../../docs/guides/open-sessions-from-the-repo-root.md)). One per case because a long list made the model refuse some commands on its own.
- **Only the deny rules can block.** Every Bash command is allowed on the command line (`--allowedTools Bash`), and only project settings are read (`--setting-sources project`). Deny beats allow.
- **Evidence, not the model's word.** The verdict comes from Claude Code's event stream: the Bash call attempted, and `permission_denials` in the result.
- **No evidence is a failure.** A case the model never attempted is retried once, then counts as failed.

## Cases
A JSON file: `{ "cases": [{ "command": "...", "expect": "deny" | "allow" }] }`.

- [push-to-protected-branches.json](push-to-protected-branches.json): 12 ways to push to `dev`, `staging` or `main`, or to force-push, plus 4 controls that must stay allowed. The controls (`feat/0-domain`, `feat/0-dev-tools`…) catch rules that over-block: they contain `main` or `dev` inside a longer name.
- A project adds its own file for its own irreversible commands (database, deploys).

## Proven
- On jamly, 2026-11-01: 15 of 16. The one failure is real: `git push --force-with-lease` isn't denied, because `Bash(git push --force *)` needs a space after `--force`.
- Seen failing on purpose: with `Bash(git push *:dev)` removed from a copy of jamly's rules, `git push origin HEAD:dev` comes out `allow` and the probe exits 1.
- The first version was built on jamly ([jamly PR 5](https://github.com/ferrarolabs/jamly/pull/5)) and never committed. This is the rebuild.
