#!/usr/bin/env node
// Sets a PR's own `Review level` issue field, then posts a comment that shows it (ADR 0032).
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

const LEVELS = ['green', 'yellow', 'red'];
// A cloud session can't list the org's fields (orgs/... returns 403) and the endpoint takes no
// field name, so the id is a constant. Every response names its field: a wrong id exits 1.
const FIELD = { id: 49500036, name: 'Review level' };
const MARKER = '<!-- review-level -->';
const MAX_REASON = 300;

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

function comment(level, before, reason) {
  const was = before && before !== level ? ` (was ${before})` : '';
  return `${MARKER}\n**Review level: ${level}**${was}\n\n${reason.trim()}`;
}

// The value the PR's field holds now, or null. Exits through an error if the id names another field.
function readLevel(api, repo, pr) {
  const values = api(['GET', `repos/${repo}/issues/${pr}/issue-field-values`]) || [];
  const v = values.find((x) => x.issue_field_id === FIELD.id);
  if (!v) return null;
  if (v.issue_field_name !== FIELD.name) throw new Error(`field ${FIELD.id} is "${v.issue_field_name}", not "${FIELD.name}"`);
  return v.single_select_option ? v.single_select_option.name : null;
}

// The level shown by the latest marked comment this account wrote, or null.
function shownLevel(api, repo, pr, login) {
  const pages = api(['GET', `repos/${repo}/issues/${pr}/comments?per_page=100`, '--paginate', '--slurp']) || [];
  const mine = pages.flat().filter((c) => c.user && c.user.login === login && (c.body || '').startsWith(MARKER));
  if (!mine.length) return null;
  const m = mine[mine.length - 1].body.match(/\*\*Review level: (green|yellow|red)\*\*/);
  return m ? m[1] : null;
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

  const login = api(['GET', 'user']).login;
  if (before === after && shownLevel(api, repo, pr, login) === after) {
    return { ok: true, line: `${repo}#${pr} ${before} -> ${after}, unchanged, comment already shows it` };
  }
  try {
    const c = api(['POST', `repos/${repo}/issues/${pr}/comments`], { body: comment(after, before, reason) });
    return { ok: true, line: `${repo}#${pr} ${before || 'none'} -> ${after} ${c.html_url}` };
  } catch {
    return { ok: false, line: `failed: field set to ${after}, comment not posted; run again to post it` };
  }
}

function ghApi([method, path, ...flags], body) {
  const args = ['api', '-X', method, path, ...flags, ...(body ? ['--input', '-'] : [])];
  const out = execFileSync('gh', args, { encoding: 'utf8', input: body ? JSON.stringify(body) : undefined, stdio: ['pipe', 'pipe', 'pipe'] });
  return out.trim() ? JSON.parse(out) : null;
}

if (require.main === module) {
  const [pr, level] = process.argv.slice(2);
  let result;
  try {
    const remote = execFileSync('git', ['-C', __dirname, 'remote', 'get-url', 'origin'], { encoding: 'utf8' });
    const reason = require('fs').readFileSync(0, 'utf8');
    result = setReviewLevel({ pr, level, reason, repo: repoFromRemote(remote), api: ghApi });
  } catch (e) {
    result = { ok: false, line: `failed: ${(e.stderr || e.message || String(e)).toString().split('\n')[0]}` };
  }
  console.log(result.line);
  process.exit(result.ok ? 0 : 1);
}

module.exports = { FIELD, LEVELS, MARKER, MAX_REASON, repoFromRemote, checkInput, comment, setReviewLevel };
