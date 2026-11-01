# 0020 · Template hooks are tested with `node:test`, in the kit's CI

**Status:** accepted · 2026-11-01 · from [Command log](https://github.com/ferrarolabs/agent-kit/issues/39)

## Context
The command log is the first hook in `template/`. On jamly, the pilot, its test uses Jest, because jamly already runs Jest ([jamly PR 31](https://github.com/ferrarolabs/jamly/pull/31)).

The kit has no `package.json` and no test runner. Its own scripts are tested with Node's built-in `node:test`. Another project may use Jest, Vitest, or nothing.

A hook in `template/` is plain Node. Its test should run in any project, and in the kit itself, so a port that breaks it turns the kit's CI red.

One catch, found while porting: `node --test` with no argument skips dot-folders. It never sees `template/.claude/hooks/`.

## Decision
- **Hook tests in `template/` use `node:test` and `node:assert`.** No dependency. A ported test keeps the pilot's cases, rewritten for `node:test`.
- **The kit's CI runs them** with explicit globs: `node --test "**/*.test.js" "template/.claude/**/*.test.js"`. The same command is in `CLAUDE.md` under "Before saying done".

## Consequences
- The template copy of a hook test differs from jamly's in syntax, not in cases. The inventory says so on the row.
- A Jest project would also pick up `.claude/hooks/*.test.js` and fail on it. Such a project adds `/.claude/` to Jest's `testPathIgnorePatterns` and runs `node --test .claude/hooks/*.test.js` in CI. jamly can switch when `sync-kit` arrives.
- The next template hook follows the same rule.
