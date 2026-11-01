#!/usr/bin/env node
// SessionStart hook, installed at account level (ADR 0017).
//
// Claude Code loads a project's .claude/settings.json only from the folder a session starts in.
// A session started one folder above its repos (every cloud session with several repos) loads
// none of them: their deny rules, ask rules and hooks are all off, and nothing says so.
//
// This hook says so. When the start folder has no .claude/settings.json but a folder right
// below it does, it adds a note to the session's context. The agent tells Elia, and holds
// itself to those repos' rules, which only the account deny floor still enforces.
//
// It reads the start folder from the hook's stdin (`cwd`), falling back to process.cwd().
// It prints nothing when there is nothing to say, and it never fails the session.

const fs = require('node:fs');
const path = require('node:path');

const SETTINGS = path.join('.claude', 'settings.json');
const MAX_NAMES = 5;

// Folder names are printed into trusted context: keep only plain names.
const safeName = (name) => /^[\w.-]{1,100}$/.test(name);

// Pure apart from the fs calls it is given, so the tests can hand it a fake folder tree.
function reposWithUnloadedRules(startDir, { existsSync, readdirSync } = fs) {
  if (existsSync(path.join(startDir, SETTINGS))) return [];
  let entries;
  try {
    entries = readdirSync(startDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && safeName(e.name))
    .map((e) => e.name)
    .filter((name) => existsSync(path.join(startDir, name, SETTINGS)))
    .sort();
}

function message(startDir, repos) {
  if (repos.length === 0) return '';
  const shown = repos.slice(0, MAX_NAMES).map((r) => `\`${r}\``);
  const more = repos.length > MAX_NAMES ? ` and ${repos.length - MAX_NAMES} more` : '';
  return [
    `Project rules not loaded. This session started in \`${startDir}\`, which has no \`.claude/settings.json\`.`,
    `The repos below it that have one: ${shown.join(', ')}${more}. Their deny rules, ask rules and hooks do not apply in this session.`,
    'Only the account deny floor in `~/.claude/settings.json` is enforced (secrets, force-push, pushes to dev/staging/main, rm -rf).',
    "In your first reply, tell the user this in one line. Before running a command in one of those repos, read its `.claude/settings.json` and don't run what it denies.",
  ].join(' ');
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  let startDir = process.cwd();
  try {
    const input = JSON.parse(readStdin() || '{}');
    if (typeof input.cwd === 'string' && input.cwd) startDir = input.cwd;
  } catch {
    // No or bad input: use the process's folder.
  }
  const text = message(startDir, reposWithUnloadedRules(startDir));
  if (!text) return;
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }) + '\n',
  );
}

if (require.main === module) {
  try {
    main();
  } catch {
    // A hook that crashes must not block the session.
  }
  process.exit(0);
}

module.exports = { reposWithUnloadedRules, message };
