# Cloud environment for agent-kit

A cloud session on agent-kit edits rules, scripts and docs. It needs no product secrets. The environment is set in claude.ai, not in this repo: open the cloud environment menu in a session's title bar, then **Edit**. Only Elia can change it.

## Settings
- **Name:** `agent-kit`.
- **Repository:** `ferrarolabs/agent-kit` only. One repo per session, so the session starts in the repo root and loads `.claude/settings.json` ([Guide: open sessions from the repo root](open-sessions-from-the-repo-root.md)).
- **Network access:** Limited, with the package managers allowed (CI's `npx markdownlint-cli2` needs the npm registry), plus `raw.githubusercontent.com` for the account installer. Nothing else: agent-kit calls no backend.
- **Environment variables and secrets:** none. `gh` works through the session's GitHub App.
- **Setup script:**

```bash
#!/bin/sh
set -eu
# The account layer: rules, deny floor, SessionStart hook (ADR 0010, ADR 0017).
curl -fsSL https://raw.githubusercontent.com/ferrarolabs/agent-kit/main/account/install.sh | sh
# Warm the npm cache for the markdown lint CI runs, so "before saying done" is fast.
npx --yes markdownlint-cli2@0.18.1 --help > /dev/null
```

Node 22, `git`, `gh` and the `claude` CLI are already in the cloud image.

## Checked when
A session started on this environment, from an issue, opens a PR against `main` that follows [Working as an agent](../../CLAUDE.md#working-as-an-agent), and the [deny-rule probe](../../scripts/probe/README.md) run inside it prints `19 of 19 as expected`.
