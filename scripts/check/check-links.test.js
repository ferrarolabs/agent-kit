// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { slug, anchorsOf, linksOf, check } = require('./check-links');

function repo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-links-'));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

test('slug follows GitHub: lower case, punctuation dropped, spaces to hyphens', () => {
  assert.equal(slug('Final layout of this repo'), 'final-layout-of-this-repo');
  assert.equal(slug('3.4 Size S / M / L'), '34-size-s--m--l');
  assert.equal(slug('`template/` and **bold**'), 'template-and-bold');
  assert.equal(slug('Phase 0 · Plan ✅'), 'phase-0--plan-');
});

test('repeated headings get -1, -2', () => {
  assert.deepEqual([...anchorsOf('# A\n## A\n### A\n')], ['a', 'a-1', 'a-2']);
});

test('links inside code are not links', () => {
  const text = 'see [x](a.md)\n```md\n[y](b.md)\n```\nand `[z](c.md)`';
  assert.deepEqual(
    linksOf(text).map((l) => l.target),
    ['a.md'],
  );
});

test('a link to a file that exists passes', () => {
  const dir = repo({ 'README.md': '[plan](docs/PLAN.md)', 'docs/PLAN.md': '# Plan' });
  assert.deepEqual(check(dir), []);
});

test('a link to a missing file fails with file:line', () => {
  const dir = repo({ 'README.md': 'intro\n\n[plan](docs/PLAN.md)' });
  assert.deepEqual(check(dir), ['README.md:3  missing file: docs/PLAN.md']);
});

test('a link to a missing anchor fails; a present one passes', () => {
  const dir = repo({
    'README.md': '[ok](docs/PLAN.md#goal) [bad](docs/PLAN.md#goals) [self](#intro)',
    'docs/PLAN.md': '## Goal',
  });
  assert.deepEqual(check(dir), ['README.md:1  missing anchor: docs/PLAN.md#goals', 'README.md:1  missing anchor: #intro']);
});

test('external links are not checked', () => {
  const dir = repo({ 'README.md': '[gh](https://github.com/nope) [mail](mailto:x@y.z)' });
  assert.deepEqual(check(dir), []);
});
