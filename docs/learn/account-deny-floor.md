# Learn — the account deny floor

> What [Cloud sessions with several repos load no project deny rules](https://github.com/ferrarolabs/agent-kit/issues/103) built, and why. Decision: [ADR 0017](../decisions/0017-account-deny-floor.md).

## The feature in one paragraph

A cloud session with two repos starts in the folder above them, so neither repo's `.claude/settings.json` loads, and with it every deny rule. Now the account layer carries a **floor**: the generic denies (secrets, force-push, pushes to `dev`/`staging`/`main`, `rm -rf`) in `~/.claude/settings.json`, which loads wherever a session starts. A SessionStart hook in the same file tells the agent when a repo's own rules didn't load, so the agent can tell Elia.

## How it's layered

```text
cloud setup script               one line, Elia's: runs account/install.sh
└─ account/install.sh            copies three files into ~/.claude
   ├─ CLAUDE.md                  the account rules (already there before)
   ├─ settings.json              deny floor + registers the hook
   └─ hooks/project-rules-check.js
        └─ reposWithUnloadedRules()   pure: start folder → repos whose rules didn't load
scripts/probe/ --account <dir>   proves the floor: user settings only, started above the repo
```

## Concepts worth knowing

### 1. Settings scopes, and which ones load
Claude Code merges settings from several scopes: user (`~/.claude/settings.json`), project (`.claude/settings.json` in the start folder), local, and managed. **Project means the start folder**, not "any repo the session touches". User settings have no such condition. That is why the floor goes in the user scope.

Deny rules from every scope add up, and deny beats allow. So the floor can't loosen a project's rules: jamly still denies Supabase pushes when a session starts in jamly.

### 2. A floor, not a copy of everything
The floor holds only what is true for **every** repo. Supabase and EAS commands are jamly's. Putting them at account level would deny them in projects that legitimately use them. So the floor stays small, and the hook covers the gap by saying it exists.

### 3. SessionStart output is context
A SessionStart hook's output becomes part of what the agent knows at turn one. Printed as JSON, `additionalContext` is the field Claude Code adds:

```js
process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }) + '\n',
);
```

Because that text is trusted, the hook prints only fixed wording plus folder names that pass `^[\w.-]{1,100}$`. A folder name can't smuggle instructions in.

### 4. A hook must never break the session
The hook catches every error and always exits 0. A missing folder, bad stdin or an unreadable directory means "say nothing", never a failed start.

### 5. Prove it in the layout that broke
`probe-deny-rules.js --account <dir>` sets `CLAUDE_CONFIG_DIR` to a throwaway config folder, reads only user settings, and starts each session in the folder **above** the clone. That is the multi-repo cloud layout: the repo's rules are present on disk but don't load. A denial can only come from the floor.

## Decisions
- [ADR 0017](../decisions/0017-account-deny-floor.md): floor + warning, chosen by Elia over "one repo per session".
- The installer never overwrites a different `settings.json`. A laptop's own settings are Elia's, and a silent overwrite there is not reversible.

## Alternatives rejected
- **One repo per cloud session.** It rules out porting jamly → kit in one session.
- **Every jamly deny at account level.** Wrong for other projects (see concept 2).

## What running it found
- With only the floor, in the folder above a jamly clone: **19 of 19** push cases as expected, `rm -rf` denied, `ls` allowed.
- With `Bash(rm -rf *)` removed from a copy of the floor: `rm -rf probe-target` comes out `allow`, the probe exits 1.
- The hook's note reached the session in a two-repo layout, and was absent when the session started in a repo root.
- **A surprise:** a case `rm -rf ./repo/probe-target` was never attempted, twice. The hook's note says not to run what the repo denies, and jamly denies `rm -rf`, so the model refused on its own. The note works, but it can hide a missing rule from the probe. That case was dropped. Probe cases for the floor should not run inside a repo that denies the same command.

## Where to look
- [account/settings.json](../../account/settings.json): the floor.
- [account/hooks/project-rules-check.js](../../account/hooks/project-rules-check.js) and its test.
- [account/install.sh](../../account/install.sh).
- [scripts/probe/account-floor.json](../../scripts/probe/account-floor.json) and the `--account` mode in [probe-deny-rules.js](../../scripts/probe/probe-deny-rules.js).
