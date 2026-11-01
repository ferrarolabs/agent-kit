# 0019 · The laptop floor lives in managed settings, with the sandbox on

**Status:** proposed · 2026-11-01 · extends [ADR 0017](0017-account-deny-floor.md) to Elia's own machines

## Context
[Personal deny floor in ~/.claude/settings.json](https://github.com/ferrarolabs/agent-kit/issues/8) asks for a floor that holds in every local session, whatever the repo says. Elia added on the issue (from the Harness Engineering workshop, module 5): the floor also turns the sandbox on and handles credentials. `deny` hides a secret, `mask` swaps it for a placeholder and injects the real value only towards one host. The proof: a project file tries to reopen a credential deny, and fails.

Claude Code's sandbox does both ([Sandboxing](https://code.claude.com/docs/en/sandboxing)). `sandbox.credentials` takes files and variables with `"mode": "deny"` or `"mode": "mask"`. `mask` needs `network.tlsTerminate`, and both are honored only from user settings, managed settings and `--settings`. The sandbox runs on macOS, Linux and WSL2. **Not on native Windows.**

The probe found a hole in the issue's own title. With the floor in `~/.claude/settings.json`, a repo's `.claude/settings.json` with `"sandbox": { "enabled": false }` wins: project settings sit above user settings. The sandbox goes off, and every variable and write it guarded comes back. Proven on 2026-11-01: 4 of 8 guarded cases open. Lists like `credentials` merge and can't be removed. The on/off switch is a single value, and it can.

Claude Code calls the fix an *admin-required* sandbox: `allowUnsandboxedCommands: false` in managed settings. Then a repo's `enabled: false` is ignored, and so are its `excludedCommands`, `allowedDomains` and write grants.

Options weighed:
- **(a) The floor in `~/.claude/settings.json`**, as the issue says. No sudo. A repo turns it off with one line.
- **(b) The floor in a managed-settings drop-in**, `managed-settings.d/50-agent-kit-floor.json` in the system folder. Needs sudo once. Nothing below it can turn it off.
- **(c) Both:** the generic denies stay in user settings ([ADR 0017](0017-account-deny-floor.md)), the sandbox and credentials go in managed.

## Decision
Option (c), proposed to Elia.
- **`account/settings.json` is unchanged**, and still installed as `~/.claude/settings.json` everywhere, cloud included. The installer now **merges** it into an existing file (`account/merge-settings.js`): lists add up, a value Elia set stays his and is named, a backup is written first.
- **`account/laptop/managed-floor.json`** is the laptop floor: sandbox on, `failIfUnavailable`, no unsandboxed retry, TLS termination, credential files and variables denied, `GH_TOKEN`, `GITHUB_TOKEN` and the `gh` hosts file masked towards `api.github.com` and `github.com`. `Read()` denies cover the same files for Claude's own Read tool, which the sandbox doesn't govern. `Edit()` denies protect the floor's own files.
- **`sh account/install.sh --laptop`** puts it in the drop-in folder, with sudo. It stops on native Windows (use WSL2) and on Linux without `bubblewrap` and `socat`, before changing anything.
- **Never in the cloud.** The cloud setup script runs the installer without `--laptop`. A cloud container has its own proxy and credentials: TLS termination there would break them.
- **`github.com` joins `api.github.com`** as an inject host. `git push` over HTTPS authenticates at `github.com`. Without it, an agent can't push its branch from the sandbox.
- **Proof** is `scripts/probe/probe-sandbox-floor.js`: fake credentials, a hostile project, verdicts from the command's real output.

## Consequences
- In a hostile project, with the floor as a managed drop-in: 9 of 9 as expected. As user settings: 5 of 9, the probe exits 1. That run is the proof the probe can fail.
- One `sudo` per laptop, and per change to the floor.
- With no unsandboxed retry, a command that can't work in the sandbox fails. Elia allows it by name in his own `sandbox.excludedCommands` (user settings still count under an admin-required sandbox). A repo can't.
- On macOS a masked file is unreadable, not masked, and `gh` may fail TLS checks under Seatbelt. `gh` and `git push` there may need `excludedCommands`. The probe passes either way: unreadable is blocked.
- A new domain prompts the first time. The floor doesn't set `strictAllowlist`.
- On WSL, `/etc/claude-code` is user-writable. The `Edit()` deny stops Claude's tools, not a user. Fine: the threat is a repo or an agent, not Elia.
- The floor lists only known names. A secret under another name isn't covered until it is added.
