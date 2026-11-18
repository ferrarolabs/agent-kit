'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const spec = require('./project-template.json');

const root = path.join(__dirname, '..', '..');

test("the spec's Stage options are the values of docs/issue-structure.md, in order", () => {
  const doc = fs.readFileSync(path.join(root, 'docs', 'issue-structure.md'), 'utf8');
  const row = doc.split('\n').find((l) => l.startsWith('| **Stage** |'));
  assert.ok(row, 'docs/issue-structure.md has no Stage row in its fields table');
  const values = row.split('|')[3].match(/`([^`]+)`/g).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(spec.stage.options.map((s) => s.name), values);
});

test('only status-step.js writes a field value on an item, once, and only the board\'s Status', () => {
  const dir = __dirname;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js') && !n.endsWith('.test.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /clearProjectV2ItemFieldValue/, `${f} clears an item field`);
    const writes = (src.match(/updateProjectV2ItemFieldValue/g) || []).length;
    if (f === 'status-step.js') {
      assert.strictEqual(writes, 1, 'status-step.js writes item values in one place');
      assert.match(src, /function writeStatus\(gql, projectId, writes\) \{\n\s+const status = readStatusField\(gql, projectId\);/, 'the field written is looked up as Status, never passed in');
      assert.doesNotMatch(src, /['"`]Ready['"`]/, 'no Ready value in the code');
    } else assert.strictEqual(writes, 0, `${f} writes an item field`);
    // report-sync.js sets Stage and Priority on the report issue it creates, and only there (sync.test.js).
    // status-step.js reads Stage there, with a GET and nothing else.
    if (f === 'status-step.js') for (const l of src.split('\n').filter((x) => x.includes('issue-field-values'))) assert.doesNotMatch(l, /method/, 'status-step.js only reads issue field values');
    else if (f !== 'report-sync.js') assert.doesNotMatch(src, /issue-field-values/, `${f} writes an issue field`);
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

test('workflowStates: one entry per workflow, on or off for the template and for repo boards (issue 67)', () => {
  assert.strictEqual(spec.workflows, undefined, 'the on/off values live only in workflowStates');
  assert.strictEqual(typeof spec.workflowNote, 'string');
  const names = spec.workflowStates.map((w) => w.name);
  assert.strictEqual(new Set(names).size, names.length, 'names are unique');
  for (const w of spec.workflowStates) {
    assert.deepStrictEqual(Object.keys(w).filter((k) => !['name', 'template', 'repo', 'note'].includes(k)), [], w.name);
    assert.strictEqual(typeof w.template, 'boolean', w.name);
    assert.strictEqual(typeof w.repo, 'boolean', w.name);
  }
  // Board design §7: closed → Done on, item added → Status off, auto-add only on repo boards.
  const by = Object.fromEntries(spec.workflowStates.map((w) => [w.name, w]));
  assert.deepStrictEqual([by['Item closed'].template, by['Item closed'].repo], [true, true]);
  assert.deepStrictEqual([by['Item added to project'].template, by['Item added to project'].repo], [false, false]);
  assert.deepStrictEqual([by['Auto-add to project'].template, by['Auto-add to project'].repo], [false, true]);
});
