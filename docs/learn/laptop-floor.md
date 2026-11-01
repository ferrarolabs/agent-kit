# Learn — the laptop floor: sandbox and credentials

> What [Personal deny floor in ~/.claude/settings.json](https://github.com/ferrarolabs/agent-kit/issues/8) built, and why. Decision: [ADR 0019](../decisions/0019-laptop-floor-in-managed-settings.md), proposed.

## The feature in one paragraph

On Elia's own machines, every Claude Code session now runs its Bash commands in a **sandbox** that a repo can't turn off. Inside it, cloud credentials, SSH keys and the Supabase token are unreadable, secret variables are removed, and the GitHub token is replaced by a placeholder that the sandbox proxy swaps for the real one only on requests to GitHub. The installer also stops overwriting a laptop's own `~/.claude/settings.json`: it merges the kit's deny floor into it.

## How it's layered

```text
account/install.sh                    every machine: CLAUDE.md, the hook, settings.json
├─ merge-settings.js                  merges the floor into an existing settings.json
└─ --laptop                           only on Elia's machines, with sudo
   └─ laptop/managed-floor.json  →    <system>/managed-settings.d/50-agent-kit-floor.json
scripts/probe/probe-sandbox-floor.js  fake home + hostile project → one verdict per case
└─ laptop-floor.json                  the cases
```

`<system>` is `/Library/Application Support/ClaudeCode` on macOS and `/etc/claude-code` on Linux and WSL2.

## Concepts worth knowing

### 1. Permission rules and the sandbox are two layers
A `deny` rule stops a tool call before it runs: `Read(~/.ssh/**)` stops Claude's Read tool, and Claude Code also refuses a Bash command that names that path. The **sandbox** works one level down, in the operating system (Seatbelt on macOS, bubblewrap on Linux). It decides what a running process can read, write and reach on the network. A rule reads the command line. The sandbox doesn't care how the command was spelled, so `$(echo ~/.ssh)` doesn't get past it.

The probe saw both. With the sandbox off, file cases were still stopped by the `Read()` rules. Environment variables were not: no rule reads `$AWS_SECRET_ACCESS_KEY`.

### 2. `deny` and `mask`

```json
{ "name": "AWS_SECRET_ACCESS_KEY", "mode": "deny" },
{ "name": "GH_TOKEN", "mode": "mask", "injectHosts": ["api.github.com", "github.com"] }
```

`deny` removes the variable, or hides the file. `mask` gives the command a placeholder, a *sentinel*. The sandbox proxy sits on the only network path out. It decrypts HTTPS (`tlsTerminate`), finds the sentinel in a request to an allowed host, and puts the real token there. `gh` keeps working. The command, its logs and the model only ever see the sentinel. In the probe, `GH_TOKEN` came out 47 characters long and not equal to the fake value.

### 3. Lists merge, single values override
Claude Code merges list settings across scopes: a project can add a credential deny, never remove one. A single value like `sandbox.enabled` goes to the highest scope that sets it, and **project sits above user**. So a floor in `~/.claude/settings.json` is one line away from being off:

```json
{ "sandbox": { "enabled": false } }
```

That is why the laptop floor goes in **managed settings**, the top scope. With `allowUnsandboxedCommands: false` there, the sandbox is *admin-required*: Claude Code also ignores a repo's `excludedCommands`, `allowedDomains` and write grants.

### 4. A drop-in, not the policy file
`managed-settings.d/` holds files that Claude Code merges with `managed-settings.json`. The kit owns one file there and never touches the rest. The same idea as `merge-settings.js`: the machine's own settings are its owner's.

### 5. Fail closed
`failIfUnavailable: true` makes Claude Code refuse to start when the sandbox can't. The other way, it would run unsandboxed and say nothing. So the installer checks first: it stops on native Windows, where no sandbox exists, and on Linux without `bwrap` and `socat`.

### 6. Prove it without secrets
The probe never touches a real credential. It makes a fake home (`HOME` points there, so `~` in the floor does too), writes fake files, and sets fake variables. The commands print sizes, counts and words: `wc -c`, `grep -c`, `present`/`absent`. A model asked to `cat` a credentials file refused, even when it was fake.

On Linux as root, `unshare -m` gives one process its own mount table. The probe bind-mounts its copy of the floor over `/etc/claude-code` for that process only. The session sees it as system policy, and the machine's real policy is untouched.

## Decisions
- [ADR 0019](../decisions/0019-laptop-floor-in-managed-settings.md): floor in a managed drop-in, laptop only, `github.com` as an inject host.
- `merge-settings.js` keeps the file's value when both set one. A silent overwrite on a laptop is not reversible. A named conflict is.

## Alternatives rejected
- **The floor in `~/.claude/settings.json`**, as the issue's title says. Probed: a repo turns it off (concept 3).
- **The sandbox in the cloud floor too.** The cloud container has its own proxy and credentials. TLS termination there would break `gh` and `git`.
- **`strictAllowlist`.** Every new domain would fail instead of prompting. Too much friction for a first version.

## What running it found
- Floor as a managed drop-in, hostile project: **9 of 9**.
- Same file as user settings: **5 of 9**, exit 1. Sandbox off, variables present, writes to home allowed. The file reads still failed, because of the `Read()` rules.
- Parallel sandboxed sessions share a temporary file, and one session's cleanup broke another's sandbox start. One case once passed **on bubblewrap's error message**, because it said "No such file". Now a bubblewrap error is its own verdict, never a pass, and the probe runs one case at a time.
- A denied folder (`~/.ssh`) is hidden from the sandbox, so its files read as "No such file". The fake home creates every file, so here that means blocked.
- Without `enableWeakerNestedSandbox`, bubblewrap can't start inside an unprivileged container. `--nested` adds it for the probe only.

## Where to look
- [account/laptop/managed-floor.json](../../account/laptop/managed-floor.json): the floor.
- [account/install.sh](../../account/install.sh) and [account/merge-settings.js](../../account/merge-settings.js), with its test.
- [scripts/probe/probe-sandbox-floor.js](../../scripts/probe/probe-sandbox-floor.js) and [laptop-floor.json](../../scripts/probe/laptop-floor.json).
