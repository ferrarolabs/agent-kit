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

module.exports = { BUILT_IN, USER_TYPES, isCustomField, diff, pruneTargets, argError, viewNeedsUpdate };
