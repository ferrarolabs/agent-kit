#!/usr/bin/env node
// Sets a PR's own `Review level` issue field, then posts a comment that shows it (ADR 0032).
// The comment also starts the `Review level` check (ADR 0033), so it is posted on every run.
//
//   echo "<reason>" | node scripts/review-level/set.js <pr> <green|yellow|red>
//
// The reason comes on stdin, never as an argument, so no shell ever expands it.
// It writes only the Review level field, only on an open PR of the repo this checkout comes from.
// It posts the comment only once the read-back matches, and builds it from the read-back.
// Exit 0: field set and shown. Exit 1: refused or failed, with one line saying why.
// Needs `gh` with Issues and Pull requests write on the repo.
'use strict';
const { execFileSync } = require('child_process');
const { FIELD, LEVELS, MAX_REASON, readLevel, comment } = require('./lib');
const { ghApi } = require('./gh');

// "owner/repo" from a git remote URL: https, ssh, or a proxy path ending in owner/repo.
function repoFromRemote(url) {
  const m = String(url).trim().match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error(`can't read owner/repo from the origin remote`);
  return `${m[1]}/${m[2]}`;
}

function checkInput(pr, level, reason) {
  if (!/^[1-9]\d*$/.test(String(pr))) return `"${pr}" is not a PR number`;
  if (!LEVELS.includes(level)) return `level must be one of ${LEVELS.join(', ')}, not "${level}"`;
  const r = (reason || '').trim();
  if (!r) return 'the reason is empty: send it on stdin';
  if (r.length > MAX_REASON) return `the reason is ${r.length} characters; at most ${MAX_REASON}`;
  return null;
}

// api(args, body) runs one `gh api` call and returns parsed JSON. Injected, so tests use a fake.
function setReviewLevel({ pr, level, reason, repo, api }) {
  const bad = checkInput(pr, level, reason);
  if (bad) return { ok: false, line: `refused: ${bad}` };

  let pull;
  try {
    pull = api(['GET', `repos/${repo}/pulls/${pr}`]);
  } catch {
    return { ok: false, line: `refused: ${repo}#${pr} is not a pull request` };
  }
  if (!pull || pull.state !== 'open') return { ok: false, line: `refused: ${repo}#${pr} is not an open pull request` };

  const before = readLevel(api, repo, pr);
  api(['POST', `repos/${repo}/issues/${pr}/issue-field-values`], { issue_field_values: [{ field_id: FIELD.id, value: level }] });
  const after = readLevel(api, repo, pr);
  if (after !== level) return { ok: false, line: `failed: ${repo}#${pr} reads back ${after || 'none'}, not ${level}; no comment posted` };

  // Posted every run, the unchanged case included: the comment is what starts the check.
  try {
    const c = api(['POST', `repos/${repo}/issues/${pr}/comments`], { body: comment(after, before, reason) });
    return { ok: true, line: `${repo}#${pr} ${before || 'none'} -> ${after} ${c.html_url}` };
  } catch {
    return { ok: false, line: `failed: field set to ${after}, comment not posted, so the check didn't run; run again` };
  }
}

if (require.main === module) {
  const [pr, level] = process.argv.slice(2);
  let result;
  try {
    const remote = execFileSync('git', ['-C', __dirname, 'remote', 'get-url', 'origin'], { encoding: 'utf8' });
    const reason = require('fs').readFileSync(0, 'utf8');
    result = setReviewLevel({ pr, level, reason, repo: repoFromRemote(remote), api: ghApi() });
  } catch (e) {
    result = { ok: false, line: `failed: ${(e.stderr || e.message || String(e)).toString().split('\n')[0]}` };
  }
  console.log(result.line);
  process.exit(result.ok ? 0 : 1);
}

module.exports = { repoFromRemote, checkInput, setReviewLevel };
