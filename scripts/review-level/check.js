#!/usr/bin/env node
// Computes a PR's review level against its floor and posts the `Review level` check run (ADR 0033).
// Run by .github/workflows/review-level.yml only, on the default branch's code, in two modes:
//   comment: a marked comment from set.js on PR $PR_NUMBER
//   queue:   CI finished on a merge-queue commit $HEAD_SHA on branch $HEAD_BRANCH
// Reads go through `read` (Actions' token), the one write through `write` (the App's token).
// Event values arrive only as environment variables, and are validated before use.
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const RED_LIST = path.join(__dirname, '..', '..', '.github', 'review-level-red.txt');

function files(read, repo, pull) {
  const list = (read(['GET', `repos/${repo}/pulls/${pull.number}/files?per_page=100`, '--paginate', '--slurp']) || []).flat();
  if (list.length !== pull.changed_files || list.length >= lib.MAX_FILES) {
    throw new Error(`file list truncated: read ${list.length} of ${pull.changed_files} files`);
  }
  return list;
}

function prVerdict(read, repo, pull, globs, reason) {
  const level = lib.readLevel(read, repo, pull.number);
  return lib.verdict({ level, red: lib.redFiles(files(read, repo, pull), globs), reason });
}

function post(write, repo, sha, v) {
  write(['POST', `repos/${repo}/check-runs`], {
    name: lib.CHECK_NAME, head_sha: sha, status: 'completed', conclusion: v.conclusion,
    output: { title: v.title, summary: v.summary },
  });
}

function commentMode({ env, read, write, globs, repo }) {
  if (!/^[1-9]\d{0,6}$/.test(String(env.PR_NUMBER))) throw new Error(`bad PR number "${env.PR_NUMBER}"`);
  const pull = read(['GET', `repos/${repo}/pulls/${env.PR_NUMBER}`]);
  if (pull.base.ref !== env.DEFAULT_BRANCH) return { skipped: `#${pull.number} targets ${pull.base.ref}, not ${env.DEFAULT_BRANCH}` };
  if (pull.state !== 'open') return { skipped: `#${pull.number} is ${pull.state}` };
  const parsed = lib.parseComment(env.COMMENT_BODY);
  let v;
  try {
    v = prVerdict(read, repo, pull, globs, parsed && parsed.reason);
  } catch (e) {
    v = lib.errorVerdict(e);
  }
  post(write, repo, pull.head.sha, v);
  return { posted: v, sha: pull.head.sha };
}

function queueMode({ env, read, write, globs, repo }) {
  const sha = String(env.HEAD_SHA);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`bad head SHA "${sha}"`);
  let v;
  try {
    const lastPr = lib.parseQueueBranch(env.HEAD_BRANCH, env.DEFAULT_BRANCH);
    const base = read(['GET', `repos/${repo}/compare/${env.DEFAULT_BRANCH}...${sha}`]).merge_base_commit.sha;
    const chain = [];
    for (let at = sha; at !== base; ) {
      if (chain.length > lib.MAX_GROUP) throw new Error(`queue group unresolved: more than ${lib.MAX_GROUP} merge commits`);
      const c = read(['GET', `repos/${repo}/commits/${at}`]);
      chain.push({ sha: c.sha, message: c.commit.message });
      at = c.parents[0].sha;
    }
    const results = lib.groupPrs(chain, lastPr).map((pr) => {
      const pull = read(['GET', `repos/${repo}/pulls/${pr}`]);
      let pv;
      try {
        pv = prVerdict(read, repo, pull, globs, null);
      } catch (e) {
        pv = lib.errorVerdict(e);
      }
      return { pr, verdict: pv };
    });
    v = lib.groupVerdict(results);
  } catch (e) {
    v = lib.errorVerdict(e);
  }
  post(write, repo, sha, v);
  return { posted: v, sha };
}

function run({ env, read, write, globs }) {
  const repo = String(env.GITHUB_REPOSITORY);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`bad repository "${repo}"`);
  if (!/^[\w./-]+$/.test(String(env.DEFAULT_BRANCH))) throw new Error(`bad default branch "${env.DEFAULT_BRANCH}"`);
  const ctx = { env, read, write, globs, repo };
  if (env.MODE === 'comment') return commentMode(ctx);
  if (env.MODE === 'queue') return queueMode(ctx);
  throw new Error(`unknown mode "${env.MODE}"`);
}

if (require.main === module) {
  const { ghApi } = require('./gh');
  try {
    const r = run({
      env: process.env,
      read: ghApi(process.env.READ_TOKEN),
      write: ghApi(process.env.APP_TOKEN),
      globs: lib.parseGlobs(fs.readFileSync(RED_LIST, 'utf8')),
    });
    console.log(r.skipped ? `skipped: ${r.skipped}` : `${r.sha}: ${r.posted.conclusion} · ${r.posted.title}`);
  } catch (e) {
    // Nothing could be posted: fail the job, so the run shows red with this line.
    console.log(`::error::${(e.stderr || e.message || String(e)).toString().split('\n')[0]}`);
    process.exit(1);
  }
}

module.exports = { run, RED_LIST };
