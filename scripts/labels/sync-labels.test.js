// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseLabels, layer, plan, githubClient, parseArgs, run, GENERIC } = require('./sync-labels');

// An in-memory repo's labels, behind the same interface as githubClient.
function fakeGitHub(labels) {
  const store = labels.map((l) => ({ ...l }));
  const calls = [];
  return {
    store,
    calls,
    list: () => store.map((l) => ({ ...l })),
    create(repo, l) {
      calls.push(['create', l.name]);
      store.push({ ...l });
    },
    update(repo, from, l) {
      calls.push(['update', from]);
      const i = store.findIndex((s) => s.name.toLowerCase() === from.toLowerCase());
      store[i] = { ...l };
    },
  };
}

const files = {
  'base.yml': `# generic
- name: 'type:bug'
  color: 'd73a4a'
  description: Something that behaves wrongly
- name: 'agent:ready'
  color: '2DA44E'
  description: Spec is complete; an agent may pick this up
`,
  'repo.yml': `- name: 'type:bug'
  color: 'd73a4a'
  description: Something a musician hits
- name: 'epic:A'
  color: 'd4c5f9'
  description: Epic A — getting in
`,
};
const read = (f) => (f === GENERIC ? files['base.yml'] : files[f]);
const quiet = () => {};

function inStep() {
  return [
    { name: 'type:bug', color: 'd73a4a', description: 'Something a musician hits' },
    { name: 'agent:ready', color: '2da44e', description: 'Spec is complete; an agent may pick this up' },
    { name: 'epic:A', color: 'd4c5f9', description: 'Epic A — getting in' },
    { name: 'wontfix', color: 'ffffff', description: 'GitHub default' },
  ];
}

test('parses the kit file and both repos\' own files', () => {
  const generic = parseLabels(fs.readFileSync(GENERIC, 'utf8'), GENERIC);
  assert.ok(generic.length >= 9);
  assert.ok(generic.every((l) => l.name && /^[0-9a-f]{6}$/.test(l.color)));
  assert.deepEqual(generic.find((l) => l.name === 'type:bug'), {
    name: 'type:bug',
    color: 'd73a4a',
    description: 'Something that behaves wrongly',
  });
  const own = parseLabels(fs.readFileSync('.github/labels.yml', 'utf8'), '.github/labels.yml');
  assert.ok(own.length > 0);
});

test('quotes: single with doubled quote, double with escapes, plain with a trailing comment', () => {
  const [a, b, c] = parseLabels(`- name: 'it''s'
  color: 'aaaaaa'
- name: "x\\"y"
  color: bbbbbb
- name: plain # a comment
  color: cccccc
  description: Has: a colon
`);
  assert.equal(a.name, "it's");
  assert.equal(b.name, 'x"y');
  assert.equal(c.name, 'plain');
  assert.equal(c.description, 'Has: a colon');
});

test('anything outside the subset is an error with its line', () => {
  assert.throws(() => parseLabels("- name: 'a'\n  colour: 'aaaaaa'\n", 'f'), /f:2: unknown key "colour"/);
  assert.throws(() => parseLabels("  color: 'aaaaaa'\n", 'f'), /f:1: "color" before the first/);
  assert.throws(() => parseLabels("- name: 'a'\n    color: 'aaaaaa'\n", 'f'), /f:2: expected/);
  assert.throws(() => parseLabels("- name: 'a\n  color: 'aaaaaa'\n", 'f'), /f:1: unterminated quote/);
  assert.throws(() => parseLabels("- name: 'a'\n  color: 'red'\n", 'f'), /6-digit hex color/);
  assert.throws(() => parseLabels("- name: 'a'\n  color: 'aaaaaa'\n- name: 'A'\n  color: 'aaaaaa'\n", 'f'), /listed twice/);
  assert.throws(() => parseLabels(`- name: 'a'\n  color: 'aaaaaa'\n  description: ${'x'.repeat(101)}\n`, 'f'), /100 characters/);
});

test('a later file replaces a label of the same name, case-insensitively', () => {
  const out = layer(
    [{ name: 'type:bug', color: '111111', description: 'base' }, { name: 'x', color: '222222' }],
    [{ name: 'Type:Bug', color: '333333', description: 'repo' }],
  );
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { name: 'Type:Bug', color: '333333', description: 'repo' });
});

test('plan: in step means nothing to create or update; extras are only listed', () => {
  const desired = layer(parseLabels(files['base.yml']), parseLabels(files['repo.yml']));
  const p = plan(desired, inStep());
  assert.deepEqual(p.create, []);
  assert.deepEqual(p.update, []);
  assert.deepEqual(p.extra, ['wontfix']);
});

