#!/usr/bin/env node
// Build (or check) a GitHub Project from project-template.json (docs/project-boards.md, ADR 0024).
//
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly --from-template "Agent work" [--extra extra-views.json]
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly --check
//   node build-project.js --owner ferrarolabs --template --title "Agent work" [--prune]
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly --number 5 --sync --json out.json
//
// --from-template copies the org template into a new repo project, so the views
// keep what only the UI can set (group, sort, column field) and the workflows
// (all but auto-add). Then it finishes the copy for the repo. Without it, a repo
// project is built empty from the spec, and those settings are left to do by hand.
// --template builds the org's project template: no repo, no items, marked as a
// template so it shows under the org's Templates and in "New project".
// --prune (template only) deletes views and project-owned fields the spec doesn't
// name. It is a one-off for the template; repo projects are never pruned, because
// syncing them is additive (issue 66).
//
// Build is idempotent: it creates what is missing and updates what differs.
// Check changes nothing: it diffs the live project against the spec, including
// the group, sort and column field set by hand (the API can read them, not set
// them), and runs each view's filter, so drift and broken filters show up as FAIL lines.
// --sync is what the nightly sync runs (issue 175): find the project by --number,
// never create it, add and fix views and fields, never delete, never add items,
// never touch Status's options (issue 176). --json writes the results for the driver.
// Neither ever writes a field value on an item: Status belongs to the
// reconciler (issue 78), and only the owner sets Ready.
// Needs `gh` with a token that has Projects read and write on the org.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { diff, pruneTargets, argError, viewNeedsUpdate, kindOf } = require('./lib');
const { syncStatus } = require('./status-step');
const { statusTarget } = require('./status-plan');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const asTemplate = args.template === true;
for (const k of asTemplate ? ['owner', 'title'] : ['owner', 'repo', 'title']) if (!args[k]) throw new Error(`missing --${k}`);
const sync = args.sync === true;
const checkOnly = args.check === true;
const number = args.number === undefined ? null : Number(args.number);
const jsonOut = typeof args.json === 'string' ? args.json : null;
const prune = args.prune === true;
const fromTemplate = typeof args['from-template'] === 'string' ? args['from-template'] : null;

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'project-template.json'), 'utf8'));
const extra = args.extra ? JSON.parse(fs.readFileSync(args.extra, 'utf8')) : { views: [] };
const bad = argError(args, spec, extra.views);
if (bad) throw new Error(bad);
const views = [...spec.views, ...extra.views];

function gql(query, variables = {}) {
  const out = execFileSync('gh', ['api', 'graphql', '--input', '-'], {
    input: JSON.stringify({ query, variables }),
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  const j = JSON.parse(out);
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}
function rest(p) {
  return JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', p], { encoding: 'utf8', maxBuffer: 1 << 26 })).flat();
}
const log = (...a) => console.log(...a);
let failures = 0;
// Every line the driver needs, with a kind: changed, ok, drift, manual, spec (see lib.diff).
const results = [];
// What only Elia can do, found by this run (issue 176): reported in the sync issue.
const actions = [];
const changed = (msg) => { results.push({ kind: 'changed', msg }); log(msg); };
const result = (ok, msg, kindHint, todo) => {
  const kind = kindOf(ok, kindHint);
  results.push(todo ? { kind, msg, todo } : { kind, msg });
  // In sync, what only the UI can set, or what the spec doesn't know yet, doesn't fail the run: it is reported.
  if (!ok && !(sync && (kind === 'manual' || kind === 'spec'))) failures++;
  log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const writeJson = (extra) => {
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ title: args.title, number, results, actions, ...extra }, null, 2));
};

// ---- owner, repo, project
const PROJECT_FIELDS = 'id title number url template public shortDescription';
const org = gql(`query($o:String!){ organization(login:$o){ id } }`, { o: args.owner }).organization;
// Status's options are Stage's (issue 176): names, colours and order come from the org's field.
const stageField = rest(`orgs/${args.owner}/issue-fields`).find((f) => f.name === spec.stage.field);
if (!stageField) throw new Error(`the org has no issue field "${spec.stage.field}"`);
spec.status = statusTarget(stageField.options || []);
// Exact title match: the API's search is fuzzy.
const findProject = (title) =>
  gql(`query($o:String!,$t:String!){ organization(login:$o){ projectsV2(first:20, query:$t){ nodes{ ${PROJECT_FIELDS} } } } }`, {
    o: args.owner, t: title,
  }).organization.projectsV2.nodes.filter((p) => p.title === title);

