#!/usr/bin/env node
// Opens, updates or closes the one "Project sync: action needed" issue (issue 175),
// from results.json written by sync-projects.js.
//
//   node report-sync.js results.json
//
// It notifies only when what needs action changes: same lines, it edits the body (silent).
// It sets Stage Asking and Priority 80 on the issue it creates, and on no other issue.
// Exit 1 if any board ended in error, so the run goes red only then.
// Needs `gh` with a token that has Issues write on the repo.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const { MARKER, reportLines, reportAction, reportBody } = require('./lib');

const REPO = 'ferrarolabs/agent-kit';
const TITLE = 'Project sync: action needed';
const { outcomes } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const runUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID || 'local'}`;

const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 1 << 26 });
const api = (args, body) => {
  const out = gh(['api', ...args, ...(body ? ['--input', '-'] : [])], body ? JSON.stringify(body) : undefined);
  return out.trim() ? JSON.parse(out) : null;
};

// The open report issue: the one whose body starts with the marker. Listed, not searched: search lags.
const open = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${REPO}/issues?state=open&per_page=100`]))
  .flat()
  .find((i) => !i.pull_request && (i.body || '').startsWith(MARKER)) || null;

const lines = reportLines(outcomes, { runUrl });
const action = reportAction(lines, open);
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
console.log(`report: ${action}${open ? ` (issue ${open.number})` : ''}`);

if (action === 'create') {
  const issue = api(['-X', 'POST', `repos/${REPO}/issues`], { title: TITLE, body: reportBody(lines, runUrl, now) });
  console.log(`opened ${issue.html_url}`);
  // Stage and Priority, so the issue shows in "Needs me". Only on this issue, never Ready.
  try {
    const fields = api([`orgs/${REPO.split('/')[0]}/issue-fields`]);
    const id = (name) => (fields.find((f) => f.name === name) || {}).id;
    const values = [{ field_id: id('Stage'), value: 'Asking' }, { field_id: id('Priority'), value: 80 }].filter((v) => v.field_id);
    api(['-X', 'POST', `repos/${REPO}/issues/${issue.number}/issue-field-values`], { issue_field_values: values });
    console.log('set Stage Asking, Priority 80');
  } catch (e) {
    console.log(`warn could not set Stage and Priority: ${(e.stderr || e.message).split('\n')[0]}`);
  }
} else if (action === 'comment' || action === 'touch') {
  api(['-X', 'PATCH', `repos/${REPO}/issues/${open.number}`], { body: reportBody(lines, runUrl, now) });
  if (action === 'comment') {
    api(['-X', 'POST', `repos/${REPO}/issues/${open.number}/comments`], {
      body: `What needs action changed. The body is up to date ([run](${runUrl})).\n\n${lines.join('\n')}`,
    });
  }
} else if (action === 'close') {
  api(['-X', 'POST', `repos/${REPO}/issues/${open.number}/comments`], { body: `All clear: the last [run](${runUrl}) found nothing to report. Closing.` });
  api(['-X', 'PATCH', `repos/${REPO}/issues/${open.number}`], { state: 'closed', state_reason: 'completed' });
}

const errors = outcomes.filter((o) => o.state === 'error');
if (errors.length) {
  console.log(`::error::${errors.length} board(s) failed: ${errors.map((o) => o.title).join(', ')}`);
  process.exit(1);
}
