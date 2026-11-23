// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoFromRemote, setReviewLevel } = require('./set');
const { FIELD, MARKER } = require('./lib');

const REPO = 'ferrarolabs/agent-kit';

// A fake GitHub: one open PR (7), one closed PR (8), issue 9 is no PR. It records every call.
function fakeGitHub({ value = null, readBack, failComment = false, comments = [], fieldName = FIELD.name } = {}) {
  const gh = { calls: [], posts: [], value, comments: [...comments] };
  gh.api = ([method, p], body) => {
    gh.calls.push(`${method} ${p}`);
    const m = p.match(/^repos\/([^/]+\/[^/]+)\/(pulls|issues)\/(\d+)(?:\/(.*))?$/);
    if (p === 'user') return { login: 'agent' };
    if (!m || m[1] !== REPO) throw new Error(`404 ${p}`);
    const n = Number(m[3]);
    if (m[2] === 'pulls') {
      if (n === 7) return { state: 'open' };
      if (n === 8) return { state: 'closed' };
      throw new Error('404');
    }
    if (m[4] === 'issue-field-values' && method === 'GET') {
      const v = gh.posts.length && readBack !== undefined ? readBack : gh.value;
      return v ? [{ issue_field_id: FIELD.id, issue_field_name: fieldName, single_select_option: { name: v } }] : [];
    }
    if (m[4] === 'issue-field-values' && method === 'POST') {
      gh.posts.push(body);
      gh.value = body.issue_field_values[0].value;
      return [];
    }
    if (m[4].startsWith('comments') && method === 'GET') return [gh.comments];
    if (m[4] === 'comments' && method === 'POST') {
      if (failComment) throw new Error('500');
      gh.comments.push({ user: { login: 'agent' }, body: body.body });
      return { html_url: `https://github.com/${REPO}/pull/${n}#c${gh.comments.length}` };
    }
    throw new Error(`unexpected ${method} ${p}`);
  };
  return gh;
}
const run = (gh, o) => setReviewLevel({ pr: 7, level: 'red', reason: 'Touches CLAUDE.md.', repo: REPO, api: gh.api, ...o });

test('sets the field, reads it back, then posts one marked comment from the read-back', () => {
  const gh = fakeGitHub();
  const r = run(gh);
  assert.equal(r.ok, true, r.line);
  assert.match(r.line, /none -> red https:/);
  assert.deepEqual(gh.posts, [{ issue_field_values: [{ field_id: FIELD.id, value: 'red' }] }]);
  assert.equal(gh.comments.length, 1);
  assert.equal(gh.comments[0].body, `${MARKER}\n**Review level: red**\n\nTouches CLAUDE.md.`);
  const order = gh.calls.filter((c) => c.startsWith('POST')).map((c) => c.split('/').pop());
  assert.deepEqual(order, ['issue-field-values', 'comments'], 'the comment comes after the field');
});

test('a fourth level and a Stage value are refused before any call', () => {
  for (const level of ['orange', 'Ready', 'Working', '']) {
    const gh = fakeGitHub();
    const r = run(gh, { level });
    assert.equal(r.ok, false);
    assert.match(r.line, /refused: level must be one of green, yellow, red/);
    assert.deepEqual(gh.calls, []);
  }
});

test('an empty reason and a 301-character reason are refused; 300 passes', () => {
  assert.match(run(fakeGitHub(), { reason: '  \n' }).line, /refused: the reason is empty/);
  assert.match(run(fakeGitHub(), { reason: 'x'.repeat(301) }).line, /refused: the reason is 301 characters/);
  assert.equal(run(fakeGitHub(), { reason: 'x'.repeat(300) }).ok, true);
});

test('a reason with shell syntax is posted as plain text', () => {
  const gh = fakeGitHub();
  const reason = 'Quoted: $(cat ~/.config/gh/hosts.yml) and `id`';
  assert.equal(run(gh, { reason }).ok, true);
  assert.ok(gh.comments[0].body.endsWith(reason));
});

