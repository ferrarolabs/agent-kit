#!/usr/bin/env node
// Keeps a repo's GitHub labels in step with labels.yml files. Additive: it creates and
// corrects labels, and never deletes one (docs/decisions/0022-labels-as-code-additive.md).
//
//   node scripts/labels/sync-labels.js --repo <owner/name> [--extra <file>]... [--check | --dry-run]
//
// The kit's generic file (template/.github/labels.yml) comes first. Each --extra file is
// layered on top, in order: a label with the same name replaces the earlier one whole.
//
// Exit codes: 0 in step (or applied), 1 drift found by --check, 2 bad input or API error.
// Talks to GitHub only through `gh api` over REST, which works from a cloud session.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GENERIC = path.join(__dirname, '..', '..', 'template', '.github', 'labels.yml');
const KEYS = new Set(['name', 'color', 'description']);

// --- labels.yml: the small YAML subset the kit uses, and nothing else.
// A list of maps, one key per line: `- name: 'x'`, then `color:` and `description:`.
// Anything outside that subset is an error, not a guess.

function unquote(raw, where) {
  const v = raw.trim();
  if (v.startsWith("'")) {
    if (!v.endsWith("'") || v.length < 2) throw new Error(`${where}: unterminated quote`);
    return v.slice(1, -1).replace(/''/g, "'");
  }
  if (v.startsWith('"')) {
    if (!v.endsWith('"') || v.length < 2) throw new Error(`${where}: unterminated quote`);
    return JSON.parse(v);
  }
  // Plain scalar: a trailing " # comment" is not part of the value.
  return v.replace(/\s+#.*$/, '');
}

function parseLabels(text, file = 'labels.yml') {
  const labels = [];
  let current = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    if (/^\s*(#.*)?$/.test(line)) return;
    const m = line.match(/^(- |  )([a-z]+):(?:\s(.*))?$/);
    if (!m) throw new Error(`${where}: expected "- name: ..." or "  key: ...", got: ${line}`);
    const [, lead, key, raw = ''] = m;
    if (lead === '- ') {
      current = {};
      labels.push(current);
    } else if (!current) {
      throw new Error(`${where}: "${key}" before the first "- name:"`);
    }
    if (!KEYS.has(key)) throw new Error(`${where}: unknown key "${key}"`);
    if (key in current) throw new Error(`${where}: "${key}" given twice`);
    current[key] = unquote(raw, where);
  });
  for (const l of labels) validate(l, file);
  const seen = new Set();
  for (const l of labels) {
    const k = l.name.toLowerCase();
    if (seen.has(k)) throw new Error(`${file}: label "${l.name}" listed twice`);
    seen.add(k);
  }
  return labels;
}

function validate(label, file) {
  if (!label.name) throw new Error(`${file}: a label has no name`);
  if (!/^[0-9a-f]{6}$/i.test(label.color || '')) {
    throw new Error(`${file}: "${label.name}" needs a 6-digit hex color, got "${label.color}"`);
  }
  if ((label.description || '').length > 100) {
    throw new Error(`${file}: "${label.name}" description is over GitHub's 100 characters`);
  }
}

// Later files win, by name, case-insensitively (GitHub label names are).
function layer(...lists) {
  const byName = new Map();
  for (const list of lists) {
    for (const l of list) byName.set(l.name.toLowerCase(), l);
  }
  return [...byName.values()];
}

// --- The plan: what would change. Pure, so it is what the tests check.

function norm(label) {
  return {
    name: label.name,
    color: (label.color || '').toLowerCase(),
    description: label.description || '',
  };
}

function plan(desired, current) {
  const have = new Map(current.map((l) => [l.name.toLowerCase(), norm(l)]));
  const want = new Set();
  const create = [];
  const update = [];
  for (const raw of desired) {
    const d = norm(raw);
    const key = d.name.toLowerCase();
    want.add(key);
    const c = have.get(key);
    if (!c) {
      create.push(d);
      continue;
    }
    const changes = ['name', 'color', 'description'].filter((f) => c[f] !== d[f]);
    if (changes.length) update.push({ from: c.name, to: d, changes });
  }
  const extra = current.map((l) => l.name).filter((n) => !want.has(n.toLowerCase()));
  return { create, update, extra };
}

function report(p) {
  const lines = [];
  for (const l of p.create) lines.push(`create  ${l.name}  #${l.color}  ${l.description}`);
  for (const u of p.update) {
    lines.push(`update  ${u.from}  (${u.changes.join(', ')})  →  ${u.to.name}  #${u.to.color}  ${u.to.description}`);
  }
  for (const n of p.extra) lines.push(`extra   ${n}  (not in the files; left alone)`);
  return lines;
}

// --- The GitHub side, through `gh api`. Injected in tests.

function ghApi(args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function githubClient(gh = ghApi) {
  return {
    list(repo) {
      const out = gh([
        '--paginate',
        `repos/${repo}/labels?per_page=100`,
        '--jq',
        '.[] | {name, color, description}',
      ]);
      return out.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    },
    create(repo, l) {
      gh(['-X', 'POST', `repos/${repo}/labels`, '-f', `name=${l.name}`, '-f', `color=${l.color}`, '-f', `description=${l.description}`]);
    },
    update(repo, from, l) {
      gh([
        '-X',
        'PATCH',
        `repos/${repo}/labels/${encodeURIComponent(from)}`,
        '-f',
        `new_name=${l.name}`,
        '-f',
        `color=${l.color}`,
        '-f',
        `description=${l.description}`,
      ]);
    },
  };
}

// --- Command line.

function parseArgs(argv) {
  const opts = { repo: null, extra: [], mode: 'apply' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--extra') opts.extra.push(argv[++i]);
    else if (a === '--check') opts.mode = 'check';
    else if (a === '--dry-run') opts.mode = 'dry-run';
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!opts.repo || !/^[\w.-]+\/[\w.-]+$/.test(opts.repo)) throw new Error('--repo <owner/name> is required');
  if (opts.extra.some((f) => !f)) throw new Error('--extra needs a file');
  return opts;
}

function run(argv, { client = githubClient(), read = (f) => fs.readFileSync(f, 'utf8'), log = console.log } = {}) {
  const opts = parseArgs(argv);
  const files = [GENERIC, ...opts.extra];
  const desired = layer(...files.map((f) => parseLabels(read(f), f)));
  const p = plan(desired, client.list(opts.repo));
  const changes = p.create.length + p.update.length;

  log(`${opts.repo}: ${desired.length} labels in ${files.length} file(s), ${changes} to change, ${p.extra.length} extra`);
  for (const line of report(p)) log(`  ${line}`);

  if (opts.mode === 'check') return changes ? 1 : 0;
  if (opts.mode === 'dry-run') return 0;
  for (const l of p.create) client.create(opts.repo, l);
  for (const u of p.update) client.update(opts.repo, u.from, u.to);
  if (changes) log(`${opts.repo}: applied ${changes} change(s)`);
  return 0;
}

module.exports = { parseLabels, layer, plan, report, githubClient, parseArgs, run, GENERIC };

if (require.main === module) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (err) {
    console.error(`sync-labels: ${(err.stderr && String(err.stderr).trim()) || err.message}`);
    process.exitCode = 2;
  }
}