let project;
if (number !== null) {
  // By number: a registered project is never searched by title, and never created again.
  let found = null;
  try {
    found = gql(`query($o:String!,$n:Int!){ organization(login:$o){ projectV2(number:$n){ ${PROJECT_FIELDS} } } }`, { o: args.owner, n: number })
      .organization.projectV2;
  } catch (e) {
    if (!/NOT_FOUND|Could not resolve/i.test(`${e.message}\n${e.stdout || ''}`)) throw e;
  }
  if (!found) {
    log(`project number ${number} ("${args.title}") not found: not created again`);
    writeJson({ missing: true });
    process.exit(3);
  }
  if (found.title !== args.title) throw new Error(`project ${number} is titled "${found.title}", the registry says "${args.title}"`);
  if (asTemplate !== found.template) throw new Error(`project ${number} is ${found.template ? '' : 'not '}a template, the registry says otherwise`);
  project = found;
} else {
  const matches = findProject(args.title);
  if (matches.length > 1) throw new Error(`${matches.length} projects are titled "${args.title}": rename all but one`);
  project = matches[0];
}
if (project && !asTemplate && project.template) throw new Error(`"${args.title}" is a template, not a repo project: refusing to touch it`);

if (!project) {
  if (checkOnly) throw new Error(`project "${args.title}" not found`);
  if (fromTemplate) {
    const source = findProject(fromTemplate).filter((p) => p.template);
    if (source.length !== 1) throw new Error(`no single org template titled "${fromTemplate}"`);
    project = gql(
      `mutation($p:ID!,$o:ID!,$t:String!){ copyProjectV2(input:{projectId:$p,ownerId:$o,title:$t,includeDraftIssues:false}){ projectV2{ ${PROJECT_FIELDS} } } }`,
      { p: source[0].id, o: org.id, t: args.title },
    ).copyProjectV2.projectV2;
    log(`copied "${fromTemplate}" into ${project.url}`);
    if (project.template) {
      gql(`mutation($p:ID!){ unmarkProjectV2AsTemplate(input:{projectId:$p}){ clientMutationId } }`, { p: project.id });
      log('unmarked the copy as a template');
    }
  } else {
    project = gql(
      `mutation($o:ID!,$t:String!){ createProjectV2(input:{ownerId:$o,title:$t}){ projectV2{ ${PROJECT_FIELDS} } } }`,
      { o: org.id, t: args.title },
    ).createProjectV2.projectV2;
    log(`created project ${project.url}`);
  }
} else log(`project ${project.url}`);
const P = project.id;
let manualLink = false;

const FIELDS_Q = `query($p:ID!){ node(id:$p){ ... on ProjectV2{ fields(first:50){ totalCount nodes{
  ... on ProjectV2FieldCommon{ id name dataType }
  ... on ProjectV2SingleSelectField{ options{ id name color } } } } } } }`;
const VIEWS_Q = `query($p:ID!){ node(id:$p){ ... on ProjectV2{ views(first:50){ totalCount nodes{ id name number layout filter
  fields(first:30){ nodes{ ... on ProjectV2FieldCommon{ name } } }
  groupByFields(first:5){ nodes{ ... on ProjectV2FieldCommon{ name } } }
  verticalGroupByFields(first:1){ nodes{ ... on ProjectV2FieldCommon{ name } } }
  sortByFields(first:5){ nodes{ direction field{ ... on ProjectV2FieldCommon{ name } } } } } } } } }`;
// A truncated read would make build create a view or field that exists: stop instead.
const all = (conn, what) => {
  if (conn.totalCount > conn.nodes.length) throw new Error(`${what}: ${conn.totalCount} on the project, only ${conn.nodes.length} read`);
  return conn.nodes;
};
const readFields = () => all(gql(FIELDS_Q, { p: P }).node.fields, 'fields');
// A node of a type the fragment doesn't cover comes back without a name: show it, don't crash.
const nameOf = (f) => (f && f.name) || '(unreadable)';
const readViews = () =>
  all(gql(VIEWS_Q, { p: P }).node.views, 'views').map((v) => ({
    id: v.id, name: v.name, number: v.number, layout: v.layout, filter: v.filter,
    fields: v.fields.nodes.map(nameOf),
    groupBy: v.groupByFields.nodes.map(nameOf),
    columnBy: v.verticalGroupByFields.nodes.length ? nameOf(v.verticalGroupByFields.nodes[0]) : null,
    sortBy: v.sortByFields.nodes.map((s) => ({ field: nameOf(s.field), direction: s.direction })),
  }));

