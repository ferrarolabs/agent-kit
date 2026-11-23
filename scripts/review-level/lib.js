// What the review-level writer (set.js) and the grader (check.js) share (ADR 0032, ADR 0033).
// Pure: no network, no shell. GitHub calls go through an injected api(args, body); see gh.js.
'use strict';

const LEVELS = ['green', 'yellow', 'red'];
// A cloud session can't list the org's fields (orgs/... returns 403) and the endpoint takes no
// field name, so the id is a constant. Every response names its field: a wrong id throws.
const FIELD = { id: 49500036, name: 'Review level' };
const MARKER = '<!-- review-level -->';
const MAX_REASON = 300;
const CHECK_NAME = 'Review level';
// The queue's check is started when this workflow ends (review-level.yml, workflow_run).
const CI_WORKFLOW = 'CI';
const MAX_FILES = 3000; // GitHub's cap on a PR's file list
const MAX_LISTED = 50; // files listed in a summary; a summary holds at most 65,535 characters
const MAX_GROUP = 5; // the main ruleset's max_entries_to_merge

const rank = (level) => LEVELS.indexOf(level);

// The value the PR's field holds now, or null.
function readLevel(api, repo, pr) {
  const values = api(['GET', `repos/${repo}/issues/${pr}/issue-field-values`]) || [];
  const v = values.find((x) => x.issue_field_id === FIELD.id);
  if (!v) return null;
  if (v.issue_field_name !== FIELD.name) throw new Error(`field ${FIELD.id} is "${v.issue_field_name}", not "${FIELD.name}"`);
  const level = v.single_select_option ? v.single_select_option.name : null;
  if (level !== null && !LEVELS.includes(level)) throw new Error(`unknown review level "${level}"`);
  return level;
}

// The marked comment set.js posts. One format, read back by parseComment.
function comment(level, before, reason) {
  const note = before === level ? ' (re-checked)' : before ? ` (was ${before})` : '';
  return `${MARKER}\n**Review level: ${level}**${note}\n\n${reason.trim()}`;
}

function parseComment(body) {
  const text = String(body || '');
  if (!text.startsWith(MARKER)) return null;
  const m = text.match(/^<!-- review-level -->\n\*\*Review level: (green|yellow|red)\*\*[^\n]*\n\n([\s\S]*)$/);
  if (!m) return null;
  // The harness may append a footer after a horizontal rule; it is not part of the reason.
  const reason = m[2].split(/\n-{3,}\n/)[0].trim().slice(0, MAX_REASON);
  return { level: m[1], reason };
}

