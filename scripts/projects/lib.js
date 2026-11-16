// Pure helpers for build-project.js: no network, so node:test can drive them.
'use strict';

// Fields every project has, whatever the spec says. Never reported as extra, never pruned.
const BUILT_IN = new Set([
  'Title', 'Assignees', 'Status', 'Labels', 'Linked pull requests', 'Milestone', 'Repository',
  'Reviewers', 'Parent issue', 'Sub-issues progress', 'Created', 'Updated', 'Closed', 'Type', 'Tracks', 'Tracked by',
]);

// Data types a person can create in a project. Built-in fields have their own types
// (TITLE, ASSIGNEES, LABELS, …), so a built-in name missing from BUILT_IN is still safe.
const USER_TYPES = new Set(['NUMBER', 'TEXT', 'DATE', 'SINGLE_SELECT', 'ITERATION']);

// A field the project owns: of a type a person creates, not built in, not an org issue field.
// Only these are reported as extra, and only these --prune may delete.
function isCustomField(f, spec) {
  return USER_TYPES.has(f.dataType) && !BUILT_IN.has(f.name) && !spec.issueFields.includes(f.name);
}

// Compares the spec with a live project. `live` is plain data:
//   { public, template, status: [{name, color}], fields: [{name, dataType}],
//     views: [{name, layout, filter, fields: [names], groupBy: [names], sortBy: [{field, direction}], columnBy: name|null}] }
// `views` is the spec's views plus the repo's extra views. Returns [{ ok, msg }].
function diff(spec, views, live, { asTemplate = false } = {}) {
  const out = [];
  const add = (ok, msg) => out.push({ ok, msg });

  if (asTemplate) add(live.template === true, 'marked as an org template');
  add(live.public === spec.public, `project is ${live.public ? 'public' : 'private'}${live.public === spec.public ? '' : `, spec says ${spec.public ? 'public' : 'private'}`}`);

  const want = spec.status.map((s) => s.name);
  const have = live.status.map((s) => s.name);
  if (JSON.stringify(want) !== JSON.stringify(have)) add(false, `Status options are [${have}], spec says [${want}]`);
  else {
    const off = spec.status.filter((s, i) => live.status[i].color !== s.color).map((s) => s.name);
    add(off.length === 0, off.length ? `Status colours differ: ${off.join(', ')}` : 'Status options match');
  }

  const names = live.fields.map((f) => f.name);
  for (const n of spec.issueFields) add(names.includes(n), `issue field "${n}"${names.includes(n) ? '' : ' missing'}`);
  for (const f of live.fields.filter((x) => isCustomField(x, spec))) add(false, `field "${f.name}" is not in the spec (--prune removes it from the template)`);

  for (const v of views) {
    const l = live.views.find((x) => x.name === v.name);
    if (!l) { add(false, `view "${v.name}" missing`); continue; }
    add(l.layout === v.layout, `view "${v.name}" layout ${l.layout}${l.layout === v.layout ? '' : `, spec says ${v.layout}`}`);
    add(l.filter === v.filter, `view "${v.name}" filter "${l.filter}"${l.filter === v.filter ? '' : `, spec says "${v.filter}"`}`);
    const missing = v.fields.filter((n) => !l.fields.includes(n));
    add(missing.length === 0, `view "${v.name}" fields${missing.length ? ' missing: ' + missing.join(', ') : ''}`);
    // Set by hand in the UI, read back here: only for views whose spec declares them.
    if (v.groupBy || v.sortBy || v.columnBy) {
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const want = { groupBy: v.groupBy || [], sortBy: v.sortBy || [], columnBy: v.columnBy || null };
      const have = { groupBy: l.groupBy || [], sortBy: l.sortBy || [], columnBy: l.columnBy || null };
      const show = (x) => JSON.stringify(x);
      add(same(want.groupBy, have.groupBy), `view "${v.name}" group by ${show(have.groupBy)}${same(want.groupBy, have.groupBy) ? '' : `, spec says ${show(want.groupBy)} (set by hand)`}`);
      add(same(want.sortBy, have.sortBy), `view "${v.name}" sort ${show(have.sortBy)}${same(want.sortBy, have.sortBy) ? '' : `, spec says ${show(want.sortBy)} (set by hand)`}`);
      add(want.columnBy === have.columnBy, `view "${v.name}" column field ${show(have.columnBy)}${want.columnBy === have.columnBy ? '' : `, spec says ${show(want.columnBy)} (set by hand)`}`);
    }
  }
  const wanted = new Set(views.map((v) => v.name));
  for (const l of live.views.filter((x) => !wanted.has(x.name))) add(false, `view "${l.name}" is not in the spec (--prune removes it from the template)`);

  return out;
}

