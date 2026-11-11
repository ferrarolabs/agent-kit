#!/usr/bin/env node
// Build (or check) a GitHub Project from project-template.json (docs/project-boards.md, ADR 0024).
//
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly --from-template "Agent work" [--extra extra-views.json]
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly --check
//   node build-project.js --owner ferrarolabs --template --title "Agent work" [--prune]
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
// Neither ever writes a field value on an item: Status belongs to the
// reconciler (issue 78), and only the owner sets Ready.
// Needs `gh` with a token that has Projects read and write on the org.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { diff, pruneTargets, argError, viewNeedsUpdate } = require('./lib');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const asTemplate = args.template === true;
for (const k of asTemplate ? ['owner', 'title'] : ['owner', 'repo', 'title']) if (!args[k]) throw new Error(`missing --${k}`);
const checkOnly = args.check === true;
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
const result = (ok, msg) => {
  if (!ok) failures++;
  log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};

// ---- owner, repo, project
const PROJECT_FIELDS = 'id title number url template public';
const org = gql(`query($o:String!){ organization(login:$o){ id } }`, { o: args.owner }).organization;
// Exact title match: the API's search is fuzzy.
const findProject = (title) =>
  gql(`query($o:String!,$t:String!){ organization(login:$o){ projectsV2(first:20, query:$t){ nodes{ ${PROJECT_FIELDS} } } } }`, {
    o: args.owner, t: title,
  }).organization.projectsV2.nodes.filter((p) => p.title === title);

const matches = findProject(args.title);
if (matches.length > 1) throw new Error(`${matches.length} projects are titled "${args.title}": rename all but one`);
let project = matches[0];
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
  } else {
    project = gql(
      `mutation($o:ID!,$t:String!){ createProjectV2(input:{ownerId:$o,title:$t}){ projectV2{ ${PROJECT_FIELDS} } } }`,
      { o: org.id, t: args.title },
    ).createProjectV2.projectV2;
    log(`created project ${project.url}`);
  }
} else log(`project ${project.url}`);
const P = project.id;

const FIELDS_Q = `query($p:ID!){ node(id:$p){ ... on ProjectV2{ fields(first:50){ nodes{
  ... on ProjectV2FieldCommon{ id name dataType }
  ... on ProjectV2SingleSelectField{ options{ id name color } } } } } } }`;
const VIEWS_Q = `query($p:ID!){ node(id:$p){ ... on ProjectV2{ views(first:30){ nodes{ id name number layout filter
  fields(first:30){ nodes{ ... on ProjectV2FieldCommon{ name } } }
  groupByFields(first:5){ nodes{ ... on ProjectV2FieldCommon{ name } } }
  verticalGroupByFields(first:1){ nodes{ ... on ProjectV2FieldCommon{ name } } }
  sortByFields(first:5){ nodes{ direction field{ ... on ProjectV2FieldCommon{ name } } } } } } } } }`;
const readFields = () => gql(FIELDS_Q, { p: P }).node.fields.nodes;
const readViews = () =>
  gql(VIEWS_Q, { p: P }).node.views.nodes.map((v) => ({
    id: v.id, name: v.name, layout: v.layout, filter: v.filter,
    fields: v.fields.nodes.map((f) => f.name),
    groupBy: v.groupByFields.nodes.map((f) => f.name),
    columnBy: v.verticalGroupByFields.nodes.length ? v.verticalGroupByFields.nodes[0].name : null,
    sortBy: v.sortByFields.nodes.map((s) => ({ field: s.field.name, direction: s.direction })),
  }));

if (!checkOnly) {
  // Private first: a copy takes the template's visibility, and nothing else should run while it is public.
  gql(`mutation($p:ID!,$pub:Boolean!){ updateProjectV2(input:{projectId:$p,public:$pub}){ clientMutationId } }`, { p: P, pub: spec.public });
  if (project.public !== spec.public) log(`set the project ${spec.public ? 'public' : 'private'}`);

  if (!asTemplate) {
    const repoId = gql(`query($o:String!,$r:String!){ organization(login:$o){ repository(name:$r){ id } } }`, { o: args.owner, r: args.repo })
      .organization.repository.id;
    gql(`mutation($p:ID!,$r:ID!){ linkProjectV2ToRepository(input:{projectId:$p,repositoryId:$r}){ clientMutationId } }`, { p: P, r: repoId });
  }
  gql(`mutation($p:ID!,$d:String!){ updateProjectV2(input:{projectId:$p,shortDescription:$d}){ clientMutationId } }`, {
    p: P,
    d: asTemplate
      ? 'Template for every repo: columns on the Stage issue field (ADR 0024). Built from agent-kit/scripts/projects.'
      : `Agent work on ${args.owner}/${args.repo}. Columns on the Stage issue field (ADR 0024).`,
  });

  // ---- Status options
  let fields = readFields();
  const status = fields.find((f) => f.name === 'Status');
  const same = JSON.stringify(status.options.map((o) => [o.name, o.color])) === JSON.stringify(spec.status.map((s) => [s.name, s.color]));
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
      log(`added issue field "${name}"`);
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
      log(`created view "${v.name}"`);
    } else log(`updated view "${v.name}"`);
    gql(`mutation($v:ID!,$n:String!,$l:ProjectV2ViewLayout!,$f:String!,$ids:[ID!]){ updateProjectV2View(input:{viewId:$v,name:$n,layout:$l,filter:$f,configuration:{visibleFieldIds:$ids}}){ clientMutationId } }`, {
      v: live.id, n: v.name, l: v.layout, f: v.filter, ids,
    });
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
  if (!asTemplate) {
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
const fresh = gql(`query($p:ID!){ node(id:$p){ ... on ProjectV2{ template public } } }`, { p: P }).node;
const live = {
  template: fresh.template,
  public: fresh.public,
  status: readFields().find((f) => f.name === 'Status').options,
  fields: readFields(),
  views: readViews(),
};
for (const r of diff(spec, views, live, { asTemplate })) result(r.ok, r.msg);

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
if (!asTemplate) log('  - Workflow: Auto-add to project → ON, this repo, filter is:issue is:open (copies never inherit auto-add)');
for (const v of views) if (v.manual) log(`  - ${v.name}: ${v.manual}`);
for (const w of spec.workflows) log(`  - Workflow: ${w}`);
if (spec.access) log(`  - Access: ${spec.access}`);
log(`  Open: ${project.url}`);
log(failures ? `\n${failures} difference(s) from the spec` : '\nproject matches the spec');
process.exit(failures ? 1 : 0);
