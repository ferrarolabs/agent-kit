// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib');
const { run } = require('./check');

const REPO = 'ferrarolabs/agent-kit';
const SHA = (n) => String(n).padStart(40, 'a');
const RED = lib.parseGlobs(fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'review-level-red.txt'), 'utf8'));

// A fake GitHub. PRs: { n: { level, files, base, state, changed } }. Queue: chain of merge commits.
function fakeGitHub({ prs = {}, chain = [], mergeBase = SHA(0), failRead } = {}) {
  const gh = { reads: [], writes: [] };
  gh.read = ([method, p]) => {
    gh.reads.push(`${method} ${p}`);
    if (method !== 'GET') throw new Error(`read() used for ${method}`);
    if (failRead && p.includes(failRead)) throw new Error('HTTP 403: Resource not accessible');
    let m;
    if ((m = p.match(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)$/))) {
      const pr = prs[m[1]];
      if (!pr) throw new Error('HTTP 404');
      const files = pr.files || [];
      return { number: Number(m[1]), state: pr.state || 'open', base: { ref: pr.base || 'main' }, head: { sha: SHA(m[1]) }, changed_files: pr.changed ?? files.length };
    }
    if ((m = p.match(/^repos\/[^/]+\/[^/]+\/pulls\/(\d+)\/files/))) {
      const files = prs[m[1]].files || [];
      const pages = [];
      for (let i = 0; i < files.length; i += 100) pages.push(files.slice(i, i + 100).map((x) => (typeof x === 'string' ? { filename: x } : x)));
      return pages;
    }
    if ((m = p.match(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/issue-field-values$/))) {
      const level = prs[m[1]].level;
      return level ? [{ issue_field_id: lib.FIELD.id, issue_field_name: lib.FIELD.name, single_select_option: { name: level } }] : [];
    }
    if (/\/compare\//.test(p)) return { merge_base_commit: { sha: mergeBase } };
    if ((m = p.match(/\/commits\/([0-9a-f]{40})$/))) {
      const i = chain.findIndex((c) => c.sha === m[1]);
      return { sha: chain[i].sha, commit: { message: chain[i].message }, parents: [{ sha: i + 1 < chain.length ? chain[i + 1].sha : mergeBase }] };
    }
    throw new Error(`unexpected read ${p}`);
  };
  gh.write = ([method, p], body) => {
    gh.writes.push({ call: `${method} ${p}`, body });
    return { id: gh.writes.length };
  };
  return gh;
}

const body = (level, reason = 'Docs only.') => lib.comment(level, null, reason);
const comment = (gh, pr, extra = {}) => run({
  env: { MODE: 'comment', GITHUB_REPOSITORY: REPO, DEFAULT_BRANCH: 'main', PR_NUMBER: String(pr), COMMENT_BODY: body('green'), ...extra },
  read: gh.read, write: gh.write, globs: RED,
});
const posted = (gh) => gh.writes.map((w) => `${w.body.head_sha.slice(-3)} ${w.body.conclusion} · ${w.body.output.title}`);

test('R1: a marked comment on a PR with no level posts "no review level yet"', () => {
  const gh = fakeGitHub({ prs: { 7: { files: ['docs/a.md'] } } });
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 failure · no review level yet']);
  assert.equal(gh.writes[0].call, `POST repos/${REPO}/check-runs`);
  assert.equal(gh.writes[0].body.name, 'Review level');
  assert.equal(gh.writes[0].body.status, 'completed');
});

test('R2: green on a PR touching .claude/settings.json fails, naming the file', () => {
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files: ['docs/a.md', '.claude/settings.json'] } } });
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 failure · green · floor red']);
  assert.match(gh.writes[0].body.output.summary, /- `\.claude\/settings\.json`/);
  assert.doesNotMatch(gh.writes[0].body.output.summary, /docs\/a\.md/);
});

test('R3: green on a docs-only PR passes, quoting the reason', () => {
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files: ['docs/a.md'] } } });
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 success · green · no floor']);
  assert.match(gh.writes[0].body.output.summary, /```text\nDocs only\.\n```/);
});

test('R6: the files are read again on each run, so a new red file fails the new head', () => {
  const prs = { 7: { level: 'green', files: ['docs/a.md'] } };
  const gh = fakeGitHub({ prs });
  comment(gh, 7);
  prs[7].files.push('.claude/x');
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 success · green · no floor', 'aa7 failure · green · floor red']);
});

test('R8: a PR that edits the red list, removing a path, is red', () => {
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files: ['.github/review-level-red.txt'] } } });
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 failure · green · floor red']);
  assert.match(gh.writes[0].body.output.summary, /review-level-red\.txt/);
});

test('R4b: a read error and an unknown value post an error check', () => {
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files: ['docs/a.md'] } }, failRead: 'issue-field-values' });
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 failure · error: HTTP 403: Resource not accessible']);
  const odd = fakeGitHub({ prs: { 7: { level: 'purple', files: ['docs/a.md'] } } });
  comment(odd, 7);
  assert.deepEqual(posted(odd), ['aa7 failure · error: unknown review level "purple"']);
});

test('a truncated file list fails closed', () => {
  const short = fakeGitHub({ prs: { 7: { level: 'green', files: ['docs/a.md'], changed: 2 } } });
  comment(short, 7);
  assert.deepEqual(posted(short), ['aa7 failure · error: file list truncated: read 1 of 2 files']);
  const capped = fakeGitHub({ prs: { 7: { level: 'green', files: Array.from({ length: 3000 }, (_, i) => `docs/${i}.md`) } } });
  comment(capped, 7);
  assert.match(posted(capped)[0], /failure · error: file list truncated: read 3000 of 3000/);
});

