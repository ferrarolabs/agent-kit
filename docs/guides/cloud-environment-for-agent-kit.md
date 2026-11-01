# Cloud environment for agent-kit

A cloud session on agent-kit edits rules, scripts and docs. It needs no product secrets. An environment holds the network access, the environment variables and the setup script; the repository is picked per session. It is set in claude.ai, not in this repo: open the cloud environment menu in a session's title bar to add one or **Edit** it ([docs](https://code.claude.com/docs/en/cloud-environments#network-access)). Only Elia can change it.

## Why its own environment
The shared Ferrarolabs Dev Environment carries jamly's Supabase URL and publishable key (ADR 0016) and allows `*.supabase.co`. agent-kit needs neither. A session that reads untrusted content (issues, web pages) should hold no credential it doesn't use.

## Settings
- **Name:** `agent-kit`.
- **Repository, picked when the session starts:** `ferrarolabs/agent-kit` only. One repo per session, so the session starts in the repo root and loads `.claude/settings.json` ([Guide: open sessions from the repo root](open-sessions-from-the-repo-root.md)).
- **Network access:** Limited, with the package managers allowed (CI's `npx markdownlint-cli2` needs the npm registry), plus `raw.githubusercontent.com` for the account installer. Nothing else: agent-kit calls no backend.
- **Environment variables and secrets:** none. `gh` works through the session's GitHub App.
- **Setup script:**

```bash
#!/bin/sh
set -eu
# The account layer: rules, deny floor, SessionStart hook (ADR 0010, ADR 0017).
curl -fsSL https://raw.githubusercontent.com/ferrarolabs/agent-kit/main/account/install.sh | sh
# Warm the npm cache for the markdown lint CI runs, so "before saying done" is fast.
# Not `markdownlint-cli2 --help`: it exits 2, and set -e fails the whole script.
npm cache add markdownlint-cli2@0.18.1
```

Node 22, `git`, `gh` and the `claude` CLI are already in the cloud image.

## Checked when
A session started on this environment, from an issue, opens a PR against `main` that follows [Working as an agent](../../CLAUDE.md#working-as-an-agent), and the [deny-rule probe](../../scripts/probe/README.md) run inside it prints `19 of 19 as expected`.
