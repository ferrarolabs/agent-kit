// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { mergeSettings } = require('./merge-settings');

const SCRIPT = path.join(__dirname, 'merge-settings.js');
const KIT = path.join(__dirname, 'settings.json');

test('deny rules add up: the file keeps its own and gets the kit ones', () => {
  const { merged, conflicts } = mergeSettings(
    { permissions: { deny: ['Read(./secrets/**)', 'Bash(rm -rf *)'] } },
    { permissions: { deny: ['Bash(rm -rf *)', 'Bash(git push --force*)'] } },
  );
  assert.deepEqual(merged.permissions.deny, ['Read(./secrets/**)', 'Bash(rm -rf *)', 'Bash(git push --force*)']);
  assert.deepEqual(conflicts, []);
});

test('keys only the file has are kept, keys only the kit has are added', () => {
  const { merged } = mergeSettings({ theme: 'dark', permissions: { allow: ['Bash(npm test)'] } }, { permissions: { deny: ['Read(.env)'] } });
  assert.deepEqual(merged, { theme: 'dark', permissions: { allow: ['Bash(npm test)'], deny: ['Read(.env)'] } });
});

test('a value both set differently stays the file’s, and is reported', () => {
  const { merged, conflicts } = mergeSettings({ sandbox: { enabled: false } }, { sandbox: { enabled: true } });
  assert.equal(merged.sandbox.enabled, false);
  assert.deepEqual(conflicts, ['sandbox.enabled']);
});

test('hook entries are compared as values, whatever their key order', () => {
  const hook = { hooks: [{ type: 'command', command: 'node x.js', timeout: 10 }] };
  const sameHookReordered = { hooks: [{ timeout: 10, command: 'node x.js', type: 'command' }] };
  const { merged } = mergeSettings({ hooks: { SessionStart: [sameHookReordered] } }, { hooks: { SessionStart: [hook] } });
  assert.equal(merged.hooks.SessionStart.length, 1);
});

test('the file’s own $comment and $schema win without a conflict', () => {
  const { merged, conflicts } = mergeSettings({ $comment: 'mine' }, { $comment: 'kit', $schema: 'x' });
  assert.deepEqual(merged, { $comment: 'mine', $schema: 'x' });
  assert.deepEqual(conflicts, []);
});

test('the CLI merges into a real file, backs it up, and a second run changes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-settings-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ model: 'opus', permissions: { deny: ['Read(./secrets/**)'] } }));

  execFileSync('node', [SCRIPT, file, KIT], { stdio: 'pipe' });
  const merged = JSON.parse(fs.readFileSync(file, 'utf8'));
  const kit = JSON.parse(fs.readFileSync(KIT, 'utf8'));
  assert.equal(merged.model, 'opus');
  assert.ok(merged.permissions.deny.includes('Read(./secrets/**)'));
  for (const rule of kit.permissions.deny) assert.ok(merged.permissions.deny.includes(rule), rule);
  assert.equal(fs.readdirSync(dir).filter((f) => f.includes('.bak-')).length, 1);

  const again = execFileSync('node', [SCRIPT, file, KIT], { encoding: 'utf8' });
  assert.match(again, /already has everything/);
  assert.equal(fs.readdirSync(dir).filter((f) => f.includes('.bak-')).length, 1);
});

test('broken JSON in the file changes nothing and exits 2', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-settings-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, '{ "model": "opus", }');
  assert.throws(() => execFileSync('node', [SCRIPT, file, KIT], { stdio: 'pipe' }), (e) => e.status === 2);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ "model": "opus", }');
});
