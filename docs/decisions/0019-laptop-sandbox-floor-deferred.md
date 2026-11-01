# 0019 · A laptop sandbox floor: designed, deferred until local work is regular

**Status:** accepted · 2026-11-01 · extends [ADR 0017](0017-account-deny-floor.md) · work deferred to [Laptop sandbox floor, once local sessions become regular work](https://github.com/ferrarolabs/agent-kit/issues/120)

## Context
[Personal deny floor in ~/.claude/settings.json](https://github.com/ferrarolabs/agent-kit/issues/8) asks for a floor that holds in every local session, whatever the repo says. Elia added on the issue (from the Harness Engineering workshop, module 5): the floor also turns the sandbox on and handles credentials. `deny` hides a secret. `mask` swaps it for a placeholder and injects the real value only towards one host.

Claude Code's sandbox does both ([Sandboxing](https://code.claude.com/docs/en/sandboxing)). It confines the **commands** an agent runs, not the model: files, network, environment. It runs on macOS, Linux and WSL2. **Not on native Windows**: there, commands run unconfined.

A first version was built and probed in a cloud container on 2026-11-01 (commit [274b997](https://github.com/ferrarolabs/agent-kit/tree/274b997bf4c364d7eff4dc3ba053bfd7955a641a)). It found a hole in the issue's title:
- **Lists merge, single values override.** A repo can't remove a deny entry. But `sandbox.enabled` is one value, and project settings sit above user settings. A repo with `"sandbox": { "enabled": false }` turns a floor in `~/.claude/settings.json` off. Probed in a hostile project: 5 of 9 cases held. Secret variables, `GH_TOKEN` and writes to home came back.
- **Managed settings hold.** The same file as a managed-settings drop-in, with `allowUnsandboxedCommands: false`: 9 of 9. Claude Code then treats the sandbox as admin-required and ignores a repo's attempts to loosen it.

Elia's machine runs native Windows, and he works almost only in cloud sessions (2026-11-01). WSL2 setup for rare local use costs more than it protects.

## Decision
- **Not built now.** The design below is the plan for [the deferred issue](https://github.com/ferrarolabs/agent-kit/issues/120). The first version stays reachable in commit 274b997.
- **Built now:** `account/install.sh` merges the deny floor into an existing `settings.json` (`account/merge-settings.js`) instead of skipping it. Lists add up, a value the owner set stays theirs and is named, a backup is written first. The deny rules work on Windows too, without a sandbox.
- **When built**, the floor goes in a managed-settings drop-in (`managed-settings.d/50-agent-kit-floor.json`, sudo once), never in `~/.claude/settings.json`. Laptop only: cloud containers have their own proxy and credentials, which TLS termination would break.

### The design

```json
{
  "permissions": {
    "deny": ["Read(~/.aws/credentials)", "Read(~/.ssh/**)", "Read(~/.config/gh/hosts.yml)", "Read(~/.supabase/**)", "Edit(~/.claude/settings.json)"]
  },
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "network": { "tlsTerminate": {}, "allowedDomains": ["github.com", "api.github.com", "*.githubusercontent.com", "registry.npmjs.org"] },
    "credentials": {
      "files": [
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.ssh", "mode": "deny" },
        { "path": "~/.supabase", "mode": "deny" },
        { "path": "~/.config/gh/hosts.yml", "mode": "mask", "extract": "oauth_token:\\s*(\\S+)", "onExtractNoMatch": "deny", "injectHosts": ["api.github.com", "github.com"] }
      ],
      "envVars": [
        { "name": "AWS_SECRET_ACCESS_KEY", "mode": "deny" },
        { "name": "SUPABASE_ACCESS_TOKEN", "mode": "deny" },
        { "name": "GH_TOKEN", "mode": "mask", "injectHosts": ["api.github.com", "github.com"] }
      ]
    }
  }
}
```

Shortened. The full list (gcloud, Azure, docker, Expo, npm, git credentials) is in commit 274b997, `account/laptop/managed-floor.json`.

- `Read()` denies cover Claude's own Read tool, which the sandbox doesn't govern.
- `failIfUnavailable`: no sandbox, no session. Never silently unconfined.
- `allowUnsandboxedCommands: false`: a command that can't work in the sandbox fails. Elia allows it by name in his own `sandbox.excludedCommands` (agreed 2026-11-01).
- `github.com` next to `api.github.com`: `git push` over HTTPS authenticates at `github.com`.

## Consequences
- Local sessions on Elia's machine keep only the generic denies from [ADR 0017](0017-account-deny-floor.md): `.env`, force-push, pushes to protected branches, `rm -rf`. Credentials outside `.env` are readable by local commands. Accepted while local work is rare.
- The probe's lessons stay: verdicts from the command's real output, fake credentials, a hostile project, one case at a time (parallel sandboxed sessions broke each other's start, and a bubblewrap error once passed as "blocked").
- On native Windows the deferred work needs WSL2 first.
