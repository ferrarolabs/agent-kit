'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { diff, pruneTargets, argError, viewNeedsUpdate } = require('./lib');
const spec = require('./project-template.json');

// A live project that matches the spec exactly. Each test breaks one thing.
function matching() {
  return {
    template: true,
    public: spec.public,
    status: spec.status.map((s) => ({ ...s })),
    fields: [{ name: 'Title' }, { name: 'Status' }, { name: 'Type' }, { name: 'Linked pull requests' }, { name: 'Sub-issues progress' },
      ...spec.issueFields.map((name) => ({ name }))],
    views: spec.views.map((v) => ({
      name: v.name, layout: v.layout, filter: v.filter, fields: [...v.fields],
      groupBy: [...(v.groupBy || [])], sortBy: (v.sortBy || []).map((x) => ({ ...x })), columnBy: v.columnBy || null,
    })),
  };
}
const fails = (live) => diff(spec, spec.views, live, { asTemplate: true }).filter((r) => !r.ok).map((r) => r.msg);

test('a project that matches the spec has no FAIL', () => {
  assert.deepStrictEqual(fails(matching()), []);
});

test('an extra view is reported, and pruned', () => {
  const live = matching();
  live.views.push({ name: 'Milestone', layout: 'TABLE_LAYOUT', filter: '-status:Done', fields: [] });
  assert.match(fails(live).join('\n'), /view "Milestone" is not in the spec/);
  assert.deepStrictEqual(pruneTargets(spec, spec.views, live).views.map((v) => v.name), ['Milestone']);
});

test('an extra project field is reported and pruned; built-ins and issue fields never are', () => {
  const live = matching();
  live.fields.push({ name: 'Cost $', dataType: 'NUMBER' });
  assert.match(fails(live).join('\n'), /field "Cost \$" is not in the spec/);
  assert.deepStrictEqual(pruneTargets(spec, spec.views, live).fields.map((f) => f.name), ['Cost $']);
});

test('a public project fails', () => {
  const live = matching();
  live.public = true;
  assert.match(fails(live).join('\n'), /project is public, spec says private/);
});

test('Status out of order fails', () => {
  const live = matching();
  [live.status[1], live.status[2]] = [live.status[2], live.status[1]];
  assert.match(fails(live).join('\n'), /Status options are/);
});

test('a Status colour that differs fails', () => {
  const live = matching();
  live.status[0].color = 'PINK';
  assert.match(fails(live).join('\n'), /Status colours differ: Inbox/);
});

test('a wrong filter, a missing view and a missing view field fail', () => {
  const live = matching();
  live.views[0].filter = 'is:open';
  live.views = live.views.filter((v) => v.name !== 'Epics');
  live.views[1].fields = live.views[1].fields.slice(1);
  const msg = fails(live).join('\n');
  assert.match(msg, /view "Needs me" filter "is:open", spec says/);
  assert.match(msg, /view "Epics" missing/);
  assert.match(msg, /view "Flow" fields missing: Title/);
});

test('a missing issue field fails', () => {
  const live = matching();
  live.fields = live.fields.filter((f) => f.name !== 'Stage');
  assert.match(fails(live).join('\n'), /issue field "Stage" missing/);
});

test('a project not marked as a template fails, in template mode only', () => {
  const live = matching();
  live.template = false;
  assert.match(fails(live).join('\n'), /marked as an org template/);
  assert.deepStrictEqual(diff(spec, spec.views, live).filter((r) => !r.ok), []);
});

test('a field of a built-in type is never reported or pruned, even with an unknown name', () => {
  const live = matching();
  live.fields.push({ name: 'Some future built-in', dataType: 'TRACKED_BY' });
  assert.deepStrictEqual(fails(live), []);
  assert.deepStrictEqual(pruneTargets(spec, spec.views, live).fields, []);
});

test('a group, sort or column field set differently by hand fails', () => {
  const live = matching();
  const byName = (n) => live.views.find((v) => v.name === n);
  byName('Needs me').groupBy = [];
  byName('Flow').columnBy = 'Status';
  byName('Stalled').sortBy = [{ field: 'Updated', direction: 'DESC' }];
  const msg = fails(live).join('\n');
  assert.match(msg, /view "Needs me" group by \[\], spec says \["Stage"\]/);
  assert.match(msg, /view "Flow" column field "Status", spec says "Stage"/);
  assert.match(msg, /view "Stalled" sort .*spec says/);
});

test('an extra view with no declared group or sort is not checked for them', () => {
  const extraView = { name: 'Audit inbox', layout: 'TABLE_LAYOUT', filter: 'is:issue is:open', fields: ['Title'] };
  const live = matching();
  live.views.push({ ...extraView, groupBy: ['Stage'], sortBy: [], columnBy: null });
  assert.deepStrictEqual(diff(spec, [...spec.views, extraView], live).filter((r) => !r.ok), []);
});

test('argument guards refuse what would touch the wrong project', () => {
  const base = { owner: 'o', repo: 'r', title: 'R' };
  assert.strictEqual(argError({ ...base, 'from-template': 'Agent work' }, spec, []), null);
  assert.match(argError({ ...base, title: 'Agent work', 'from-template': 'Agent work' }, spec, []), /can't be the template's own title/);
  assert.match(argError({ ...base, 'from-template': true }, spec, []), /needs the template's title/);
  assert.match(argError({ owner: 'o', title: 'R', 'from-template': 'Agent work' }, spec, []), /needs --repo/);
  assert.match(argError({ ...base, template: true, 'from-template': 'Agent work' }, spec, []), /not with --template/);
  assert.match(argError({ ...base, 'from-template': 'Agent work', check: true }, spec, []), /can't run with --check/);
  assert.match(argError({ ...base, prune: true }, spec, []), /template only/);
  assert.match(argError({ ...base, template: true, prune: true, check: true }, spec, []), /can't run with --check/);
  assert.match(argError(base, spec, [{ name: 'Flow' }]), /can't reuse a spec view's name: Flow/);
});

test('a view is updated only when what the API sets differs', () => {
  const v = spec.views[0];
  const live = { layout: v.layout, filter: v.filter, fields: [...v.fields] };
  assert.strictEqual(viewNeedsUpdate(v, live), false);
  assert.strictEqual(viewNeedsUpdate(v, { ...live, filter: 'is:open' }), true);
  assert.strictEqual(viewNeedsUpdate(v, { ...live, fields: [] }), true);
  assert.strictEqual(viewNeedsUpdate(v, undefined), true);
});
