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
//     views: [{name, number, layout, filter, fields: [names], groupBy: [names], sortBy: [{field, direction}], columnBy: name|null}],
//     workflows: { totalCount, nodes: [{name, number, enabled}] } }
// `views` is the spec's views plus the repo's extra views. Returns [{ ok, kind, msg, todo? }].
// `kind` is decided here, never from the message: board-controlled names are inside msg (issue 67).
//   drift:  differs, and the sync should have fixed it.
//   manual: differs, and only the UI can set it. `todo` says what to click: { key, text, view?, viewNumber?, workflows? }.
//   spec:   the board has something the spec doesn't know (GitHub renamed or added a workflow): fix the spec by PR.
function diff(spec, views, live, { asTemplate = false } = {}) {
  const out = [];
  const add = (ok, msg, kind = 'drift', todo) => out.push(ok ? { ok, kind: 'ok', msg } : { ok, kind, msg, ...(todo ? { todo } : {}) });

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
      const wantV = { groupBy: v.groupBy || [], sortBy: v.sortBy || [], columnBy: v.columnBy || null };
      const haveV = { groupBy: l.groupBy || [], sortBy: l.sortBy || [], columnBy: l.columnBy || null };
      const show = (x) => JSON.stringify(x);
      // The todo's text comes from the spec only: never a live value, so it can be grouped across boards and is safe to print.
      // `now` is the board's value: board-controlled, so the report prints it only escaped.
      const todo = (what, text, now) => ({ key: `view ${v.name} ${what}`, view: v.name, viewNumber: l.number, text, now });
      const column = (c) => (c ? `column field ${c}` : 'no column field');
      for (const [what, label, sentence, now] of [
        ['groupBy', 'group by', groupSentence(wantV.groupBy), groupSentence(haveV.groupBy)],
        ['sortBy', 'sort', sortSentence(wantV.sortBy), sortSentence(haveV.sortBy)],
        ['columnBy', 'column field', column(wantV.columnBy), column(haveV.columnBy)],
      ]) {
        const ok = same(wantV[what], haveV[what]);
        add(ok, `view "${v.name}" ${label} ${show(haveV[what])}${ok ? '' : `, spec says ${show(wantV[what])}`}`, 'manual', todo(what, sentence, now));
      }
    }
  }
  const wanted = new Set(views.map((v) => v.name));
  for (const l of live.views.filter((x) => !wanted.has(x.name))) add(false, `view "${l.name}" is not in the spec (--prune removes it from the template)`);

  // Workflows: the API reads whether each one is on, and can't set it (issue 67). It lists a workflow
  // only once it exists: the template has no "Auto-add to project" at all. So absent counts as off.
  if (spec.workflowStates && live.workflows) {
    const nodes = live.workflows.nodes;
    add(live.workflows.totalCount <= nodes.length, `workflows: read ${nodes.length} of ${live.workflows.totalCount}`);
    const specNames = new Set(spec.workflowStates.map((w) => w.name));
    const added = nodes.map((w) => w.name).filter((n) => !specNames.has(n));
    // A rename or a new GitHub workflow: one line per board, fixed in the spec by PR.
    add(!added.length, `workflows${added.length ? ` not in the spec: ${added.map((n) => JSON.stringify(n)).join(', ')}` : ' all in the spec'}`,
      'spec', { key: 'workflows spec', text: 'GitHub renamed or added a workflow: update `workflowStates` in `scripts/projects/project-template.json` by PR', added });
    for (const w of spec.workflowStates) {
      const l = nodes.find((x) => x.name === w.name);
      const on = asTemplate ? w.template : w.repo;
      const is = l ? l.enabled : false;
      add(is === on, `workflow "${w.name}" is ${l ? (is ? 'ON' : 'OFF') : 'absent'}${is === on ? '' : `, spec says ${on ? 'ON' : 'OFF'}`}`,
        'manual', { key: `workflow ${w.name} ${on}`, workflows: true, text: `turn **${w.name}** ${on ? 'on' : 'off'}`, now: l ? (is ? 'on' : 'off') : 'absent' });
    }
  }

  return out;
}

const groupSentence = (g) => (g.length ? `group by ${g.join(', ')}` : 'no grouping');
const DIRECTION = { ASC: 'ascending', DESC: 'descending' };
const sortSentence = (s) => (s.length ? `sort by ${s.map((x) => `${x.field}, ${DIRECTION[x.direction] || x.direction}`).join('; then ')}` : 'no sort');

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

// The kind of a result line: `ok` when it matches, else the kind diff() gave it, else drift.
// Never read from the message, which holds board-controlled names (issue 67).
function kindOf(ok, kind) {
  if (ok) return 'ok';
  return ['manual', 'spec'].includes(kind) ? kind : 'drift';
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
  if (templates !== 1) return `exactly one entry without a repo (the org template), found ${templates}`;
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
    // Set by hand and compared every night, so they reach the report issue: bounded too (issue 67).
    const name = (x) => typeof x === 'string' && x.length > 0 && x.length <= 64;
    if (v.groupBy !== undefined && (!Array.isArray(v.groupBy) || v.groupBy.length > 5 || !v.groupBy.every(name))) return `views[${i}]: groupBy must be up to 5 field names`;
    if (v.sortBy !== undefined && (!Array.isArray(v.sortBy) || v.sortBy.length > 5
      || !v.sortBy.every((x) => x && typeof x === 'object' && Object.keys(x).every((k) => k === 'field' || k === 'direction') && name(x.field) && ['ASC', 'DESC'].includes(x.direction)))) return `views[${i}]: sortBy must be up to 5 { field, direction: ASC or DESC }`;
    if (v.columnBy !== undefined && v.columnBy !== null && !name(v.columnBy)) return `views[${i}]: columnBy must be a field name or null`;
    if (v.manual !== undefined && (typeof v.manual !== 'string' || v.manual.length > 300)) return `views[${i}]: manual must be a string of at most 300 characters`;
  }
  return null;
}

