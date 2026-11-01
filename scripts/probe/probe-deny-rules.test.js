// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const { verdictFromStream, normalise } = require('./probe-deny-rules');

const toolUse = (command) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });
const result = (denied = []) =>
  JSON.stringify({
    type: 'result',
    permission_denials: denied.map((command) => ({ tool_name: 'Bash', tool_input: { command } })),
  });

test('a command attempted and listed in permission_denials is a deny', () => {
  const lines = [toolUse('git push origin dev'), result(['git push origin dev'])];
  assert.equal(verdictFromStream(lines, 'git push origin dev').verdict, 'deny');
});

test('a command attempted and not denied is an allow', () => {
  const lines = [toolUse('git push -u origin feat/0-domain'), result([])];
  assert.equal(verdictFromStream(lines, 'git push -u origin feat/0-domain').verdict, 'allow');
});

test('a command never attempted is "not attempted", never a pass', () => {
  const lines = ['not json', result([])];
  assert.deepEqual(verdictFromStream(lines, 'git push'), { verdict: 'not attempted', detail: 'no Bash call' });
});

test('a different command than the case is not evidence, and is reported', () => {
  const lines = [toolUse('git push --dry-run origin dev'), result(['git push --dry-run origin dev'])];
  const r = verdictFromStream(lines, 'git push origin dev');
  assert.equal(r.verdict, 'not attempted');
  assert.match(r.detail, /ran instead: git push --dry-run origin dev/);
});

test('whitespace differences do not matter', () => {
  assert.equal(normalise('  git  push   origin dev '), 'git push origin dev');
  const lines = [toolUse('git push  origin dev'), result(['git push origin  dev'])];
  assert.equal(verdictFromStream(lines, 'git push origin dev').verdict, 'deny');
});
