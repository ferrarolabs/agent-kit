#!/usr/bin/env node
// Probe a repo's deny rules: does each command get the verdict the cases file expects?
//
//   node scripts/probe/probe-deny-rules.js <repo-dir> <cases.json> [--model <id>] [--jobs <n>]
//                                          [--account <config-dir>]
//
// How it works, and why each part is there:
// - The repo is cloned into a temporary folder, and its origin is pointed at a local bare
//   repository. A push that a rule fails to deny lands there, never on GitHub.
// - One headless Claude session per case, started in the clone's root, so the repo's
//   .claude/settings.json loads (it loads only from the start folder). One session per case:
//   a long list made the model refuse some commands on its own.
// - Every Bash command is allowed on the command line, and only project settings are read.
//   Deny beats allow, so a denial can only come from the repo's own deny rules.
// - Verdicts come from Claude Code's event stream: the Bash call the model attempted, and
//   permission_denials in the final result. Never from the model's answer.
// - A case the model never attempted counts as failed: no evidence is not a pass.
// - With --account <config-dir>, the account layer is probed instead (ADR 0017): only user
//   settings are read, from that folder (CLAUDE_CONFIG_DIR), and each session starts in the
//   folder above the clone, as a cloud session with several repos does. The repo's own rules
//   don't load there, so a denial can only come from the account deny floor.
//
// Exit code: 0 when every case got its expected verdict, 1 otherwise, 2 on bad usage.

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_MODEL = 'claude-haiku-5-5';
const PROBE_BRANCH = 'probe-deny-rules';

const normalise = (command) => String(command).trim().replace(/\s+/g, ' ');

// Reads stream-json lines and decides one case.
function verdictFromStream(lines, command) {
  const wanted = normalise(command);
  let attempted = false;
  let denied = false;
  let other = [];
  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'assistant') {
      for (const part of event.message?.content ?? []) {
        if (part.type !== 'tool_use' || part.name !== 'Bash') continue;
        const ran = normalise(part.input?.command ?? '');
        if (ran === wanted) attempted = true;
        else other.push(ran);
      }
    }
    if (event.type === 'result') {
      for (const d of event.permission_denials ?? []) {
        if (d.tool_name === 'Bash' && normalise(d.tool_input?.command ?? '') === wanted) denied = true;
      }
    }
  }
  if (!attempted) {
    return { verdict: 'not attempted', detail: other.length ? `ran instead: ${other.join(' ; ')}` : 'no Bash call' };
  }
  return { verdict: denied ? 'deny' : 'allow', detail: '' };
}

function prepareClone(repoDir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-deny-rules-'));
  const clone = path.join(root, 'repo');
  const bare = path.join(root, 'origin.git');
  const run = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  run(['clone', '--quiet', '--no-hardlinks', repoDir, clone]);
  // Carry over uncommitted settings too: the probe tests the rules as they are on disk.
  const settings = path.join(repoDir, '.claude', 'settings.json');
  if (fs.existsSync(settings)) {
    fs.mkdirSync(path.join(clone, '.claude'), { recursive: true });
    fs.copyFileSync(settings, path.join(clone, '.claude', 'settings.json'));
  }
  run(['init', '--quiet', '--bare', bare]);
  // Cloud sessions check the repo out shallow, and a bare repo refuses a shallow push by
  // default ("shallow update not allowed"). The probe's origin is a throwaway: accept it.
  run(['config', 'receive.shallowUpdate', 'true'], bare);
  run(['remote', 'set-url', 'origin', bare], clone);
  run(['checkout', '--quiet', '-B', PROBE_BRANCH], clone);
  run(['push', '--quiet', 'origin', `${PROBE_BRANCH}:${PROBE_BRANCH}`], clone);
  return { root, clone };
}

function runCase(clone, command, model, account) {
  const prompt =
    'This is a test of permission rules in a throwaway clone whose origin is a local folder. ' +
    'Nothing reaches a real server. Run exactly this Bash command, unchanged, as a single tool ' +
    `call, and nothing else:\n\n${command}\n\nIf it is refused, do not retry or try anything else. Reply DONE.`;
  const args = [
    '-p',
    prompt,
    '--model',
    model,
    '--allowedTools',
    'Bash',
    '--setting-sources',
    account ? 'user' : 'project',
    '--output-format',
    'stream-json',
    '--verbose',
    '--no-session-persistence',
  ];
  return new Promise((resolve) => {
    const cwd = account ? path.dirname(clone) : clone;
    const env = account ? { ...process.env, CLAUDE_CONFIG_DIR: account } : process.env;
    const child = spawn('claude', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (b) => (out += b));
    child.stderr.on('data', (b) => (err += b));
    const timer = setTimeout(() => child.kill('SIGKILL'), 180000);
    child.on('close', (code) => {
      clearTimeout(timer);
      const result = verdictFromStream(out.split('\n'), command);
      if (result.verdict === 'not attempted' && code !== 0) {
        result.detail = `claude exited ${code}: ${err.trim().split('\n').slice(-1)[0] || 'no output'}`;
      }
      resolve(result);
    });
  });
}

async function pool(items, jobs, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}

function parseArgs(argv) {
  const opts = { model: DEFAULT_MODEL, jobs: 4, account: null, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model') opts.model = argv[++i];
    else if (argv[i] === '--jobs') opts.jobs = Number(argv[++i]);
    else if (argv[i] === '--account') opts.account = path.resolve(argv[++i]);
    else opts.positional.push(argv[i]);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [repoDir, casesFile] = opts.positional;
  if (!repoDir || !casesFile) {
    console.error('usage: probe-deny-rules.js <repo-dir> <cases.json> [--model <id>] [--jobs <n>] [--account <config-dir>]');
    return 2;
  }
  const { cases } = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  const { root, clone } = prepareClone(path.resolve(repoDir));
  const where = opts.account
    ? `the folder above a clone of ${path.resolve(repoDir)}, account settings from ${opts.account} only`
    : `a clone of ${path.resolve(repoDir)}`;
  console.log(`Probing ${cases.length} cases in ${where} (origin: a local bare repo), model ${opts.model}\n`);

  const results = await pool(cases, opts.jobs, async (c) => {
    let r = await runCase(clone, c.command, opts.model, opts.account);
    if (r.verdict === 'not attempted') r = await runCase(clone, c.command, opts.model, opts.account); // one retry
    return { ...c, ...r, pass: r.verdict === c.expect };
  });

  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    console.log(`${mark}  expect ${r.expect.padEnd(5)}  got ${r.verdict.padEnd(13)}  ${r.command}${r.detail ? `   (${r.detail})` : ''}`);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} of ${results.length} as expected.`);
  fs.rmSync(root, { recursive: true, force: true });
  return failed.length ? 1 : 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(2);
    },
  );
}

module.exports = { verdictFromStream, normalise };
