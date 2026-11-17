'use strict';
// Tests for the nightly sync (issue 175): registry, extra views, outcomes, the report issue.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  argError, kindOf, errorLine, registryError, extraViewsError, boardOutcome, MARKER, reportLines, reportAction, reportBody,
} = require('./lib');
const spec = require('./project-template.json');

test('the committed registry is valid, with the template and both repo boards', () => {
  const reg = require('./projects.json');
  assert.strictEqual(registryError(reg), null);
  assert.deepStrictEqual(reg.projects.map((p) => p.number).sort(), [3, 4, 5]);
});

test('a bad registry is refused', () => {
  const ok = { owner: 'ferrarolabs', projects: [{ title: 'Agent work', number: 3 }, { title: 'Jamly', number: 5, repo: 'jamly' }] };
  assert.strictEqual(registryError(ok), null);
  const bad = (mut) => { const r = JSON.parse(JSON.stringify(ok)); mut(r); return registryError(r); };
  assert.match(bad((r) => { r.projects[1].number = 3; }), /appears twice/);
  assert.match(bad((r) => { r.projects[1].title = 'Agent work'; }), /appears twice/);
  assert.match(bad((r) => { delete r.projects[1].repo; }), /exactly one entry without a repo/);
  assert.match(bad((r) => { r.projects[0].number = '3'; }), /positive integer/);
  assert.match(bad((r) => { r.projects[1].repo = '../x'; }), /bare repo name/);
  assert.match(bad((r) => { r.projects[1].prune = true; }), /unknown key prune/);
  assert.match(bad((r) => { r.projects = []; }), /non-empty/);
});

