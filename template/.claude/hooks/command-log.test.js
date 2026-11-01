// Run with: node --test .claude/hooks/
// node:test, not a project's test runner: the hook is plain Node and must be testable
// in any project, with no dependency.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  redact,
  issueFromBranch,
  repoFromRemote,
  entryFor,
  buildReport,
  renderComment,
  handle,
  markerFor,
} = require('./command-log');

const NOW = new Date('2026-11-01T10:00:00Z');
const event = (name, extra = {}) => ({ hook_event_name: name, session_id: 's1', ...extra });

describe('redact', () => {
  // Each case names the exact text that must disappear. Each one is caught by a
  // different pattern, so removing any pattern turns one case red.
  const cases = [
    ['echo ghp_abcdefghijklmnopqrstuvwxyz0123', 'ghp_abcdefghijklmnopqrstuvwxyz0123'],
    [
      'echo github_pat_11ABCDEFG0123456789_abcdefghij',
      'github_pat_11ABCDEFG0123456789_abcdefghij',
    ],
    ['echo sk-ant-api03-abcdefghijklmnop', 'sk-ant-api03-abcdefghijklmnop'],
    ['echo sk-abcdefghijklmnopqrstuvwx', 'sk-abcdefghijklmnopqrstuvwx'],
    ['echo sb_secret_abcdefghijkl', 'sb_secret_abcdefghijkl'],
    [
      'curl -H "X-Client: eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJlc2ln"',
      'c2lnbmF0dXJlc2ln',
    ],
    ['aws configure set aws_access_key_id AKIAABCDEFGHIJKLMNOP', 'AKIAABCDEFGHIJKLMNOP'],
    ['curl -H "Authorization: Bearer opaque-value-123"', 'opaque-value-123'],
    ['curl "https://x.test/?password=hunter2&user=me"', 'hunter2'],
    ['some-cli login --token tok_0123456789abcdef', 'tok_0123456789abcdef'],
    ['psql postgres://admin:hunter2@db.example.com/app', 'hunter2'],
  ];
  for (const [command, secret] of cases) {
    it(`hides the secret in ${command}`, () => {
      const out = redact(command);
      assert.ok(!out.includes(secret), out);
      assert.ok(out.includes('[REDACTED]'), out);
    });
  }

  it('leaves a command without secrets as it is', () => {
    const command = 'npm test -- --watch=false && git push -u origin feat/12-sign-in';
    assert.equal(redact(command), command);
  });

  it('keeps a variable name, which is not its value', () => {
    assert.ok(redact('gh api -H "Authorization: Bearer $GH_TOKEN" user').includes('[REDACTED]'));
    assert.equal(redact('echo $GH_TOKEN'), 'echo $GH_TOKEN');
  });
});

describe('issueFromBranch', () => {
  it('reads the issue from <type>/<issue>-<slug>', () => {
    assert.equal(issueFromBranch('feat/12-sign-in'), 12);
    assert.equal(issueFromBranch('chore/30-command-log'), 30);
  });
  it('gives null when the branch names no issue', () => {
    assert.equal(issueFromBranch('dev'), null);
    assert.equal(issueFromBranch('claude/magical-brown-uxcnx6'), null);
    assert.equal(issueFromBranch(''), null);
  });
});

describe('repoFromRemote', () => {
  const cases = [
    ['https://github.com/owner/repo', 'owner/repo'],
    ['https://github.com/owner/repo.git', 'owner/repo'],
    ['git@github.com:owner/repo.git', 'owner/repo'],
    ['http://local_proxy@127.0.0.1:41047/git/owner/repo', 'owner/repo'],
  ];
  for (const [url, repo] of cases) {
    it(`${url} → ${repo}`, () => assert.equal(repoFromRemote(url), repo));
  }
  it('gives null for no remote', () => assert.equal(repoFromRemote(''), null));
});

