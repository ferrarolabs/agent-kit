// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MAX_REFUTERS, parseFrontmatter, agentErrors, refuterErrors, agentsFromGuide, guideErrors, load, check } = require('./agents');

const ROOT = path.join(__dirname, '..', '..');

const SHARED = '<!-- refuter:shared:start -->\nRules.\n<!-- refuter:shared:end -->';
function agent(name, { fm, body = `\n${SHARED}\n` } = {}) {
  const front = fm ?? `name: ${name}\ndescription: Test agent.\nmodel: claude-opus-5-5\ntools: Read, Grep, Glob`;
  return { file: `${name}.md`, text: `---\n${front}\n---\n${body}` };
}
const errs = (fn, ...a) => fn(...a).join('\n');

test('the repo passes', () => {
  assert.deepEqual(check(), []);
});

test('the six refuters exist, and the guide lists the same six', () => {
  const { kit, guide } = load();
  const refuters = kit.map((a) => a.file).filter((f) => f.startsWith('refuter-'));
  assert.equal(refuters.length, 6);
  assert.equal(guide.length, 6);
});

test('the cold reader keeps Read only: no shell, no network, no MCP', () => {
  const text = fs.readFileSync(path.join(ROOT, '.claude', 'agents', 'cold-reader.md'), 'utf8');
  const { fields } = parseFrontmatter(text);
  assert.equal(fields.name, 'cold-reader');
  assert.match(fields.model, /^claude-[a-z]+-\d+-\d+$/, 'model is a full id (model policy)');
  assert.equal(fields.tools, 'Read', 'Read only: no shell, no network, no MCP');
});

test('a missing tools line is caught: without it an agent gets every tool', () => {
  const a = agent('x', { fm: 'name: x\ndescription: d\nmodel: claude-opus-5-5' });
  assert.match(errs(agentErrors, [a]), /x\.md: tools is missing/);
});

test('tools as a YAML list is caught', () => {
  const a = agent('x', { fm: 'name: x\ndescription: d\nmodel: claude-opus-5-5\ntools:\n  - Read' });
  const out = errs(agentErrors, [a]);
  assert.match(out, /tools is missing or empty/);
  assert.match(out, /not "key: value" on one line: "- Read"/);
});

test('an alias or a missing model is caught', () => {
  assert.match(errs(agentErrors, [agent('x', { fm: 'name: x\ndescription: d\nmodel: sonnet\ntools: Read' })]), /model "sonnet" is not a full id/);
  assert.match(errs(agentErrors, [agent('x', { fm: 'name: x\ndescription: d\ntools: Read' })]), /model "" is not a full id/);
});

test('a name that differs from the file, and a bad description, are caught', () => {
  assert.match(errs(agentErrors, [agent('x', { fm: 'name: y\ndescription: d\nmodel: claude-opus-5-5\ntools: Read' })]), /name is "y", must be "x"/);
  assert.match(errs(agentErrors, [agent('x', { fm: 'name: x\ndescription:\nmodel: claude-opus-5-5\ntools: Read' })]), /description is missing/);
  const long = 'a'.repeat(251);
  assert.match(errs(agentErrors, [agent('x', { fm: `name: x\ndescription: ${long}\nmodel: claude-opus-5-5\ntools: Read` })]), /251 characters/);
});

test('no frontmatter is caught', () => {
  assert.match(errs(agentErrors, [{ file: 'x.md', text: 'just text' }]), /x\.md: no frontmatter/);
});

test('a non-refuter agent may have other keys and tools', () => {
  const critic = agent('critic', { fm: 'name: critic\ndescription: d\nmodel: claude-opus-5-5\ntools: Read, Bash\npermissionMode: plan' });
  assert.deepEqual(agentErrors([critic]), []);
  assert.deepEqual(refuterErrors([critic]), []);
});

test('a refuter with Bash is caught', () => {
  const a = agent('refuter-x', { fm: 'name: refuter-x\ndescription: d\nmodel: claude-opus-5-5\ntools: Read, Bash' });
  assert.match(errs(refuterErrors, [a]), /tool "Bash" is not allowed/);
});