if (!checkOnly) {
  // Private first: a copy takes the template's visibility, and nothing else should run while it is public.
  if (!sync || project.public !== spec.public) {
    gql(`mutation($p:ID!,$pub:Boolean!){ updateProjectV2(input:{projectId:$p,public:$pub}){ clientMutationId } }`, { p: P, pub: spec.public });
    if (project.public !== spec.public) changed(`set the project ${spec.public ? 'public' : 'private'}`);
  }

  // Linking is set-up, done once by build. The sync leaves it alone.
  if (!asTemplate && !sync) {
    const repoId = gql(`query($o:String!,$r:String!){ organization(login:$o){ repository(name:$r){ id } } }`, { o: args.owner, r: args.repo })
      .organization.repository.id;
    // Linking only lists the project in the repo's Projects tab; views and items don't need it.
    // A token without permission on the repo can't link (run 43023650028): say so, and go on.
    try {
      gql(`mutation($p:ID!,$r:ID!){ linkProjectV2ToRepository(input:{projectId:$p,repositoryId:$r}){ clientMutationId } }`, { p: P, r: repoId });
    } catch (e) {
      // gh prints the GraphQL error on stdout and exits 1, so the reason is in e.stdout, not e.message.
      if (!/FORBIDDEN|not accessible/i.test(`${e.message}\n${e.stdout || ''}\n${e.stderr || ''}`)) throw e;
      manualLink = true;
      log(`warn could not link the project to ${args.repo}: the token has no permission on the repo. Link it by hand (listed below)`);
    }
  }
  const description = asTemplate
    ? 'Template for every repo: columns on the Stage issue field (ADR 0024). Built from agent-kit/scripts/projects.'
    : `Agent work on ${args.owner}/${args.repo}. Columns on the Stage issue field (ADR 0024).`;
  if (project.shortDescription !== description) {
    gql(`mutation($p:ID!,$d:String!){ updateProjectV2(input:{projectId:$p,shortDescription:$d}){ clientMutationId } }`, { p: P, d: description });
    if (sync) changed('set the description');
  }

  // ---- Status options: build only. The sync never replaces them: that wipes every card (issue 176).
  let fields = readFields();
  const status = fields.find((f) => f.name === 'Status');
  const same = sync || JSON.stringify(status.options.map((o) => [o.name, o.color])) === JSON.stringify(spec.status.map((s) => [s.name, s.color]));
  if (!same) {
    gql(`mutation($f:ID!,$o:[ProjectV2SingleSelectFieldOptionInput!]){ updateProjectV2Field(input:{fieldId:$f,singleSelectOptions:$o}){ clientMutationId } }`, {
      f: status.id,
      o: spec.status.map((s) => ({ name: s.name, color: s.color, description: '' })),
    });
    log('set Status options');
  }

  // ---- issue fields
  if (spec.issueFields.some((name) => !fields.some((f) => f.name === name))) {
    const orgIssueFields = gql(
      `query($o:String!){ organization(login:$o){ issueFields(first:50){ nodes{
         ... on IssueFieldSingleSelect{ id name } ... on IssueFieldDate{ id name }
         ... on IssueFieldText{ id name } ... on IssueFieldNumber{ id name } } } } }`,
      { o: args.owner },
    ).organization.issueFields.nodes;
    for (const name of spec.issueFields) {
      if (fields.some((f) => f.name === name)) continue;
      const f = orgIssueFields.find((x) => x.name === name);
      if (!f) throw new Error(`org has no issue field "${name}"`);
      gql(`mutation($p:ID!,$f:ID!){ createProjectV2IssueField(input:{projectId:$p,issueFieldId:$f}){ clientMutationId } }`, { p: P, f: f.id });
      changed(`added issue field "${name}"`);
    }
    fields = readFields();
  }

  // ---- views: create what is missing, update only what differs (so a copy's hand-set group and sort are left alone)
  let liveViews = readViews();
  for (const [i, v] of views.entries()) {
    let live = liveViews.find((x) => x.name === v.name);
    if (!viewNeedsUpdate(v, live)) continue;
    const ids = [];
    for (const n of v.fields) {
      const f = fields.find((x) => x.name === n);
      if (f) ids.push(f.id);
      else result(false, `view "${v.name}": no field "${n}" in the project. It has: ${fields.map((x) => x.name).join(', ')}`);
    }
    if (!live && i === 0) live = liveViews.find((x) => /^View \d+$/.test(x.name)); // reuse the default view
    if (!live) {
      live = gql(`mutation($p:ID!,$n:String!,$l:ProjectV2ViewLayout!){ createProjectV2View(input:{projectId:$p,name:$n,layout:$l}){ projectV2View{ id name } } }`, {
        p: P, n: v.name, l: v.layout,
      }).createProjectV2View.projectV2View;
      changed(`created view "${v.name}"`);
    } else changed(`updated view "${v.name}"`);
    gql(`mutation($v:ID!,$n:String!,$l:ProjectV2ViewLayout!,$f:String!,$ids:[ID!]){ updateProjectV2View(input:{viewId:$v,name:$n,layout:$l,filter:$f,configuration:{visibleFieldIds:$ids}}){ clientMutationId } }`, {
      v: live.id, n: v.name, l: v.layout, f: v.filter, ids,
    });
  }

  // ---- Status follows Stage, card by card (issue 176). Sync only; build sets the options above.
  if (sync) {
    const snap = jsonOut ? jsonOut.replace(/\.json$/, '') + '-snapshot.json' : null;
    const r = syncStatus({
      gql, rest: (p) => JSON.parse(execFileSync('gh', ['api', p], { encoding: 'utf8', maxBuffer: 1 << 26 })),
      projectId: P, stageField, write: true, log: changed,
      saveSnapshot: (items) => { if (snap) fs.writeFileSync(snap, JSON.stringify(items)); },
    });
    if (r.replaced) actions.push(`re-save the "Item closed" workflow on ${project.url}/workflows: Status's options changed`);
    for (const u of r.unplaced) actions.push(`card for issue ${u.number} has no Stage, so no Status on ${project.url}`);
    for (const m of r.mismatches) result(false, `card ${m.id}: Status "${m.got}", expected "${m.want}"`);
  }

  // ---- prune (template only): after the spec's views exist, so the project never has none
  if (prune) {
    const t = pruneTargets(spec, views, { views: readViews(), fields: readFields() });
    for (const v of t.views) {
      gql(`mutation($v:ID!){ deleteProjectV2View(input:{viewId:$v}){ clientMutationId } }`, { v: v.id });
      log(`deleted view "${v.name}"`);
    }
    for (const f of t.fields) {
      gql(`mutation($f:ID!){ deleteProjectV2Field(input:{fieldId:$f}){ clientMutationId } }`, { f: f.id });
      log(`deleted field "${f.name}"`);
    }
  }

  // ---- items (repo projects): open issues, plus those closed in the last 30 days, every page. No field values are written.
  if (!asTemplate && !sync) {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const issues = rest(`repos/${args.owner}/${args.repo}/issues?state=all&since=${since}&per_page=100`).filter(
      (i) => !i.pull_request && (i.state === 'open' || new Date(i.closed_at) > new Date(since)),
    );
    for (const i of issues)
      gql(`mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`, { p: P, c: i.node_id });
    log(`added ${issues.length} issues (Status is left to the reconciler)`);
  }

  if (asTemplate && !project.template) {
    gql(`mutation($p:ID!){ markProjectV2AsTemplate(input:{projectId:$p}){ clientMutationId } }`, { p: P });
    log('marked as an org template');
  }
}