describe('entryFor', () => {
  it('records an attempt with the redacted command and the join key', () => {
    const entry = entryFor(
      event('PreToolUse', {
        tool_use_id: 't1',
        tool_input: { command: 'echo ghp_abcdefghijklmnopqrstuvwxyz0123' },
      }),
      NOW,
    );
    assert.deepEqual(entry, {
      ts: '2026-11-01T10:00:00.000Z',
      session: 's1',
      kind: 'attempt',
      id: 't1',
      command: 'echo [REDACTED]',
    });
  });
  it('records a failure with its error', () => {
    const entry = entryFor(
      event('PostToolUseFailure', { tool_use_id: 't1', error: 'Exit code 1' }),
      NOW,
    );
    assert.equal(entry.kind, 'failed');
    assert.equal(entry.error, 'Exit code 1');
  });
  it('ignores events it does not log', () => {
    assert.equal(entryFor(event('Notification'), NOW), null);
  });
});

describe('buildReport', () => {
  const lines = [
    {
      kind: 'session',
      session: 's1',
      cwd: '/repo',
      project: { deny: 3, ask: 1, allow: 2, sha256: 'abc' },
    },
    { kind: 'attempt', id: 'a', ts: '2026-11-01T10:00:01Z', command: 'echo hi' },
    { kind: 'ok', id: 'a' },
    { kind: 'attempt', id: 'b', ts: '2026-11-01T10:00:02Z', command: 'false' },
    { kind: 'failed', id: 'b', error: 'Exit code 1' },
    { kind: 'attempt', id: 'c', ts: '2026-11-01T10:00:03Z', command: 'git push origin dev' },
  ];

  it('gives each command its outcome, and a denied one none', () => {
    assert.deepEqual(
      buildReport(lines).rows.map((r) => [r.command, r.outcome]),
      [
        ['echo hi', 'ok'],
        ['false', 'failed (Exit code 1)'],
        ['git push origin dev', 'no result: denied, or the session ended'],
      ],
    );
  });

  it('renders a comment that counts failures and denials and carries its marker', () => {
    const text = renderComment('s1', 30, buildReport(lines));
    assert.ok(text.startsWith(markerFor('s1')));
    assert.ok(text.includes('3 commands · 1 failed · 1 with no result'));
    assert.ok(text.includes('project 3 deny / 1 ask / 2 allow'));
    assert.ok(text.includes('| `git push origin dev` | no result: denied, or the session ended |'));
  });

  it('says when no project settings were loaded', () => {
    const text = renderComment('s1', 30, buildReport([{ ...lines[0], project: null }]));
    assert.ok(text.includes('project **none**'));
  });

  it('keeps a comment under GitHub’s size limit by dropping the oldest rows', () => {
    const many = Array.from({ length: 2000 }, (_, i) => [
      {
        kind: 'attempt',
        id: `x${i}`,
        ts: '2026-11-01T10:00:00Z',
        command: `echo ${'y'.repeat(50)} ${i}`,
      },
      { kind: 'ok', id: `x${i}` },
    ]).flat();
    const text = renderComment('s1', 30, buildReport(many));
    assert.ok(text.length <= 60000);
    assert.ok(text.includes('echo yyyy'));
    assert.ok(text.includes(' 1999`'));
    assert.ok(text.includes('older rows cut'));
  });
});

describe('handle', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'command-log-'));
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(
      path.join(dir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { deny: ['x', 'y'] } }),
    );
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const env = () => ({ CLAUDE_PROJECT_DIR: dir, HOME: dir, COMMAND_LOG_PUBLISH: '0' });
  const log = () =>
    fs
      .readFileSync(path.join(dir, '.claude', 'logs', 's1.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));

  it('writes the config line, then one line per event, to the session file', () => {
    handle(event('SessionStart', { cwd: dir, source: 'startup' }), env());
    handle(event('PreToolUse', { tool_use_id: 't', tool_input: { command: 'ls' } }), env());
    handle(event('PostToolUse', { tool_use_id: 't', duration_ms: 5 }), env());
    const [session, attempt, ok] = log();
    assert.equal(session.kind, 'session');
    assert.equal(session.cwd, dir);
    assert.deepEqual(
      { deny: session.project.deny, ask: session.project.ask, allow: session.project.allow },
      { deny: 2, ask: 0, allow: 0 },
    );
    assert.equal(attempt.kind, 'attempt');
    assert.equal(attempt.command, 'ls');
    assert.equal(attempt.session, 's1');
    assert.equal(ok.kind, 'ok');
    assert.equal(ok.id, 't');
  });

  it('does not publish when told not to', () => {
    assert.equal(handle(event('Stop'), env()), 'not published: COMMAND_LOG_PUBLISH=0');
  });
});
