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

const outcomes = [];
for (const entry of reg.projects) {
  console.log(`\n=== ${entry.title} (project ${entry.number})`);
  const json = path.join(tmp, `${entry.number}.json`);
  const argv = ['--owner', reg.owner, '--title', entry.title, '--number', String(entry.number), '--sync', '--json', json];
  let stderr = '';
  let code;
  try {
    if (entry.repo) {
      argv.push('--repo', entry.repo);
      const extra = extraViews(entry.repo);
      if (extra) {
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