// What --prune deletes: views and project-owned fields the spec doesn't name.
function pruneTargets(spec, views, live) {
  const wanted = new Set(views.map((v) => v.name));
  return {
    views: live.views.filter((x) => !wanted.has(x.name)),
    fields: live.fields.filter((x) => isCustomField(x, spec)),
  };
}

// Guards on the command line, before anything touches GitHub. Returns an error message or null.
function argError(args, spec, extraViews) {
  const fromTemplate = typeof args['from-template'] === 'string' ? args['from-template'] : null;
  if (args['from-template'] !== undefined && !fromTemplate) return '--from-template needs the template\'s title';
  if (fromTemplate && args.template === true) return '--from-template is for repo projects, not with --template';
  if (fromTemplate && !args.repo) return '--from-template needs --repo';
  if (fromTemplate && args.title === fromTemplate) return `--title can't be the template's own title ("${fromTemplate}")`;
  if (fromTemplate && args.check === true) return '--from-template builds; it can\'t run with --check';
  if (args.prune === true && args.template !== true) return '--prune is for the template only: repo projects are never pruned';
  if (args.prune === true && args.check === true) return '--prune changes the project; it can\'t run with --check';
  if (args.number !== undefined && !/^[1-9][0-9]{0,5}$/.test(String(args.number))) return '--number must be a project number';
  if (args.sync === true) {
    if (args.number === undefined) return '--sync needs --number: a registered project is found by number, never by title';
    if (args.check === true || args.prune === true || args['from-template'] !== undefined) return '--sync can\'t run with --check, --prune or --from-template';
  }
  const specNames = new Set(spec.views.map((v) => v.name));
  const clash = (extraViews || []).map((v) => v.name).filter((n) => specNames.has(n));
  if (clash.length) return `extra views can't reuse a spec view's name: ${clash.join(', ')}`;
  return null;
}

// Does a live view need an update to match the spec? Only what the API can set: layout, filter, visible fields.
function viewNeedsUpdate(v, live) {
  if (!live) return true;
  return live.layout !== v.layout || live.filter !== v.filter || v.fields.some((n) => !live.fields.includes(n));
}

// The kind of a result line. `manual`: only the UI can set it (group, sort, column field),
// so a sync can't fix it. `drift`: anything else that differs. `ok`: matches.
function kindOf(ok, msg) {
  if (ok) return 'ok';
  return /\(set by hand\)/.test(msg) ? 'manual' : 'drift';
}

const TITLE_RE = /^[A-Za-z0-9 ._-]{1,64}$/;
const REPO_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;

// scripts/projects/projects.json: { owner, projects: [{ title, number, repo? }] }.
// No repo means the org template; there is exactly one. Returns an error message or null.
function registryError(reg) {
  if (!reg || typeof reg !== 'object') return 'the registry is not an object';
  if (!REPO_RE.test(reg.owner || '')) return 'owner must be an org login';
  if (!Array.isArray(reg.projects) || reg.projects.length === 0) return 'projects must be a non-empty list';
  const titles = new Set();
  const numbers = new Set();
  let templates = 0;
  for (const [i, p] of reg.projects.entries()) {
    const keys = Object.keys(p).filter((k) => !['title', 'number', 'repo'].includes(k));
    if (keys.length) return `projects[${i}]: unknown key ${keys.join(', ')}`;
    if (!TITLE_RE.test(p.title || '')) return `projects[${i}]: title must be 1-64 letters, digits, spaces, dots, dashes or underscores`;
    if (!Number.isInteger(p.number) || p.number < 1) return `projects[${i}]: number must be a positive integer`;
    if (p.repo !== undefined && !REPO_RE.test(p.repo)) return `projects[${i}]: repo must be a bare repo name`;
    if (titles.has(p.title)) return `projects[${i}]: title "${p.title}" appears twice`;
    if (numbers.has(p.number)) return `projects[${i}]: number ${p.number} appears twice`;
    titles.add(p.title);
    numbers.add(p.number);
    if (p.repo === undefined) templates++;
  }
  if (templates > 1) return `exactly one entry without a repo (the org template), found ${templates}`;
  return null;
}

const LAYOUTS = new Set(['TABLE_LAYOUT', 'BOARD_LAYOUT', 'ROADMAP_LAYOUT']);

