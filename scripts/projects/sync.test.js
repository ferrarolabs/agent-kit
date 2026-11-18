'use strict';
// Tests for the nightly sync (issue 175): registry, extra views, outcomes, the report issue.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  argError, errorLine, code, closedBody, registryError, extraViewsError, boardOutcome, MARKER, reportLines, reportAction, reportBody,
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

test('an extra view\'s group, sort, column field and manual text are bounded too (issue 67)', () => {
  const v = { name: 'Releases', layout: 'TABLE_LAYOUT', filter: 'is:issue', fields: ['Title'] };
  const ok = { ...v, groupBy: ['Stage'], sortBy: [{ field: 'Priority', direction: 'DESC' }], columnBy: null, manual: 'Sort by Priority.' };
  assert.strictEqual(extraViewsError({ views: [ok] }), null);
  assert.strictEqual(extraViewsError({ views: [{ ...v, columnBy: 'Stage' }] }), null);
  assert.match(extraViewsError({ views: [{ ...v, groupBy: 'Stage' }] }), /groupBy/);
  assert.match(extraViewsError({ views: [{ ...v, groupBy: Array(6).fill('Stage') }] }), /groupBy/);
  assert.match(extraViewsError({ views: [{ ...v, groupBy: ['x'.repeat(65)] }] }), /groupBy/);
  assert.match(extraViewsError({ views: [{ ...v, sortBy: [{ field: 'Priority', direction: 'UP' }] }] }), /sortBy/);
  assert.match(extraViewsError({ views: [{ ...v, sortBy: [{ field: 'Priority', direction: 'ASC', x: 1 }] }] }), /sortBy/);
  assert.match(extraViewsError({ views: [{ ...v, sortBy: Array(6).fill({ field: 'P', direction: 'ASC' }) }] }), /sortBy/);
  assert.match(extraViewsError({ views: [{ ...v, columnBy: 7 }] }), /columnBy/);
  assert.match(extraViewsError({ views: [{ ...v, manual: 'x'.repeat(301) }] }), /manual/);
  assert.match(extraViewsError({ views: [{ ...v, manual: { a: 1 } }] }), /manual/);
});

test('a board outcome comes from its results, its absence, or a missing project', () => {
  const e = { title: 'Jamly', number: 5, repo: 'jamly' };
  const json = { results: [
    { kind: 'changed', msg: 'updated view "Stalled"' },
    { kind: 'ok', msg: 'project is private' },
    { kind: 'manual', msg: 'view "Flow" sort []', todo: { key: 'view Flow sortBy', view: 'Flow', viewNumber: 2, text: 'sort by Priority, descending' } },
    { kind: 'spec', msg: 'workflows not in the spec: "X"', todo: { key: 'workflows spec', text: 't', added: ['X'] } },
  ] };
  const o = boardOutcome(e, json, 0, '');
  assert.strictEqual(o.state, 'ok', 'manual and spec lines are reported, not drift');
  assert.deepStrictEqual(o.changed, ['updated view "Stalled"']);
  assert.deepStrictEqual(o.manual, ['view "Flow" sort []']);
  assert.deepStrictEqual(o.todos.map((t) => t.view), ['Flow']);
  assert.deepStrictEqual(o.spec[0].added, ['X']);
  assert.strictEqual(boardOutcome(e, { results: [{ kind: 'drift', msg: 'x' }] }, 1, '').state, 'drift');
  assert.strictEqual(boardOutcome(e, { missing: true, results: [] }, 3, '').state, 'missing');
  const err = boardOutcome(e, null, 1, 'Error: boom\n');
  assert.strictEqual(err.state, 'error');
  assert.match(err.error, /boom/);
});