// ---- compare with the spec (after a build, this is its own check)
const fresh = gql(`query($p:ID!){ node(id:$p){ ... on ProjectV2{ template public
  workflows(first:50){ totalCount nodes{ name number enabled } } } } }`, { p: P }).node;
const live = {
  template: fresh.template,
  public: fresh.public,
  status: readFields().find((f) => f.name === 'Status').options,
  fields: readFields(),
  views: readViews(),
  workflows: fresh.workflows,
};
for (const r of diff(spec, views, live, { asTemplate })) result(r.ok, r.msg, r.kind, r.todo);

// ---- run every view's filter against the live items (the API evaluates it). Issue numbers only, never field values.
for (const v of views) {
  const items = gql(
    `query($p:ID!,$q:String!){ node(id:$p){ ... on ProjectV2{ items(first:100, query:$q){ totalCount
       nodes{ content{ ... on Issue{ number } } } } } } }`,
    { p: P, q: v.filter },
  ).node.items;
  const nums = items.nodes.map((n) => n.content && n.content.number).filter(Boolean).sort((a, b) => a - b);
  const more = items.totalCount > nums.length ? ` (first ${nums.length} of ${items.totalCount} shown)` : '';
  log(`     view "${v.name}": ${items.totalCount} item(s) for "${v.filter}"${nums.length ? ': #' + nums.join(' #') : ''}${more}`);
}

log('\nMANUAL, NOT SET BY THE SCRIPT:');
if (manualLink) log(`  - Link: in ${args.owner}/${args.repo} → Projects → Link a project → "${args.title}" (the token can't)`);
for (const v of views) if (v.manual) log(`  - ${v.name}: ${v.manual}`);
log(`  - Workflows, on ${project.url}/workflows. ${spec.workflowNote}`);
for (const w of spec.workflowStates) {
  const on = asTemplate ? w.template : w.repo;
  log(`    - ${w.name}: ${on ? 'ON' : 'OFF'}${w.note ? `. ${w.note}` : ''}`);
}
if (spec.access) log(`  - Access: ${spec.access}`);
log(`  Open: ${project.url}`);
log(failures ? `\n${failures} difference(s) from the spec` : '\nproject matches the spec');
writeJson({ missing: false, url: project.url });
process.exit(failures ? 1 : 0);