// A repo's .github/project-extra-views.json is read from that repo every night: it is input,
// so only known keys and bounded strings pass. Returns an error message or null.
function extraViewsError(extra) {
  if (!extra || typeof extra !== 'object' || !Array.isArray(extra.views)) return 'must be { "views": [...] }';
  if (extra.views.length > 10) return 'at most 10 extra views';
  const allowed = new Set(['name', 'layout', 'filter', 'fields', 'groupBy', 'sortBy', 'columnBy', 'manual']);
  for (const [i, v] of extra.views.entries()) {
    const keys = Object.keys(v).filter((k) => !allowed.has(k));
    if (keys.length) return `views[${i}]: unknown key ${keys.join(', ')}`;
    if (!TITLE_RE.test(v.name || '')) return `views[${i}]: bad name`;
    if (!LAYOUTS.has(v.layout)) return `views[${i}]: layout must be one of ${[...LAYOUTS].join(', ')}`;
    if (typeof v.filter !== 'string' || v.filter.length > 256) return `views[${i}]: filter must be a string of at most 256 characters`;
    if (!Array.isArray(v.fields) || v.fields.length > 20 || v.fields.some((f) => typeof f !== 'string' || f.length > 64)) return `views[${i}]: fields must be up to 20 names`;
  }
  return null;
}

// One board's outcome, from build-project.js --json (or its absence) and its exit code.
function boardOutcome(entry, json, code, stderrTail) {
  if (json && json.missing) return { ...entry, state: 'missing', lines: [] };
  if (!json) return { ...entry, state: 'error', lines: [], error: (stderrTail || `exit ${code}`).slice(-600) };
  const pick = (k) => json.results.filter((r) => r.kind === k).map((r) => r.msg);
  return {
    ...entry,
    state: pick('drift').length ? 'drift' : 'ok',
    url: json.url,
    changed: pick('changed'),
    drift: pick('drift'),
    manual: pick('manual'),
    actions: json.actions || [],
  };
}

const MARKER = '<!-- project-sync-report -->';
const ACTIONS = {
  missing: 'Restore the board, or remove it from `scripts/projects/projects.json`.',
  drift: 'The sync could not fix these. Read the run log; fix the spec or the board.',
  error: 'Re-run the workflow. If it fails again, check the `PROJECT_TOKEN` secret in the `projects` environment.',
};

// What the report issue says, from all boards' outcomes. null means nothing needs Elia.
// Only what needs action: states, board names and short reasons. Never item lists.
function reportLines(outcomes) {
  const lines = [];
  for (const state of ['error', 'missing', 'drift']) {
    const hit = outcomes.filter((o) => o.state === state);
    if (!hit.length) continue;
    lines.push(`### ${state === 'error' ? 'Errors' : state === 'missing' ? 'Missing boards' : 'Not fixed'}`, ACTIONS[state]);
    for (const o of hit) {
      lines.push(`- **${o.title}**${o.number ? ` (project ${o.number})` : ""}${state === 'error' ? `: ${String(o.error).split('\n').filter(Boolean).pop() || 'failed'}` : ''}`);
      if (state === 'drift') for (const d of o.drift.slice(0, 10)) lines.push(`  - ${d}`);
    }
  }
  const todo = outcomes.flatMap((o) => (o.actions || []).map((a) => `- **${o.title}**: ${a}`));
  if (todo.length) lines.push('### To do by hand', 'The API can\'t do these.', ...todo.slice(0, 30));
  return lines.length ? lines : null;
}

// What to do with the report issue. `open` is the open report issue, or null.
// Returns one of: none, create, comment (the lines changed), touch (same lines: edit only), close.
function reportAction(lines, open) {
  if (!lines) return open ? 'close' : 'none';
  if (!open) return 'create';
  return hashLines(lines) === linesHashOf(open.body) ? 'touch' : 'comment';
}

function hashLines(lines) {
  return require('crypto').createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16);
}
function linesHashOf(body) {
  const m = /<!-- lines: ([0-9a-f]{16}) -->/.exec(body || '');
  return m ? m[1] : null;
}

function reportBody(lines, runUrl, now) {
  return [
    MARKER,
    `<!-- lines: ${hashLines(lines)} -->`,
    'The nightly [project sync](https://github.com/ferrarolabs/agent-kit/issues/66) found something it can\'t fix. Each section says what to do. This issue closes itself when a run finds nothing.',
    '',
    ...lines,
    '',
    `Last seen: ${now}, [run](${runUrl}).`,
  ].join('\n');
}

module.exports = {
  BUILT_IN, USER_TYPES, isCustomField, diff, pruneTargets, argError, viewNeedsUpdate,
  kindOf, registryError, extraViewsError, boardOutcome, MARKER, reportLines, reportAction, reportBody, hashLines,
};