test('the report lists only what needs action: errors, missing boards, what was not fixed', () => {
  const outcomes = [
    { title: 'Agent work', number: 3, state: 'ok', changed: ['updated view "Stalled"'], drift: [], todos: [] },
    { title: 'Jamly', number: 5, state: 'missing', lines: [] },
    { title: 'agent-kit', number: 4, state: 'error', error: 'Error: HTTP 401\n' },
  ];
  const lines = reportLines(outcomes).join('\n');
  assert.match(lines, /### Errors[\s\S]*agent-kit.*HTTP 401/);
  assert.match(lines, /### Missing boards[\s\S]*Jamly/);
  assert.doesNotMatch(lines, /Agent work|Stalled/, 'what the sync changed is not reported');
  assert.ok(lines.indexOf('Errors') < lines.indexOf('Missing'), 'errors first');
  assert.strictEqual(reportLines([outcomes[0]]), null, 'a clean run reports nothing');
});

// Three boards, as the sync sees them. Only the ones given a todo differ.
const sortTodo = { key: 'view Stalled sortBy', view: 'Stalled', viewNumber: 3, text: 'sort by Updated, ascending', now: 'sort by Updated, descending' };
const boardsWith = (todos) => [
  { title: 'Agent work', number: 3, url: 'https://github.com/orgs/o/projects/3', state: 'ok', drift: [], todos: todos[3] || [] },
  { title: 'agent-kit', number: 4, url: 'https://github.com/orgs/o/projects/4', state: 'ok', drift: [], todos: todos[4] || [] },
  { title: 'Jamly', number: 5, url: 'https://github.com/orgs/o/projects/5', state: 'ok', drift: [], todos: todos[5] || [] },
];

test('a difference set by hand is reported, for the boards that differ only, with a link to the view (issue 67)', () => {
  const lines = reportLines(boardsWith({ 5: [sortTodo] }));
  assert.ok(lines, 'a hand-set difference is reported');
  const text = lines.join('\n');
  assert.match(text, /### To do by hand/);
  assert.match(text, /^- `Stalled`: should be: sort by Updated, ascending\. Differs on: \[Jamly\]\(https:\/\/github\.com\/orgs\/o\/projects\/5\/views\/3\) \(now `sort by Updated, descending`\)$/m);
  assert.doesNotMatch(text, /Agent work|agent-kit/, 'boards that match are not listed');
});

test('the same click on several boards is one line, with a link per board', () => {
  const wf = { key: 'workflow Item closed true', workflows: true, text: 'turn **Item closed** on', now: 'off' };
  const lines = reportLines(boardsWith({ 3: [sortTodo, wf], 5: [{ ...sortTodo, viewNumber: 7 }, wf] }));
  const todo = lines.filter((l) => l.startsWith('- '));
  assert.strictEqual(todo.length, 2, todo.join('\n'));
  assert.match(todo[0], /Differs on: \[Agent work\]\(.*\/projects\/3\/views\/3\) \(now `[^`]+`\), \[Jamly\]\(.*\/projects\/5\/views\/7\) \(now `[^`]+`\)$/);
  assert.match(todo[1], /^- should be: turn \*\*Item closed\*\* on\. Differs on: \[Agent work\]\(.*\/projects\/3\/workflows\) \(now `off`\), \[Jamly\]\(.*\/projects\/5\/workflows\) \(now `off`\)$/);
});

test('a spec behind GitHub is its own section, with the new names escaped', () => {
  const o = boardsWith({});
  o[1].spec = [{ key: 'workflows spec', text: 'GitHub renamed or added a workflow: update `workflowStates` by PR', added: ['Item closed v2'] }];
  const text = reportLines(o).join('\n');
  assert.match(text, /### Spec out of date\nGitHub renamed or added a workflow/);
  assert.match(text, /- \*\*agent-kit\*\* \(project 4\): not in the spec: `Item closed v2`/);
});

test('a board-controlled name comes out on one line, without backticks, cut, in a code span', () => {
  assert.strictEqual(code('a`b\nc @x'), '`a b c @x`');
  assert.strictEqual(code('x'.repeat(500)).length, 66, '64 characters and two backticks');
  assert.strictEqual(code(''), '` `');
  const o = boardsWith({});
  o[0].state = 'drift';
  o[0].drift = ['view "`](http://evil)\n@someone' + 'y'.repeat(500)];
  o[2].spec = [{ key: 'workflows spec', text: 't', added: ['`@x` [link](http://evil)'] }];
  o[1].todos = [{ ...sortTodo, now: 'sort by `@x` [link](http://evil)' }];
  const text = reportLines(o).join('\n');
  for (const l of text.split('\n').filter((x) => /evil|@/.test(x))) {
    const spans = l.match(/`[^`]*`/g) || [];
    const outside = spans.reduce((acc, sp) => acc.replace(sp, ''), l);
    assert.doesNotMatch(outside, /evil|@/, `outside a code span: ${l}`);
  }
  assert.ok(text.split('\n').every((l) => l.length <= 400), 'no long line');
});

test('the report is capped: 30 boards with 10 differences each stay well under GitHub\'s limit', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    title: `Board ${i}`, number: 100 + i, url: `https://github.com/orgs/o/projects/${100 + i}`, state: 'drift',
    drift: Array.from({ length: 10 }, (_, j) => `view "V${j}" filter "${'f'.repeat(300)}"`),
    todos: Array.from({ length: 10 }, (_, j) => ({ key: `k${i}-${j}`, view: `V${j}`, viewNumber: j, text: 'sort by Priority, descending' })),
    actions: ['card for issue 1 has no Stage'],
  }));
  const lines = reportLines(many, { runUrl: 'https://run/1' });
  assert.strictEqual(lines.length, 80);
  assert.match(lines[79], /^…and \d+ more line\(s\): see the \[run\]\(https:\/\/run\/1\)\.$/);
  const body = reportBody(lines, 'https://run/1', '2026-11-18T00:00:00Z');
  assert.ok(body.length < 60000, `body is ${body.length} characters`);
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

test('a closed report keeps no stale to-do in its body', () => {
  const body = closedBody('https://run/9', '2026-11-18T20:40:59Z');
  assert.ok(body.startsWith(MARKER), 'still found by its marker');
  assert.doesNotMatch(body, /To do by hand|Differs on|<!-- lines:/);
  assert.match(body, /All clear: the \[run\]\(https:\/\/run\/9\)/);
  const src = fs.readFileSync(path.join(__dirname, 'report-sync.js'), 'utf8');
  assert.match(src, /state: 'closed', state_reason: 'completed', body: closedBody\(runUrl, now\)/, 'the close replaces the body');
});