// A glob from the red list as a RegExp: `**` any depth (zero dirs included), `*` within a name, `?` one char.
function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      re += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function parseGlobs(text) {
  return String(text).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

// The files that put the PR on the red floor. A file counts by its new path and its old one.
function redFiles(files, globs) {
  const res = globs.map(globToRegex);
  const hit = (p) => p && res.some((r) => r.test(p));
  return files.filter((f) => hit(f.filename) || hit(f.previous_filename)).map((f) => f.filename);
}

const floorOf = (red) => (red.length ? 'red' : null);

function listFiles(red) {
  const shown = red.slice(0, MAX_LISTED).map((f) => `- \`${f}\``);
  if (red.length > MAX_LISTED) shown.push(`- and ${red.length - MAX_LISTED} more`);
  return shown.join('\n');
}

// Shown as plain text: a reason is written by an agent, not trusted markup.
function quote(reason) {
  if (!reason) return '';
  const text = reason.replace(/`/g, "'").slice(0, MAX_REASON);
  return `\n\nReason, from the latest marked comment:\n\n\`\`\`text\n${text}\n\`\`\``;
}

const HOW = 'Set it with `scripts/review-level/set.js` ([work flow §2.7](https://github.com/ferrarolabs/agent-kit/blob/main/docs/guides/work-flow.md#27-the-pr)).';

// The check run's conclusion, title and summary for one PR.
function verdict({ level, red, reason }) {
  const floor = floorOf(red);
  const floorText = floor ? `floor ${floor}` : 'no floor';
  if (!level) {
    return { conclusion: 'failure', title: 'no review level yet', summary: `This PR has no review level yet. ${HOW}` };
  }
  const files = red.length ? `\n\nFiles on the red list:\n${listFiles(red)}` : '';
  if (floor && rank(level) < rank(floor)) {
    return {
      conclusion: 'failure',
      title: `${level} · ${floorText}`,
      summary: `The level is \`${level}\`, under the floor \`${floor}\` set by the files touched. Raise it with \`set.js\`, or drop those files.${files}${quote(reason)}`,
    };
  }
  return { conclusion: 'success', title: `${level} · ${floorText}`, summary: `The level is \`${level}\`; ${floor ? `the floor is \`${floor}\`` : 'no file sets a floor'}.${files}${quote(reason)}` };
}

function errorVerdict(err) {
  const line = String((err && (err.message || err)) || 'unknown error').split('\n')[0].slice(0, 200);
  return {
    conclusion: 'failure',
    title: `error: ${line}`,
    summary: 'The check could not decide. Open this run\'s workflow log. Re-running `set.js` posts a new comment and runs it again; if it keeps failing, the agent sets the issue to `Asking`.',
  };
}

// One check for a merge-queue group: fails if any PR fails, failing PRs first.
function groupVerdict(results) {
  const failed = results.filter((r) => r.verdict.conclusion !== 'success');
  const lines = [...failed, ...results.filter((r) => r.verdict.conclusion === 'success')]
    .map((r) => `- #${r.pr}: ${r.verdict.title}`);
  const title = failed.length
    ? `#${failed[0].pr} ${failed[0].verdict.title} (${failed.length} of ${results.length})`
    : `${results.length} PR${results.length > 1 ? 's' : ''} at or above the floor`;
  return { conclusion: failed.length ? 'failure' : 'success', title, summary: `Merge queue group:\n${lines.join('\n')}` };
}

// "gh-readonly-queue/<base>/pr-<n>-<40 hex>" → n, or an error if it isn't a queue branch of the default branch.
function parseQueueBranch(branch, defaultBranch) {
  const esc = String(defaultBranch).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = String(branch).match(new RegExp(`^gh-readonly-queue/${esc}/pr-([1-9]\\d{0,6})-[0-9a-f]{40}$`));
  if (!m) throw new Error(`not a merge queue branch of ${defaultBranch}: "${branch}"`);
  return Number(m[1]);
}

// The PRs in a queue group, from the first-parent chain of GitHub's merge commits between the
// merge base and the head. Fails closed when the chain doesn't explain itself.
function groupPrs(chain, lastPr) {
  if (!chain.length) throw new Error('queue group unresolved: no merge commit');
  if (chain.length > MAX_GROUP) throw new Error(`queue group unresolved: ${chain.length} commits, at most ${MAX_GROUP}`);
  const prs = chain.map((c) => {
    const m = String(c.message).match(/^Merge pull request #([1-9]\d*) from /);
    if (!m) throw new Error(`queue group unresolved: ${String(c.sha).slice(0, 7)} is not a PR merge commit`);
    return Number(m[1]);
  });
  if (prs[0] !== lastPr) throw new Error(`queue group unresolved: head merges #${prs[0]}, the branch names #${lastPr}`);
  return prs.reverse();
}

module.exports = {
  LEVELS, FIELD, MARKER, MAX_REASON, CHECK_NAME, CI_WORKFLOW, MAX_FILES, MAX_LISTED, MAX_GROUP,
  rank, readLevel, comment, parseComment, globToRegex, parseGlobs, redFiles, verdict, errorVerdict,
  groupVerdict, parseQueueBranch, groupPrs,
};