test('sync arguments: a number is required, and nothing that deletes or creates', () => {
  const a = (x) => argError({ owner: 'o', title: 'T', repo: 'r', ...x }, spec, []);
  assert.strictEqual(a({ sync: true, number: '5' }), null);
  assert.match(a({ sync: true }), /needs --number/);
  assert.match(argError({ owner: 'o', title: 'T', template: true, sync: true, number: '3', prune: true }, spec, []), /can't run with/);
  assert.match(a({ sync: true, number: '5', check: true }), /can't run with/);
  assert.match(a({ sync: true, number: '5', 'from-template': 'Agent work' }), /can't run with/);
  assert.match(a({ number: '5; rm' }), /project number/);
});

test('the error line is the error, not the Node version that ends the stack', () => {
  const stack = 'gh: HTTP 502\ngh: HTTP 504\n/x/status-step.js:92\n   throw e;\n\nError: Command failed: gh api graphql --input -\ngh: HTTP 504\n\n    at gql (x.js:59:15)\n}\n\nNode.js v22.23.4\n';
  assert.strictEqual(errorLine(stack), 'gh: HTTP 504');
  assert.strictEqual(errorLine('Error: boom\n'), 'Error: boom');
  assert.strictEqual(errorLine(''), 'failed');
});

test('a line set by hand is manual, any other difference is drift', () => {
  assert.strictEqual(kindOf(true, 'view "Flow" fields'), 'ok');
  assert.strictEqual(kindOf(false, 'view "Flow" sort [], spec says [x] (set by hand)'), 'manual');
  assert.strictEqual(kindOf(false, 'view "Flow" filter "a", spec says "b"'), 'drift');
});

test('extra views from a repo pass only with known keys and bounded values', () => {
  const v = { name: 'Releases', layout: 'TABLE_LAYOUT', filter: 'is:issue', fields: ['Title'] };
  assert.strictEqual(extraViewsError({ views: [v] }), null);
  assert.match(extraViewsError({ views: [{ ...v, projectId: 'X' }] }), /unknown key projectId/);
  assert.match(extraViewsError({ views: [{ ...v, layout: 'WEIRD' }] }), /layout/);
  assert.match(extraViewsError({ views: [{ ...v, filter: 'x'.repeat(300) }] }), /256/);
  assert.match(extraViewsError({ views: [{ ...v, name: 'a\nb' }] }), /bad name/);
  assert.match(extraViewsError({ views: Array(11).fill(v) }), /at most 10/);
  assert.match(extraViewsError([]), /must be/);
});

test('a board outcome comes from its results, its absence, or a missing project', () => {
  const e = { title: 'Jamly', number: 5, repo: 'jamly' };
  const json = { results: [
    { kind: 'changed', msg: 'updated view "Stalled"' },
    { kind: 'ok', msg: 'project is private' },
    { kind: 'manual', msg: 'view "Flow" sort [] (set by hand)' },
  ] };
  const o = boardOutcome(e, json, 0, '');
  assert.strictEqual(o.state, 'ok');
  assert.deepStrictEqual(o.changed, ['updated view "Stalled"']);
  assert.deepStrictEqual(o.manual, ['view "Flow" sort [] (set by hand)']);
  assert.strictEqual(boardOutcome(e, { results: [{ kind: 'drift', msg: 'x' }] }, 1, '').state, 'drift');
  assert.strictEqual(boardOutcome(e, { missing: true, results: [] }, 3, '').state, 'missing');
  const err = boardOutcome(e, null, 1, 'Error: boom\n');
  assert.strictEqual(err.state, 'error');
  assert.match(err.error, /boom/);
});

test('the report lists only what needs action: errors, missing boards, what was not fixed', () => {
  const outcomes = [
    { title: 'Agent work', number: 3, state: 'ok', changed: ['updated view "Stalled"'], drift: [], manual: ['a (set by hand)'] },
    { title: 'Jamly', number: 5, state: 'missing', lines: [] },
    { title: 'agent-kit', number: 4, state: 'error', error: 'Error: HTTP 401\n' },
  ];
  const lines = reportLines(outcomes).join('\n');
  assert.match(lines, /### Errors[\s\S]*agent-kit.*HTTP 401/);
  assert.match(lines, /### Missing boards[\s\S]*Jamly/);
  assert.doesNotMatch(lines, /Agent work|set by hand|Stalled/);
  assert.ok(lines.indexOf('Errors') < lines.indexOf('Missing'), 'errors first');
  assert.strictEqual(reportLines([outcomes[0]]), null, 'a clean run reports nothing');
});

test('the report issue: create, comment on change, edit silently when the same, close when clean', () => {
  const lines = ['### Missing boards', '- **Jamly** (project 5)'];
  const same = { number: 9, body: reportBody(lines, 'https://run/1', '2026-11-16T00:00:00Z') };
  const other = { number: 9, body: reportBody(['### Errors', '- x'], 'https://run/1', '2026-11-16T00:00:00Z') };
  assert.strictEqual(reportAction(lines, null), 'create');
  assert.strictEqual(reportAction(lines, same), 'touch');
  assert.strictEqual(reportAction(lines, other), 'comment');
  assert.strictEqual(reportAction(null, same), 'close');
  assert.strictEqual(reportAction(null, null), 'none');
  assert.ok(same.body.startsWith(MARKER), 'the marker finds the issue again');
  assert.match(same.body, /Last seen: 2026-11-16T00:00:00Z, \[run\]\(https:\/\/run\/1\)/);
});

test('the report script writes fields only on its own issue, and never Ready', () => {
  const src = fs.readFileSync(path.join(__dirname, 'report-sync.js'), 'utf8');
  assert.doesNotMatch(src, /['"`]Ready['"`]/, 'no Ready value in the code');
  assert.doesNotMatch(src, /updateProjectV2ItemFieldValue|clearProjectV2ItemFieldValue|singleSelectOptions/);
  // The only issue-field write targets the issue this run created.
  const writes = src.match(/issues\/\$\{[^}]+\}\/issue-field-values/g) || [];
  assert.deepStrictEqual(writes, ['issues/${issue.number}/issue-field-values']);
});

test('the sync never replaces Status options, never adds items, never creates a project', () => {
  const src = fs.readFileSync(path.join(__dirname, 'build-project.js'), 'utf8');
  assert.match(src, /const same = sync \|\|/, 'the Status replace is skipped in sync');
  assert.match(src, /if \(!asTemplate && !sync\) \{\n\s+const since/, 'items are not added in sync');
  assert.match(src, /not created again[\s\S]*process\.exit\(3\)/, 'a missing registered project stops the run');
  const driver = fs.readFileSync(path.join(__dirname, 'sync-projects.js'), 'utf8');
  assert.doesNotMatch(driver, /--prune|--from-template|--check/);
  assert.match(driver, /'--sync'/);
});
