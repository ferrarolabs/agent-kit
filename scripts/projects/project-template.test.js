'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const spec = require('./project-template.json');

const root = path.join(__dirname, '..', '..');

test("Status's options are Stage's values, in the order of docs/issue-structure.md", () => {
  const doc = fs.readFileSync(path.join(root, 'docs', 'issue-structure.md'), 'utf8');
  const row = doc.split('\n').find((l) => l.startsWith('| **Stage** |'));
  assert.ok(row, 'docs/issue-structure.md has no Stage row in its fields table');
  const values = row.split('|')[3].match(/`([^`]+)`/g).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(spec.status.map((s) => s.name), values);
});

test('no script writes a field value on an item (Status is the reconciler\'s; only the owner sets Ready)', () => {
  const dir = __dirname;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js') && !n.endsWith('.test.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /updateProjectV2ItemFieldValue|clearProjectV2ItemFieldValue|issue-field-values/, `${f} writes an item field`);
  }
});

test('no view filters on labels: state is in issue fields (ADR 0022)', () => {
  for (const v of spec.views) assert.doesNotMatch(v.filter, /label:/, `view "${v.name}"`);
});

test('every view filters on issues: PRs carry no Stage (board design F5)', () => {
  for (const v of spec.views) assert.match(v.filter, /(^| )is:issue( |$)/, `view "${v.name}"`);
});

test('the project is private (ADR 0024)', () => {
  assert.strictEqual(spec.public, false);
});
