#!/usr/bin/env node
// Build (or check) a repo's GitHub Project from project-template.json (docs/project-boards.md, ADR 0024).
//
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly [--extra extra-views.json]
//   node build-project.js --owner ferrarolabs --repo jamly --title Jamly --check
//   node build-project.js --owner ferrarolabs --template --title "Agent work" [--prune]
//
// --template builds the org's project template: no repo, no items, marked as a
// template so it shows under the org's Templates and in "New project".
// --prune (template only) deletes views and project-owned fields the spec doesn't
// name. It is a one-off for the template; repo projects are never pruned, because
// syncing them is additive (issue 66).
//
// Build is idempotent: it creates what is missing and updates what differs.
// Check changes nothing: it diffs the live project against the spec and runs
// each view's filter, so drift and broken filters show up as FAIL lines.
// Neither ever writes a field value on an item: Status belongs to the
// reconciler (issue 78), and only the owner sets Ready.
// The GitHub API can't set group-by, sort, column field, column limits or
// workflows; those are printed as a manual checklist. Needs `gh` with a token
// that has Projects read and write on the org.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { diff, pruneTargets } = require('./lib');

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
if (prune && !asTemplate) throw new Error('--prune is for the template only: repo projects are never pruned');
if (prune && checkOnly) throw new Error('--prune changes the project; it can\'t run with --check');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'project-template.json'), 'utf8'));
const extra = args.extra ? JSON.parse(fs.readFileSync(args.extra, 'utf8')) : { views: [] };
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
const { organization } = gql(
  `query($o:String!,$r:String!,$t:String!,$withRepo:Boolean!){ organization(login:$o){ id
     projectsV2(first:20, query:$t){ nodes{ ${PROJECT_FIELDS} } }
     repository(name:$r) @include(if:$withRepo){ id } } }`,
  { o: args.owner, r: args.repo || '', t: args.title, withRepo: !asTemplate },
);
let project = organization.projectsV2.nodes.find((p) => p.title === args.title);
if (!project) {
  if (checkOnly) throw new Error(`project "${args.title}" not found`);
  project = gql(
    `mutation($o:ID!,$t:String!){ createProjectV2(input:{ownerId:$o,title:$t}){ projectV2{ ${PROJECT_FIELDS} } } }`,
    { o: organization.id, t: args.title },
  ).createProjectV2.projectV2;
  log(`created project ${project.url}`);
} else log(`project ${project.url}`);
const P = project.id;

const FIELDS_Q = `query($p:ID!){ node(id:$p){ ... on ProjectV2{ fields(first:50){ nodes{
  ... on ProjectV2FieldCommon{ id name dataType }
  ... on ProjectV2SingleSelectField{ options{ id name color } } } } } } }`;
const VIEWS_Q = `query($p:ID!){ node(id:$p){ ... on ProjectV2{ views(first:30){ nodes{ id name number layout filter
  fields(first:30){ nodes{ ... on ProjectV2FieldCommon{ name } } } } } } } }`;
const readFields = () => gql(FIELDS_Q, { p: P }).node.fields.nodes;
const readViews = () => gql(VIEWS_Q, { p: P }).node.views.nodes;

if (!checkOnly) {
  if (!asTemplate)
    gql(`mutation($p:ID!,$r:ID!){ linkProjectV2ToRepository(input:{projectId:$p,repositoryId:$r}){ clientMutationId } }`, {
      p: P,
      r: organization.repository.id,
    });
  gql(`mutation($p:ID!,$d:String!,$pub:Boolean!){ updateProjectV2(input:{projectId:$p,shortDescription:$d,public:$pub}){ clientMutationId } }`, {
    p: P,
    pub: spec.public,
    d: asTemplate
      ? 'Template for every repo: columns on the Stage issue field (ADR 0024). Built from agent-kit/scripts/projects.'
      : `Agent work on ${args.owner}/${args.repo}. Columns on the Stage issue field (ADR 0024).`,
  });
  if (project.public !== spec.public) log(`set the project ${spec.public ? 'public' : 'private'}`);

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

  // ---- views
  let liveViews = readViews();
  for (const [i, v] of views.entries()) {
    const ids = [];
    for (const n of v.fields) {
      const f = fields.find((x) => x.name === n);
      if (f) ids.push(f.id);
      else result(false, `view "${v.name}": no field "${n}" in the project. It has: ${fields.map((x) => x.name).join(', ')}`);
    }
    let live = liveViews.find((x) => x.name === v.name);
    if (!live && i === 0) live = liveViews.find((x) => /^View \d+$/.test(x.name)); // reuse the default view
    if (!live) {
      live = gql(`mutation($p:ID!,$n:String!,$l:ProjectV2ViewLayout!){ createProjectV2View(input:{projectId:$p,name:$n,layout:$l}){ projectV2View{ id name } } }`, {
        p: P, n: v.name, l: v.layout,
      }).createProjectV2View.projectV2View;
      log(`created view "${v.name}"`);
    }
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

  // ---- items (repo projects): open issues, plus those closed in the last 30 days. No field values are written.
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
  views: readViews().map((v) => ({ ...v, fields: v.fields.nodes.map((f) => f.name) })),
};
for (const r of diff(spec, views, live, { asTemplate })) result(r.ok, r.msg);

// ---- run every view's filter against the live items (the API evaluates it)
for (const v of views) {
  const items = gql(
    `query($p:ID!,$q:String!){ node(id:$p){ ... on ProjectV2{ items(first:100, query:$q){ totalCount
       nodes{ content{ ... on Issue{ number } } } } } } }`,
    { p: P, q: v.filter },
  ).node.items;
  const nums = items.nodes.map((n) => n.content && n.content.number).filter(Boolean).sort((a, b) => a - b);
  log(`     view "${v.name}": ${items.totalCount} item(s) for "${v.filter}"${nums.length ? ': #' + nums.join(' #') : ''}`);
}

log('\nMANUAL, NOT CHECKED (the API cannot read or set these):');
for (const v of views) if (v.manual) log(`  - ${v.name}: ${v.manual}`);
for (const w of spec.workflows) log(`  - Workflow: ${w}`);
if (spec.access) log(`  - Access: ${spec.access}`);
log(`  Open: ${project.url}`);
log(failures ? `\n${failures} difference(s) from the spec` : '\nproject matches the spec');
process.exit(failures ? 1 : 0);
