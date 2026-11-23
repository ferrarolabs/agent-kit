// Run with: node --test (from the repo root)
// The workflow's guard rails (ADR 0033), checked on its text: no YAML library in the repo, and each
// rule is one line a reader can find in the file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const WF = read('.github/workflows/review-level.yml');
const code = (text) => text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
const WF_CODE = code(WF);

function triggers(text) {
  const on = code(text).split(/^on:\s*$/m)[1].split(/^\S/m)[0];
  return [...on.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
}

test('it runs only on the comment and on CI finishing in the queue', () => {
  assert.deepEqual(triggers(WF), ['issue_comment', 'workflow_run']);
  assert.match(WF_CODE, /issue_comment:\n\s+types: \[created\]/);
  assert.match(WF_CODE, /branches: \['gh-readonly-queue\/\*\*'\]/);
  assert.match(WF_CODE, /github\.event\.workflow_run\.event == 'merge_group'/);
});

test('workflow_run names CI exactly as ci.yml does', () => {
  const ciName = read('.github/workflows/ci.yml').match(/^name:\s*(.+)$/m)[1].trim();
  assert.equal(ciName, lib.CI_WORKFLOW);
  assert.match(WF_CODE, new RegExp(`workflows: \\[${lib.CI_WORKFLOW}\\]`));
});

test('only marked comments from members start it', () => {
  assert.ok(WF_CODE.includes(`startsWith(github.event.comment.body, '${lib.MARKER}')`));
  assert.match(WF_CODE, /fromJSON\('\["OWNER","MEMBER","COLLABORATOR"\]'\), github\.event\.comment\.author_association/);
  assert.match(WF_CODE, /github\.event\.issue\.pull_request/);
});

test('no job is named like the check', () => {
  const names = [...WF_CODE.matchAll(/^ {4}name:\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.ok(names.length >= 1);
  for (const n of names) assert.notEqual(n.toLowerCase(), lib.CHECK_NAME.toLowerCase());
});

test('permissions: none at the top, three reads on the job, nothing else', () => {
  assert.match(WF_CODE, /^permissions: \{\}$/m);
  const job = WF_CODE.match(/^ {4}permissions:\n((?: {6}.+\n)+)/m)[1].trim().split('\n').map((l) => l.trim()).sort();
  assert.deepEqual(job, ['contents: read', 'issues: read', 'pull-requests: read']);
});

test('one App token, scoped to checks: write only, from the review-level environment', () => {
  assert.equal((WF_CODE.match(/actions\/create-github-app-token@/g) || []).length, 1);
  const perms = [...WF_CODE.matchAll(/^\s+(permission-[\w-]+):\s*(\S+)/gm)].map((m) => `${m[1]}: ${m[2]}`);
  assert.deepEqual(perms, ['permission-checks: write']);
  assert.match(WF_CODE, /^ {4}environment: review-level$/m);
  assert.equal((WF_CODE.match(/environment:/g) || []).length, 1);
});

test('every action is pinned to a full commit SHA', () => {
  const uses = [...WF_CODE.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
});

test('it checks out the default branch only, never the PR, and keeps no credentials', () => {
  assert.match(WF_CODE, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(WF_CODE, /persist-credentials: false/);
  assert.doesNotMatch(WF_CODE, /head\.(sha|ref)|pull_request\.head|refs\/pull/);
});

test('no literal main: the target is the default branch, so the file works where it is dev', () => {
  assert.doesNotMatch(WF_CODE, /\bmain\b/);
});

test('event values reach the script only through env, never inside run:', () => {
  const runs = [...WF_CODE.matchAll(/^\s+run:\s*(.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(runs, ['node scripts/review-level/check.js']);
  for (const r of runs) assert.doesNotMatch(r, /\$\{\{/);
});

test('one concurrency group per PR for comments, per commit in the queue; queue runs never cancelled', () => {
  assert.match(WF_CODE, /group: review-level-\$\{\{ github\.event\.issue\.number \|\| github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(WF_CODE, /cancel-in-progress: \$\{\{ github\.event_name == 'issue_comment' \}\}/);
  assert.match(WF_CODE, /timeout-minutes: 5/);
});
