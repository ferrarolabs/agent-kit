#!/usr/bin/env node
// The nightly sync (issue 175): run build-project.js --sync on every board in projects.json,
// one after another, and write results.json for report-sync.js.
//
//   node sync-projects.js --out results.json
//
// One board's error never stops the others. Exit 0 unless the registry itself is bad:
// report-sync.js decides what reaches Elia, and the workflow goes red only on an error.
// Needs `gh` with PROJECT_TOKEN.
'use strict';
const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registryError, extraViewsError, boardOutcome } = require('./lib');
const { syncStageField } = require('./status-step');

const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : 'results.json';
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, 'projects.json'), 'utf8'));
const bad = registryError(reg);
if (bad) {
  console.error(`projects.json: ${bad}`);
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'));

// The repo's extra views, from its default branch only. null if it has none.
function extraViews(repo) {
  let raw;
  try {
    raw = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', `repos/${reg.owner}/${repo}/contents/.github/project-extra-views.json`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    if (/404|Not Found/.test(`${e.stderr || ''}${e.stdout || ''}`)) return null;
    throw e;
  }
  const extra = JSON.parse(raw);
  const err = extraViewsError(extra);
  if (err) throw new Error(`${repo}/.github/project-extra-views.json: ${err}`);
  return extra;
}

const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 1 << 26 });
const gql = (query, variables) => {
  const j = JSON.parse(gh(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables })));
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
};
const rest = (p, opts = {}) => {
  const out = opts.method
    ? gh(['api', '-X', opts.method, p, '--input', '-'], JSON.stringify(opts.body))
    : gh(['api', '--paginate', '--slurp', p]);
  const j = out.trim() ? JSON.parse(out) : null;
  return opts.method ? j : j.flat();
};

// ---- 1. the org's Stage field follows the spec, before any board (issue 176)
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'project-template.json'), 'utf8'));
const stageOutcome = { title: `org field ${spec.stage.field}`, number: 0, state: 'ok', changed: [], drift: [], manual: [], actions: [] };
try {
  // A value is in use when a card on any registered board holds it: checked only for values the spec drops.
  const inUse = (name) => reg.projects.some((p) => gql(
    `query($o:String!,$n:Int!,$q:String!){ organization(login:$o){ projectV2(number:$n){ items(first:1, query:$q){ totalCount } } } }`,
    { o: reg.owner, n: p.number, q: `${spec.stage.field.toLowerCase().replace(/ /g, '-')}:"${name}"` },
  ).organization.projectV2.items.totalCount > 0);
  const r = syncStageField({ rest, owner: reg.owner, stage: spec.stage, inUse, write: true, log: (m) => { console.log(m); stageOutcome.changed.push(m); } });
  for (const n of r.refused) stageOutcome.actions.push(`"${n}" is no longer in the spec, but cards still hold it: move them, and the next run removes it`);
} catch (e) {
  console.error(e.message);
  Object.assign(stageOutcome, { state: 'error', error: e.message });
}

const outcomes = [stageOutcome];
// A broken Stage field would make every board's Status wrong: stop here.
for (const entry of stageOutcome.state === 'error' ? [] : reg.projects) {
  console.log(`\n=== ${entry.title} (project ${entry.number})`);
  const json = path.join(tmp, `${entry.number}.json`);
  const argv = ['--owner', reg.owner, '--title', entry.title, '--number', String(entry.number), '--sync', '--json', json];
  let stderr = '';
  let code;
  try {
    if (entry.repo) {
      argv.push('--repo', entry.repo);
      const extra = extraViews(entry.repo);
      if (extra && extra.views.length) {
        const f = path.join(tmp, `${entry.number}-extra.json`);
        fs.writeFileSync(f, JSON.stringify(extra));
        argv.push('--extra', f);
        console.log(`extra views from ${entry.repo}: ${extra.views.map((v) => v.name).join(', ')}`);
      }
    } else argv.push('--template');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'build-project.js'), ...argv], { encoding: 'utf8', maxBuffer: 1 << 26 });
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    stderr = r.stderr || '';
    code = r.status;
  } catch (e) {
    stderr = e.message;
    code = -1;
  }
  const data = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : null;
  const o = boardOutcome(entry, data, code, stderr);
  outcomes.push(o);
  console.log(`=> ${o.state}${o.changed && o.changed.length ? `, changed: ${o.changed.join('; ')}` : ''}`);
}

fs.writeFileSync(out, JSON.stringify({ outcomes }, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ['### Project sync', '', '| Board | State | Changed | Set by hand, differs |', '|---|---|---|---|'];
  for (const o of outcomes) {
    md.push(`| ${o.title} | ${o.state} | ${(o.changed || []).join('<br>') || '—'} | ${(o.manual || []).join('<br>') || '—'} |`);
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
}