test('files are read across pages', () => {
  const files = Array.from({ length: 250 }, (_, i) => `docs/${i}.md`).concat(['.claude/x']);
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files } } });
  comment(gh, 7);
  assert.deepEqual(posted(gh), ['aa7 failure · green · floor red']);
});

test('a PR into another branch, or a closed one, is skipped with nothing posted', () => {
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files: ['docs/a.md'], base: 'staging' }, 8: { state: 'closed' } } });
  assert.match(comment(gh, 7).skipped, /targets staging, not main/);
  assert.match(comment(gh, 8).skipped, /is closed/);
  assert.deepEqual(gh.writes, []);
});

test('the default branch is read from the event: dev in a project', () => {
  const gh = fakeGitHub({ prs: { 7: { level: 'green', files: ['docs/a.md'], base: 'dev' } } });
  comment(gh, 7, { DEFAULT_BRANCH: 'dev' });
  assert.deepEqual(posted(gh), ['aa7 success · green · no floor']);
});

test('bad event values are refused before any call', () => {
  for (const extra of [{ PR_NUMBER: '7; rm -rf /' }, { PR_NUMBER: '' }, { GITHUB_REPOSITORY: 'a/b c' }, { DEFAULT_BRANCH: 'main$(id)' }, { MODE: 'other' }]) {
    const gh = fakeGitHub({ prs: { 7: { level: 'green', files: [] } } });
    assert.throws(() => comment(gh, 7, extra));
    assert.deepEqual(gh.reads, [], JSON.stringify(extra));
  }
});

// The queue: a group of PRs merged in order 195, 196, 197; the head is 197's merge commit.
const mc = (n) => ({ sha: SHA(1000 + n), message: `Merge pull request #${n} from ferrarolabs/x` });
const queue = (gh, extra = {}) => run({
  env: { MODE: 'queue', GITHUB_REPOSITORY: REPO, DEFAULT_BRANCH: 'main', HEAD_SHA: SHA(1197), HEAD_BRANCH: `gh-readonly-queue/main/pr-197-${SHA(1)}`, ...extra },
  read: gh.read, write: gh.write, globs: RED,
});

test('R7: the queue checks every PR in the group, and one under its floor fails it', () => {
  const prs = { 195: { level: 'green', files: ['docs/a.md'] }, 196: { level: 'green', files: ['CLAUDE.md'] }, 197: { level: 'red', files: ['scripts/x.js'] } };
  const gh = fakeGitHub({ prs, chain: [mc(197), mc(196), mc(195)] });
  queue(gh);
  assert.equal(gh.writes.length, 1);
  assert.equal(gh.writes[0].body.head_sha, SHA(1197));
  assert.equal(gh.writes[0].body.output.title, '#196 green · floor red (1 of 3)');
  assert.equal(gh.writes[0].body.conclusion, 'failure');
  prs[196].level = 'red';
  queue(gh);
  assert.equal(gh.writes[1].body.conclusion, 'success');
  assert.equal(gh.writes[1].body.output.title, '3 PRs at or above the floor');
});

test('the queue fails closed when the group does not explain itself', () => {
  const prs = { 197: { level: 'red', files: [] } };
  const odd = fakeGitHub({ prs, chain: [mc(197), { sha: SHA(1500), message: 'chore: sneaked in' }] });
  queue(odd);
  assert.match(odd.writes[0].body.output.title, /^error: queue group unresolved: .* is not a PR merge commit/);
  const wrong = fakeGitHub({ prs, chain: [mc(197)] });
  queue(wrong, { HEAD_BRANCH: `gh-readonly-queue/main/pr-198-${SHA(1)}` });
  assert.match(wrong.writes[0].body.output.title, /head merges #197, the branch names #198/);
  const notQueue = fakeGitHub({ prs, chain: [mc(197)] });
  queue(notQueue, { HEAD_BRANCH: 'feat/x' });
  assert.match(notQueue.writes[0].body.output.title, /not a merge queue branch of main/);
});

test('a bad queue SHA is refused before any call', () => {
  const gh = fakeGitHub();
  assert.throws(() => queue(gh, { HEAD_SHA: 'abc' }), /bad head SHA/);
  assert.deepEqual(gh.reads, []);
  assert.deepEqual(gh.writes, []);
});

// R9: the check writes one thing, its check run, and only through write().
test('R9: the only write is check-runs, and reads never write', () => {
  const src = fs.readFileSync(path.join(__dirname, 'check.js'), 'utf8');
  const calls = [...src.matchAll(/\b(read|write)\(\[\s*'([A-Z]+)',\s*`([^`]+)`/g)].map((m) => `${m[1]} ${m[2]} ${m[3]}`);
  assert.ok(calls.length >= 5, calls.join('\n'));
  for (const c of calls) {
    if (c.startsWith('write ')) assert.match(c, /^write POST repos\/\$\{repo\}\/check-runs$/, c);
    else assert.match(c, /^read GET /, c);
  }
  assert.doesNotMatch(src, /\b(execFileSync|execSync|spawn)\b/, 'check.js runs nothing itself');
  const lib = fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8');
  assert.doesNotMatch(lib, /\b(POST|PATCH|PUT|DELETE)\b/, 'lib.js writes nothing');
});
