// Keeps the writing-issues templates equal to the table in docs/issue-structure.md
// ("The body of each type"). Run: node scripts/check/issue-bodies.js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs', 'issue-structure.md');
const SKILL = path.join(ROOT, '.claude', 'skills', 'writing-issues');
const TYPES = ['Feature', 'Bug', 'Task', 'Epic', 'Decision'];

// The doc's table: | **Type** | A · B · C |  →  { Type: ['A', 'B', 'C'] }
function sectionsFromDoc(text) {
  const start = text.indexOf('### The body of each type');
  if (start < 0) return {};
  const block = text.slice(start).split('\n## ')[0];
  const out = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^\|\s*\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) out[m[1]] = m[2].split('·').map((s) => s.trim());
  }
  return out;
}

// A template's level-2 headings, in order.
function sectionsFromTemplate(text) {
  return text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());
}

function compare(doc, templates) {
  const errors = [];
  for (const type of TYPES) {
    const want = doc[type];
    const got = templates[type];
    if (!want) errors.push(`${type}: no row in the doc's table`);
    if (!got) errors.push(`${type}: no template`);
    if (want && got && want.join(' · ') !== got.join(' · ')) {
      errors.push(`${type}: doc says "${want.join(' · ')}", template has "${got.join(' · ')}"`);
    }
  }
  for (const type of Object.keys(templates)) {
    if (!TYPES.includes(type)) errors.push(`${type}: template for a type that doesn't exist`);
  }
  return errors;
}

function priorityLineErrors(templates, raw) {
  return Object.keys(templates)
    .filter((type) => !/\n\*\*Priority\*\*:[^\n]*\n?$/.test(raw[type]))
    .map((type) => `${type}: the template doesn't end with the Priority line`);
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

function load(root = ROOT) {
  const skill = path.join(root, '.claude', 'skills', 'writing-issues');
  const dir = path.join(skill, 'templates');
  const templates = {};
  const raw = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const type = file[0].toUpperCase() + file.slice(1, -3);
    raw[type] = fs.readFileSync(path.join(dir, file), 'utf8');
    templates[type] = sectionsFromTemplate(raw[type]);
  }
  const doc = sectionsFromDoc(fs.readFileSync(path.join(root, 'docs', 'issue-structure.md'), 'utf8'));
  return { doc, templates, raw };
}

if (require.main === module) {
  const { doc, templates, raw } = load();
  const errors = [...compare(doc, templates), ...priorityLineErrors(templates, raw)];
  for (const e of errors) console.error(`::error::${e}`);
  if (errors.length) process.exit(1);
  console.log(`issue bodies: ${TYPES.length} templates match ${path.relative(ROOT, DOC)}`);
}

module.exports = { TYPES, SKILL, sectionsFromDoc, sectionsFromTemplate, compare, priorityLineErrors, frontmatter, load };
