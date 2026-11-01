// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { reposWithUnloadedRules, message } = require('./project-rules-check');

const HOOK = path.join(__dirname, 'project-rules-check.js');

// Builds a real folder tree: { 'jamly/.claude/settings.json': '{}', 'agent-kit/README.md': '' }.
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-check-'));
  for (const [file, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), body);
  }
  return root;
}

const runHook = (cwd) => execFileSync('node', [HOOK], { input: JSON.stringify({ cwd }), encoding: 'utf8' });

test('two-repo cloud layout: names the repo whose rules do not load', () => {
  const root = tree({ 'jamly/.claude/settings.json': '{}', 'agent-kit/README.md': '' });
  assert.deepEqual(reposWithUnloadedRules(root), ['jamly']);
});

test('started in a repo root with settings: silent', () => {
  const root = tree({ '.claude/settings.json': '{}', 'sub/.claude/settings.json': '{}' });
  assert.deepEqual(reposWithUnloadedRules(root), []);
  assert.equal(runHook(root), '');
});

test('no repo below has settings: silent', () => {
  const root = tree({ 'a/README.md': '', 'b/.claude/other.json': '{}' });
  assert.equal(runHook(root), '');
});

test('hidden folders and unsafe names are ignored', () => {
  const root = tree({ '.cache/.claude/settings.json': '{}', 'we ird/.claude/settings.json': '{}' });
  assert.deepEqual(reposWithUnloadedRules(root), []);
});

test('a missing start folder is not an error', () => {
  assert.deepEqual(reposWithUnloadedRules('/nonexistent/rules-check'), []);
});

test('the hook prints SessionStart context naming the repos', () => {
  const root = tree({ 'jamly/.claude/settings.json': '{}', 'agent-kit/.claude/settings.json': '{}' });
  const out = JSON.parse(runHook(root));
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /Project rules not loaded/);
  assert.match(out.hookSpecificOutput.additionalContext, /`agent-kit`, `jamly`/);
});

test('long lists are cut after five names', () => {
  const text = message('/x', ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.match(text, /`e` and 2 more/);
  assert.doesNotMatch(text, /`f`/);
});

test('bad stdin falls back to the process folder and still exits 0', () => {
  const root = tree({ 'jamly/.claude/settings.json': '{}' });
  const out = execFileSync('node', [HOOK], { input: 'not json', cwd: root, encoding: 'utf8' });
  assert.match(out, /`jamly`/);
});
