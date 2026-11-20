// Run with: node --test (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TYPES, SKILL, sectionsFromDoc, sectionsFromTemplate, compare, priorityLineErrors, frontmatter, load } = require('./issue-bodies');

const ROOT = path.join(__dirname, '..', '..');

test('every type has a template, and its sections match the doc', () => {
  const { doc, templates, raw } = load();
  assert.deepEqual(Object.keys(doc).sort(), [...TYPES].sort());
  assert.deepEqual(compare(doc, templates), []);
  assert.deepEqual(priorityLineErrors(templates, raw), []);
});

test('a renamed heading is caught', () => {
  const { doc, templates } = load();
  const broken = { ...templates, Feature: templates.Feature.map((s) => (s === 'Functional requirements' ? 'Requirements' : s)) };
  assert.match(compare(doc, broken).join('\n'), /Feature: doc says/);
});

test('a missing template, a missing row and an unknown type are caught', () => {
  const { doc, templates } = load();
  const { Bug, ...noBug } = templates;
  assert.match(compare(doc, noBug).join('\n'), /Bug: no template/);
  const { Task, ...noTaskRow } = doc;
  assert.match(compare(noTaskRow, templates).join('\n'), /Task: no row/);
  assert.match(compare(doc, { ...templates, Story: ['Goal'] }).join('\n'), /Story: template for a type/);
});

test('a template without the Priority line is caught', () => {
  const raw = { Feature: '## Problem\n\n## Goal\n' };
  assert.match(priorityLineErrors({ Feature: ['Problem', 'Goal'] }, raw).join('\n'), /Priority line/);
});

test('the doc parser reads only its own table', () => {
  const text = '### The body of each type\n| Type | Sections |\n|---|---|\n| **Bug** | A · B |\n\n## 3. Next\n| **Task** | X |\n';
  assert.deepEqual(sectionsFromDoc(text), { Bug: ['A', 'B'] });
  assert.deepEqual(sectionsFromTemplate('## A\ntext\n### not this\n## B\n'), ['A', 'B']);
});

test('the skill and the cold reader load with what they need', () => {
  const skill = frontmatter(fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8'));
  assert.equal(skill.name, 'writing-issues');
  assert.ok(skill.description.length > 0 && skill.description.length <= 1024, 'description is 1–1024 characters');
  const agent = frontmatter(fs.readFileSync(path.join(ROOT, '.claude', 'agents', 'cold-reader.md'), 'utf8'));
  assert.equal(agent.name, 'cold-reader');
  assert.match(agent.model, /^claude-[a-z]+-\d+-\d+$/, 'model is a full id (model policy)');
  assert.equal(agent.tools, 'Read', 'Read only: no shell, no network, no MCP');
});
