// Keeps the subagent definitions honest (ADR 0031, model policy ADR 0021).
// Every agent: name = file, a short description, a full-id model, a one-line tools list.
// Every refuter-*, in each agent folder: exactly those four keys, read-only local tools, the same shared block,
// at most 8, and one row each in the work-flow guide's areas table.
// Run: node scripts/check/agents.js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const AGENT_DIRS = [path.join('.claude', 'agents'), path.join('template', '.claude', 'agents')];
const GUIDE = path.join('docs', 'guides', 'work-flow.md');

const FULL_ID = /^claude-[a-z]+-\d+-\d+$/;
const MAX_DESCRIPTION = 250; // about 60 tokens: six refuters fit the 400-token listing budget (docs/tools.md)
// Set by the Grep probe of 2026-11-20: Grep obeys the Read(.env*) deny, so it stays (ADR 0031).
const REFUTER_TOOLS = ['Read', 'Grep', 'Glob'];
const REFUTER_KEYS = ['name', 'description', 'model', 'tools'];
const MAX_REFUTERS = 8;
const SHARED = /<!-- refuter:shared:start -->[\s\S]*?<!-- refuter:shared:end -->/;

// Frontmatter as { key: value }, with every line that isn't `key: value` reported.
// A YAML list (`tools:` then `- Read`) shows up as an empty value plus bad lines.
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { fields: null, bad: [] };
  const fields = {};
  const bad = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):[ \t]*(.*?)\s*$/);
    if (kv) fields[kv[1]] = kv[2];
    else if (line.trim()) bad.push(line);
  }
  return { fields, bad };
}

function tools(value) {
  return value.split(',').map((t) => t.trim()).filter(Boolean);
}

// agents: [{ file: 'refuter-x.md', text }]
function agentErrors(agents) {
  const errors = [];
  for (const { file, text } of agents) {
    const { fields, bad } = parseFrontmatter(text);
    if (!fields) {
      errors.push(`${file}: no frontmatter`);
      continue;
    }
    for (const line of bad) errors.push(`${file}: frontmatter line is not "key: value" on one line: "${line.trim()}"`);
    const base = file.replace(/\.md$/, '');
    if (fields.name !== base) errors.push(`${file}: name is "${fields.name ?? ''}", must be "${base}"`);
    if (!fields.description) errors.push(`${file}: description is missing or empty`);
    else if (fields.description.length > MAX_DESCRIPTION) {
      errors.push(`${file}: description is ${fields.description.length} characters, at most ${MAX_DESCRIPTION}`);
    }
    if (!FULL_ID.test(fields.model ?? '')) errors.push(`${file}: model "${fields.model ?? ''}" is not a full id (model policy)`);
    if (!fields.tools || tools(fields.tools).length === 0) {
      errors.push(`${file}: tools is missing or empty; without it an agent gets every tool`);
    }
  }
  return errors;
}

function refuterErrors(agents) {
  const refuters = agents.filter(({ file }) => path.basename(file).startsWith('refuter-'));
  const errors = [];
  if (refuters.length > MAX_REFUTERS) errors.push(`${refuters.length} refuters, at most ${MAX_REFUTERS}`);
  let first = null;
  for (const { file, text } of refuters) {
    const { fields } = parseFrontmatter(text);
    if (!fields) continue; // reported by agentErrors
    const keys = Object.keys(fields).sort();
    if (keys.join(',') !== [...REFUTER_KEYS].sort().join(',')) {
      errors.push(`${file}: keys are ${keys.join(', ')}; a refuter has exactly ${REFUTER_KEYS.join(', ')}`);
    }
    for (const t of tools(fields.tools ?? '')) {
      if (!REFUTER_TOOLS.includes(t)) errors.push(`${file}: tool "${t}" is not allowed; a refuter has only ${REFUTER_TOOLS.join(', ')}`);
    }
    const shared = text.match(SHARED);
    if (!shared) errors.push(`${file}: no shared block`);
    else if (!first) first = { file, block: shared[0] };
    else if (shared[0] !== first.block) errors.push(`${file}: shared block differs from ${first.file}`);
  }
  return errors;
}

// The `Agent` column of the areas table in the guide's §2.2.
function agentsFromGuide(text) {
  const start = text.indexOf('### 2.2');
  if (start < 0) return [];
  const block = text.slice(start).split('\n### ')[0];
  const out = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^\|[^|]+\|\s*`(refuter-[\w-]+)`\s*\|/);
    if (m) out.push(m[1]);
  }
  return out;
}

function guideErrors(guideAgents, files) {
  const have = files.filter((f) => f.startsWith('refuter-')).map((f) => f.replace(/\.md$/, ''));
  const errors = [];
  for (const a of guideAgents) if (!have.includes(a)) errors.push(`${GUIDE}: row for ${a}, but no .claude/agents/${a}.md`);
  for (const a of have) if (!guideAgents.includes(a)) errors.push(`.claude/agents/${a}.md: no row in the areas table of ${GUIDE} §2.2`);
  return errors;
}

function load(root = ROOT) {
  const all = [];
  for (const dir of AGENT_DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs).filter((f) => f.endsWith('.md')).sort()) {
      all.push({ dir, file, text: fs.readFileSync(path.join(abs, file), 'utf8') });
    }
  }
  const kit = all.filter((a) => a.dir === AGENT_DIRS[0]);
  // A project copy has no work-flow guide: its refuters are checked, the guide rows aren't.
  const guidePath = path.join(root, GUIDE);
  const guide = fs.existsSync(guidePath) ? agentsFromGuide(fs.readFileSync(guidePath, 'utf8')) : null;
  return { all, kit, guide };
}

function check(root = ROOT) {
  const { all, kit, guide } = load(root);
  return [
    ...agentErrors(all),
    // Refuter rules hold in each folder, so a refuter ported to template/ keeps them.
    ...AGENT_DIRS.flatMap((dir) => refuterErrors(all.filter((a) => a.dir === dir).map((a) => ({ ...a, file: dir === AGENT_DIRS[0] ? a.file : path.join(dir, a.file) })))),
    ...(guide ? guideErrors(guide, kit.map((a) => a.file)) : []),
  ];
}

if (require.main === module) {
  const errors = check();
  for (const e of errors) console.error(`::error::${e}`);
  if (errors.length) process.exit(1);
  console.log(load().guide ? 'agents: frontmatter, refuters and the guide agree' : `agents: frontmatter and refuters agree (no ${GUIDE} here, so no guide rows checked)`);
}

module.exports = {
  REFUTER_TOOLS, MAX_REFUTERS, parseFrontmatter, agentErrors, refuterErrors, agentsFromGuide, guideErrors, load, check,
};
