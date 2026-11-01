# Open sessions from the repo root

**Rule:** start every Claude Code session from the root of the repo you work on. Never from a folder above it.

## Why
Claude Code loads a project's `.claude/settings.json` only from the folder the session starts in. The deny rules, the `ask` rules and the hooks all live in that file. Start one level up, and they don't exist for that session. Nothing warns you.

Learned on jamly (decision D48): a session opened from `~/dev` had no deny rules at all.

## Proof (2026-11-01)
One headless session per folder, every Bash command allowed on the command line, so a denial can only come from a deny rule. jamly denies `Bash(rm -rf *)`.

| Session started in | Command | Result |
|---|---|---|
| `/home/user/jamly` (the repo root) | `rm -rf /tmp/…/x` | **Denied** by jamly's rule |
| `/home/user` (the folder above) | `rm -rf /tmp/…/x` | **Ran.** The folder was deleted |

```bash
cd <folder>
claude -p "Run exactly this Bash command and nothing else: rm -rf /tmp/probe-target/x" \
  --model claude-haiku-5-5 --allowedTools "Bash" --output-format json \
  | jq .permission_denials
```

## How to follow it
- **Locally:** `cd` into the repo, then run `claude`. In an editor, open the repo folder, not its parent.
- **In the desktop app:** pick the repo folder as the project.
- **In cloud sessions with more than one repo:** you can't. The session starts in the folder that holds all the repos, so **no repo's deny rules load**. The account deny floor ([ADR 0017](../decisions/0017-account-deny-floor.md)) keeps the generic ones: secrets, force-push, pushes to `dev`/`staging`/`main`, `rm -rf`. A SessionStart hook tells the agent which repos' own rules didn't load, and the agent tells you. Project-specific denies, such as Supabase and EAS, are still off.

## What still protects you when the rules don't load
- The account deny floor in `~/.claude/settings.json`, which loads wherever a session starts.
- Branch rulesets on GitHub: a push to `main` or `dev` is refused whatever the session runs.
- The cloud environment: no production credentials, a network allowlist.

These are the boundaries. Deny rules are a guardrail on top, and this guide is how you keep the guardrail on.
