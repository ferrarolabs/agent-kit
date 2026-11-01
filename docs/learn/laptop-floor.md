# Learn — floors, scopes and the sandbox

> What [Personal deny floor in ~/.claude/settings.json](https://github.com/ferrarolabs/agent-kit/issues/8) built, what it found, and why most of it waits. Decision: [ADR 0019](../decisions/0019-laptop-sandbox-floor-deferred.md).

## The feature in one paragraph

`account/install.sh` no longer gives up when a machine already has its own `~/.claude/settings.json`. It merges the kit's deny floor into it: lists add up, the owner's values stay, a backup is written first. The bigger part of the issue, a sandbox that confines an agent's commands and hides credentials, was built, probed and then **deferred**: Elia's machine runs native Windows, where Claude Code has no sandbox, and he works almost only in the cloud.

## How it's layered

```text
account/install.sh          copies CLAUDE.md and the hook; settings.json:
├─ no file, or the same     → copy the kit's file
├─ a different file + node  → merge-settings.js merges the kit's floor into it
└─ no node                  → settings.kit.json next to it, merge by hand
```

## Concepts worth knowing

### 1. Settings scopes, and who wins
Claude Code reads settings from several files: user (`~/.claude/settings.json`), project (`.claude/settings.json` in the repo), local, and managed (a system file, made for companies). For a single value, the highest scope wins: managed, then project, then user. **Project sits above user.**

### 2. Lists merge, single values override
List settings, like `permissions.deny`, add up across every scope. A repo can add a deny, never remove yours. That is why the [account deny floor](../decisions/0017-account-deny-floor.md) can live in user settings.

A single value, like `sandbox.enabled`, is different. A repo that sets it to `false` beats your `true`. The probe showed it: with the sandbox floor in user settings, a hostile repo got secret variables and home writes back. As managed settings, nothing below could turn it off.

`merge-settings.js` copies that model. Lists add up. A single value both files set stays the file's, and is named:

```js
if (Array.isArray(existing) && Array.isArray(kit)) {
  const seen = new Set(existing.map(stable));
  const added = kit.filter((item) => !seen.has(stable(item)));
  return { merged: [...existing, ...added], conflicts };
}
if (stable(existing) !== stable(kit)) conflicts.push(path);
return { merged: existing, conflicts };
```

`stable()` turns a value into a string with sorted keys, so the same hook written in a different key order counts as the same entry.

### 3. Rules and the sandbox are two layers
A **deny rule** stops a tool call before it runs, by reading the command. The **sandbox** works in the operating system (Seatbelt on macOS, bubblewrap on Linux) and decides what a running command can read, write and reach. The model itself runs on Anthropic's servers either way: what gets confined is the commands it asks your machine to run. Native Windows has only the first layer.

### 4. `deny` and `mask` for credentials
`deny` hides a file or removes a variable. `mask` gives the command a placeholder; the sandbox proxy swaps in the real value only on requests to the hosts you name. `gh` keeps working, and the agent never sees the token. In the probe, `GH_TOKEN` read as a 47-character placeholder.

## Decisions
- [ADR 0019](../decisions/0019-laptop-sandbox-floor-deferred.md): sandbox floor designed, deferred; when built, in managed settings, never user settings.
- The merge keeps the file's value on a conflict. A silent overwrite of a laptop's settings is not reversible. A named conflict is.

## Alternatives rejected
- **Set up WSL2 now.** Half an hour on Windows, for sessions Elia rarely runs.
- **The sandbox floor in `~/.claude/settings.json`**, as the issue's title says. A repo turns it off (concept 2).
- **Overwrite `settings.json`.** Loses whatever the owner had.

## What running it found
- Merge into a file with its own `model` and deny rule: both kept, the kit's 37 rules added, one backup. A second run changed nothing. A fresh install is byte-identical to the kit's file. Broken JSON: nothing changed, exit 2.
- The sandbox probe, in a cloud container: 9 of 9 as managed settings, 5 of 9 as user settings. Details in ADR 0019 and commit [274b997](https://github.com/ferrarolabs/agent-kit/tree/274b997bf4c364d7eff4dc3ba053bfd7955a641a).

## Where to look
- [account/merge-settings.js](../../account/merge-settings.js) and [its test](../../account/merge-settings.test.js).
- [account/install.sh](../../account/install.sh).