test('a refuter with an extra key is caught', () => {
  const a = agent('refuter-x', { fm: 'name: refuter-x\ndescription: d\nmodel: claude-opus-5-5\ntools: Read\npermissionMode: bypassPermissions' });
  assert.match(errs(refuterErrors, [a]), /a refuter has exactly name, description, model, tools/);
});

test('a missing or changed shared block is caught', () => {
  const ok = agent('refuter-a');
  assert.deepEqual(refuterErrors([ok, agent('refuter-b')]), []);
  assert.match(errs(refuterErrors, [ok, agent('refuter-b', { body: '\nno block\n' })]), /refuter-b\.md: no shared block/);
  const changed = agent('refuter-b', { body: `\n${SHARED.replace('Rules.', 'Rule.')}\n` });
  assert.match(errs(refuterErrors, [ok, changed]), /refuter-b\.md: shared block differs from refuter-a\.md/);
});

test('more than 8 refuters is caught', () => {
  const many = Array.from({ length: MAX_REFUTERS + 1 }, (_, i) => agent(`refuter-a${i}`));
  assert.match(errs(refuterErrors, many), /9 refuters, at most 8/);
  assert.deepEqual(refuterErrors(many.slice(0, MAX_REFUTERS)), []);
});

test('a guide row with no file, and a file with no row, are caught', () => {
  assert.match(errs(guideErrors, ['refuter-a', 'refuter-b'], ['refuter-a.md']), /row for refuter-b, but no/);
  assert.match(errs(guideErrors, ['refuter-a'], ['refuter-a.md', 'refuter-c.md', 'cold-reader.md']), /refuter-c\.md: no row/);
});

test('a project copy without the guide still checks its agents', () => {
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
  const dir = path.join(root, '.claude', 'agents');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['refuter-security.md', 'refuter-tests.md']) {
    fs.copyFileSync(path.join(ROOT, '.claude', 'agents', f), path.join(dir, f));
  }
  assert.equal(load(root).guide, null);
  assert.deepEqual(check(root), []);
  fs.appendFileSync(path.join(dir, 'refuter-x.md'), '---\nname: refuter-x\ndescription: d\nmodel: sonnet\ntools: Read, Bash\n---\n');
  const out = check(root).join('\n');
  assert.match(out, /model "sonnet"/);
  assert.match(out, /tool "Bash" is not allowed/);
  assert.match(out, /refuter-x\.md: no shared block/);
  fs.rmSync(root, { recursive: true });
});

test('a refuter in template/ is held to the refuter rules too', () => {
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
  const dir = path.join(root, 'template', '.claude', 'agents');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, '.claude', 'agents', 'refuter-tests.md'), path.join(dir, 'refuter-tests.md'));
  assert.deepEqual(check(root), []);
  const text = fs.readFileSync(path.join(dir, 'refuter-tests.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'refuter-tests.md'), text.replace('tools: Read, Grep, Glob', 'tools: Read, Bash'));
  fs.writeFileSync(path.join(dir, 'refuter-x.md'), text.replace('name: refuter-tests', 'name: refuter-x').replace('Stay in your area.', 'Stay anywhere.'));
  const out = check(root).join('\n');
  assert.match(out, /template\/\.claude\/agents\/refuter-tests\.md: tool "Bash" is not allowed/);
  assert.match(out, /refuter-x\.md: shared block differs/);
  fs.writeFileSync(path.join(dir, 'refuter-y.md'), text.replace('name: refuter-tests', 'name: refuter-y').replace('model: claude-opus-5-5', 'model: opus'));
  assert.match(check(root).join('\n'), /template\/\.claude\/agents\/refuter-y\.md: model "opus"/);
  fs.rmSync(root, { recursive: true });
});

test('the guide parser reads only the §2.2 table', () => {
  const text = '### 2.2 Ready\n| Area | Agent | Looks for |\n|---|---|---|\n| Tests | `refuter-tests` | x |\n\n### 2.3 Next\n| Other | `refuter-other` | y |\n';
  assert.deepEqual(agentsFromGuide(text), ['refuter-tests']);
});
