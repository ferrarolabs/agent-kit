# Learn — porting the command log into the kit

> What [Command log](https://github.com/ferrarolabs/agent-kit/issues/39) added to `template/`, and what the port had to change. The feature itself, its hooks and its design are explained in jamly's note: [the command log](https://github.com/ferrarolabs/jamly/blob/58ee052765ac8d8a5adee2881dc5c5c90acbb4ba/docs/learn/command-log.md).

## The feature in one paragraph

Every project made from the kit now logs each Bash command an agent runs: when, the command with secrets masked, and how it ended (ok, failed, or no result, which means denied). At every Stop the log becomes one comment on the issue the branch is named after. The pilot proved it on jamly; this PR copies the generic part into `template/` and makes the kit's CI test it.

## How it is laid out

```text
template/
├─ .claude/settings.json          + the hooks block: one script on five events
├─ .claude/hooks/command-log.js   the hook, as on jamly, with generic examples
├─ .claude/hooks/command-log.test.js   the same cases, on node:test
└─ .gitignore                     .claude/logs/, the raw log
.github/workflows/ci.yml          runs the template's tests too
```

## Concepts worth knowing

### 1. A port keeps the cases, not the syntax

jamly's test is Jest: `it.each([...])`, `expect(x).toBe(y)`. The kit has no Jest. `node:test` ships with Node, so the port rewrote each case with `assert`:

```js
for (const [command, secret] of cases) {
  it(`hides the secret in ${command}`, () => {
    const out = redact(command);
    assert.ok(!out.includes(secret), out);
  });
}
```

`it.each` becomes a plain loop. Same cases, same names. [ADR 0020](../decisions/0020-template-hooks-tested-with-node-test.md) makes this the rule for template hooks.

### 2. `node --test` skips dot-folders

With no argument, `node --test` looks for `*.test.js` files but skips folders that start with a dot. The first run found it: 27 tests, the hook's 29 missing. Passing a folder (`node --test template/.claude/hooks/`) fails: Node treats it as a file. Quoted globs work, because Node expands them itself:

```sh
node --test "**/*.test.js" "template/.claude/**/*.test.js"   # 56 tests
```

### 3. Seen failing, again

A copied test can pass with less than it should. So the pilot's check was rerun on the port. Each of the 11 redaction patterns was deleted in turn and the test run: every deletion turned one or two tests red. One case changed: jamly's `supabase login --token sbp_…` became `some-cli login --token tok_…`, still caught by the `--token` pattern alone.

### 4. No project name in a template file

`template/` holds generic files only. The hook's comments named jamly's repo and a setlist branch. They now say `owner/repo` and `feat/12-sign-in`. The proof link lives in `template/README.md`, not in the file.

## Decisions

- [ADR 0020](../decisions/0020-template-hooks-tested-with-node-test.md): template hooks are tested with `node:test`, in the kit's CI.
- The design of the log: jamly's D58, in its decision log.

## Alternatives rejected

- **Keep the Jest test.** The kit would need a `package.json` and Jest just to run one file, and projects without Jest couldn't run it.
- **Skip the test in the kit.** Then a bad port would only show up in a project.
- **Add the log to agent-kit's own `.claude/settings.json` too.** Out of this issue's scope; it is a separate change to the kit's own harness.

## What running it found

- The dot-folder gap above.
- An end-to-end run through stdin, as Claude Code calls it, on a scratch repo: `echo hello` ok, `false` failed (Exit code 1), a lone attempt read as denied, a GitHub token logged as `[REDACTED]`. Bad input on stdin still exits 0.
- Publishing was not rerun here: it is the same code jamly ran for real on [its issue](https://github.com/ferrarolabs/jamly/issues/30).

## Where to look

- `template/.claude/hooks/command-log.js`, top comment first.
- `template/README.md`, the row that links the proof and says what a project needs: `gh` with a token that can comment.