// One board's outcome, from build-project.js --json (or its absence) and its exit code.
function boardOutcome(entry, json, code, stderrTail) {
  if (json && json.missing) return { ...entry, state: 'missing', lines: [] };
  if (!json) return { ...entry, state: 'error', lines: [], error: (stderrTail || `exit ${code}`).slice(-600) };
  const pick = (k) => json.results.filter((r) => r.kind === k).map((r) => r.msg);
  const todos = (k) => json.results.filter((r) => r.kind === k && r.todo).map((r) => r.todo);
  return {
    ...entry,
    state: pick('drift').length ? 'drift' : 'ok',
    url: json.url,
    changed: pick('changed'),
    drift: pick('drift'),
    manual: pick('manual'),
    todos: todos('manual'),
    spec: todos('spec'),
    actions: json.actions || [],
  };
}

// The line of a stack that says what went wrong: the error itself, not Node's version at the end.
function errorLine(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const hit = lines.filter((l) => /^(\w*Error\b|gh: )/.test(l)).pop();
  return hit || lines.pop() || 'failed';
}

const MARKER = '<!-- project-sync-report -->';
const ACTIONS = {
  missing: 'Restore the board, or remove it from `scripts/projects/projects.json`.',
  drift: 'The sync could not fix these. Read the run log; fix the spec or the board.',
  error: 'Re-run the workflow. If it fails again, check the `PROJECT_TOKEN` secret in the `projects` environment.',
};

// A board-controlled string, safe in an issue body: one line, no backticks, at most `max` characters,
// in a code span. No mention, link or markup can come out of it (issue 67).
function code(text, max = 64) {
  let t = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029`]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > max) t = `${t.slice(0, max - 1)}…`;
  return `\`${t || ' '}\``;
}

const MAX_LINES = 80;

// What the report issue says, from all boards' outcomes. null means nothing needs Elia.
// Only what needs action: states, board names and short reasons. Never item lists.
// The same click on several boards is one line, with a link per board. At most MAX_LINES lines.
function reportLines(outcomes, { runUrl = null } = {}) {
  const lines = [];
  const board = (o) => `**${o.title}**${o.number ? ` (project ${o.number})` : ''}`;
  for (const state of ['error', 'missing', 'drift']) {
    const hit = outcomes.filter((o) => o.state === state);
    if (!hit.length) continue;
    lines.push(`### ${state === 'error' ? 'Errors' : state === 'missing' ? 'Missing boards' : 'Not fixed'}`, ACTIONS[state]);
    for (const o of hit) {
      lines.push(`- ${board(o)}${state === 'error' ? `: ${code(errorLine(o.error), 200)}` : ''}`);
      if (state === 'drift') for (const d of o.drift.slice(0, 10)) lines.push(`  - ${code(d, 200)}`);
    }
  }

  // The spec is behind GitHub: one line per board, with the names GitHub has now.
  const specHits = outcomes.filter((o) => (o.spec || []).length);
  if (specHits.length) {
    lines.push('### Spec out of date', specHits[0].spec[0].text + '.');
    for (const o of specHits) {
      const t = o.spec[0];
      const part = (label, xs) => (xs.length ? `${label} ${xs.slice(0, 10).map((n) => code(n)).join(', ')}` : null);
      lines.push(`- ${board(o)}: ${part('not in the spec:', t.added || [])}`);
    }
  }

  // To do by hand: what only the UI can set, grouped across boards; then the actions the sync found.
  const groups = new Map();
  for (const o of outcomes) {
    for (const t of o.todos || []) {
      if (!groups.has(t.key)) groups.set(t.key, { todo: t, boards: [] });
      groups.get(t.key).boards.push({ o, t });
    }
  }
  const link = (o, t) => {
    if (!o.url) return o.title;
    const href = t.workflows ? `${o.url}/workflows` : t.viewNumber ? `${o.url}/views/${t.viewNumber}` : o.url;
    return `[${o.title}](${href})${t.now ? ` (now ${code(t.now)})` : ''}`;
  };
  const todo = [];
  for (const { todo: t, boards } of groups.values()) {
    const where = t.view ? `${code(t.view)}: ` : '';
    todo.push(`- ${where}should be: ${t.text}. Differs on: ${boards.map((b) => link(b.o, b.t)).join(', ')}`);
  }
  for (const o of outcomes) for (const a of o.actions || []) todo.push(`- ${board(o)}: ${a}`);
  if (todo.length) lines.push('### To do by hand', 'The API can\'t do these. Each link opens the view, or the board\'s workflows.', ...todo);

  if (!lines.length) return null;
  if (lines.length > MAX_LINES) {
    const more = lines.length - (MAX_LINES - 1);
    return [...lines.slice(0, MAX_LINES - 1), `…and ${more} more line(s)${runUrl ? `: see the [run](${runUrl})` : ': see the run'}.`];
  }
  return lines;
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

// The body once closed: nothing left to do, so no stale to-do reads as open work on a phone.
function closedBody(runUrl, now) {
  return [MARKER, 'All clear: the [run](' + runUrl + ') found nothing to report, so this issue is closed.', '', `Closed: ${now}.`].join('\n');
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
  kindOf, errorLine, code, groupSentence, sortSentence, registryError, extraViewsError, boardOutcome, MARKER, reportLines, reportAction, reportBody, closedBody, hashLines,
};
