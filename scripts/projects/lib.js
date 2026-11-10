// Pure helpers for build-project.js: no network, so node:test can drive them.
'use strict';

// Fields every project has, whatever the spec says. Never reported as extra, never pruned.
const BUILT_IN = new Set([
  'Title', 'Assignees', 'Status', 'Labels', 'Linked pull requests', 'Milestone', 'Repository',
  'Reviewers', 'Parent issue', 'Sub-issues progress', 'Type', 'Tracks', 'Tracked by',
]);

// A field the project owns: created in the project, not built in, not an org issue field.
function isCustomField(f, spec) {
  return !BUILT_IN.has(f.name) && !spec.issueFields.includes(f.name);
}

// Compares the spec with a live project. `live` is plain data:
//   { public, template, status: [{name, color}], fields: [{name}], views: [{name, layout, filter, fields: [names]}] }
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

module.exports = { BUILT_IN, isCustomField, diff, pruneTargets };