test('plan: color case and a null description are not drift', () => {
  const p = plan([{ name: 'a', color: 'ABCDEF' }], [{ name: 'a', color: 'abcdef', description: null }]);
  assert.deepEqual(p.update, []);
});

test('plan: a wrong color, description or name case is an update', () => {
  const p = plan(
    [{ name: 'Type:Bug', color: 'd73a4a', description: 'new' }],
    [{ name: 'type:bug', color: '000000', description: 'old' }],
  );
  assert.equal(p.update.length, 1);
  assert.equal(p.update[0].from, 'type:bug');
  assert.deepEqual(p.update[0].changes, ['name', 'color', 'description']);
});

test('--check exits 0 in step, and writes nothing', () => {
  const gh = fakeGitHub(inStep());
  assert.equal(run(['--repo', 'o/r', '--extra', 'repo.yml', '--check'], { client: gh, read, log: quiet }), 0);
  assert.deepEqual(gh.calls, []);
});

test('--check exits 1 on drift (seen failing), and writes nothing', () => {
  const labels = inStep();
  labels[0].color = '000000';
  const gh = fakeGitHub(labels);
  const out = [];
  assert.equal(run(['--repo', 'o/r', '--extra', 'repo.yml', '--check'], { client: gh, read, log: (l) => out.push(l) }), 1);
  assert.deepEqual(gh.calls, []);
  assert.match(out.join('\n'), /update {2}type:bug {2}\(color\)/);
});

test('a label deleted by hand comes back on the next run, and a second run changes nothing', () => {
  const gh = fakeGitHub(inStep().filter((l) => l.name !== 'agent:ready'));
  assert.equal(run(['--repo', 'o/r', '--extra', 'repo.yml', '--check'], { client: gh, read, log: quiet }), 1);
  assert.equal(run(['--repo', 'o/r', '--extra', 'repo.yml'], { client: gh, read, log: quiet }), 0);
  assert.deepEqual(gh.calls, [['create', 'agent:ready']]);
  assert.equal(run(['--repo', 'o/r', '--extra', 'repo.yml', '--check'], { client: gh, read, log: quiet }), 0);
  run(['--repo', 'o/r', '--extra', 'repo.yml'], { client: gh, read, log: quiet });
  assert.equal(gh.calls.length, 1, 'idempotent: the second apply makes no call');
});

test('never deletes: a label that is not in the files survives an apply', () => {
  const gh = fakeGitHub(inStep());
  run(['--repo', 'o/r', '--extra', 'repo.yml'], { client: gh, read, log: quiet });
  assert.ok(gh.store.some((l) => l.name === 'wontfix'));
});

test('--dry-run reports drift, exits 0, writes nothing', () => {
  const gh = fakeGitHub([]);
  assert.equal(run(['--repo', 'o/r', '--dry-run'], { client: gh, read, log: quiet }), 0);
  assert.deepEqual(gh.calls, []);
});

test('arguments: --repo is required and must be owner/name', () => {
  assert.throws(() => parseArgs([]), /--repo/);
  assert.throws(() => parseArgs(['--repo', 'jamly']), /--repo/);
  assert.throws(() => parseArgs(['--repo', 'o/r', '--force']), /unknown argument/);
  assert.throws(() => parseArgs(['--repo', 'o/r', '--extra']), /--extra needs a file/);
  assert.deepEqual(parseArgs(['--repo', 'o/r', '--extra', 'a.yml', '--check']), {
    repo: 'o/r',
    extra: ['a.yml'],
    mode: 'check',
  });
});

test('the GitHub client calls gh api over REST, with the label name encoded', () => {
  const seen = [];
  const gh = (args) => {
    seen.push(args);
    return '{"name":"good first issue","color":"7057ff","description":null}\n';
  };
  const client = githubClient(gh);
  assert.deepEqual(client.list('o/r'), [{ name: 'good first issue', color: '7057ff', description: null }]);
  client.update('o/r', 'good first issue', { name: 'good first issue', color: '7057ff', description: 'd' });
  client.create('o/r', { name: 'type:bug', color: 'd73a4a', description: 'x' });
  assert.equal(seen[0][1], 'repos/o/r/labels?per_page=100');
  assert.deepEqual(seen[1].slice(0, 3), ['-X', 'PATCH', 'repos/o/r/labels/good%20first%20issue']);
  assert.ok(seen[2].includes('name=type:bug'));
  assert.ok(seen.every((args) => !args.some((a) => /graphql/.test(a))));
});