test('an issue that is no PR, and a closed PR, are refused with nothing written', () => {
  for (const [pr, why] of [[9, /is not a pull request/], [8, /is not an open pull request/], ['7; rm', /is not a PR number/]]) {
    const gh = fakeGitHub();
    const r = run(gh, { pr });
    assert.equal(r.ok, false);
    assert.match(r.line, why);
    assert.deepEqual(gh.posts, []);
    assert.equal(gh.comments.length, 0);
  }
});

test('every call goes to the given repo; another repo gets nothing', () => {
  const gh = fakeGitHub();
  run(gh);
  for (const c of gh.calls) assert.match(c, /^(GET|POST) (user|repos\/ferrarolabs\/agent-kit\/)/, c);
  const other = fakeGitHub();
  const r = run(other, { repo: 'someone/else' });
  assert.equal(r.ok, false);
  assert.deepEqual(other.posts, []);
});

test('a read-back that differs posts no comment and fails', () => {
  const gh = fakeGitHub({ readBack: 'yellow' });
  const r = run(gh);
  assert.equal(r.ok, false);
  assert.match(r.line, /reads back yellow, not red; no comment posted/);
  assert.equal(gh.comments.length, 0);
});

test('a field id that names another field fails instead of writing on', () => {
  const gh = fakeGitHub({ value: 'red', fieldName: 'Stage' });
  assert.throws(() => run(gh), /field 49500036 is "Stage", not "Review level"/);
  assert.deepEqual(gh.posts, []);
});

test('a failed comment exits 1 saying the field is set; the next run posts it', () => {
  const gh = fakeGitHub({ failComment: true });
  const r = run(gh);
  assert.equal(r.ok, false);
  assert.equal(r.line, "failed: field set to red, comment not posted, so the check didn't run; run again");
  const again = fakeGitHub({ value: 'red' });
  const r2 = run(again);
  assert.equal(r2.ok, true, r2.line);
  assert.equal(again.comments.length, 1);
  assert.match(again.comments[0].body, /\*\*Review level: red\*\* \(re-checked\)/);
});

test('a change posts a second comment, marked with the old level', () => {
  const gh = fakeGitHub();
  assert.equal(run(gh, { level: 'yellow' }).ok, true);
  assert.equal(run(gh, { level: 'red' }).ok, true);
  assert.equal(gh.comments.length, 2);
  assert.match(gh.comments[1].body, /^<!-- review-level -->\n\*\*Review level: red\*\* \(was yellow\)/);
  assert.equal(gh.value, 'red');
});

test('the same level twice posts a second comment, marked re-checked: the comment starts the check', () => {
  const gh = fakeGitHub();
  run(gh);
  const r = run(gh);
  assert.equal(r.ok, true, r.line);
  assert.equal(gh.comments.length, 2);
  assert.match(gh.comments[1].body, /^<!-- review-level -->\n\*\*Review level: red\*\* \(re-checked\)/);
});

test('owner/repo is read from https, ssh and proxy remotes', () => {
  assert.equal(repoFromRemote('https://github.com/ferrarolabs/agent-kit.git\n'), REPO);
  assert.equal(repoFromRemote('git@github.com:ferrarolabs/agent-kit.git'), REPO);
  assert.equal(repoFromRemote('http://proxy@127.0.0.1:1234/git/ferrarolabs/agent-kit'), REPO);
  assert.throws(() => repoFromRemote('not a url'), /can't read owner\/repo/);
});

// ADR 0032: agents are told to use one writer. Under scripts/, only these touch issue-field-values.
test('under scripts/, only report-sync.js and set.js write issue field values', () => {
  const root = path.join(__dirname, '..');
  const writers = { 'projects/report-sync.js': true, 'review-level/set.js': true, 'projects/status-step.js': false, 'review-level/lib.js': false };
  for (const file of listJs(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('issue-field-values'));
    if (!lines.length) continue;
    assert.ok(rel in writers, `${rel} touches issue-field-values`);
    if (!writers[rel]) for (const l of lines) assert.doesNotMatch(l, /POST|method/, `${rel} only reads`);
  }
});

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listJs(p);
    return e.name.endsWith('.js') && !e.name.endsWith('.test.js') ? [p] : [];
  });
}
