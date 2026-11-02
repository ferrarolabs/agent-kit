#!/usr/bin/env node
// Takes a phone-sized screenshot of each route of a web build, so an agent can see the
// current screens before proposing where something goes (issue: Agents know the product's
// screens before proposing where things go).
//
//   node scripts/screens/capture.js --out <dir> --routes /,/band/create [--serve <dir> | --base <url>]
//
// --serve <dir>  serves a static web export (e.g. `npx expo export --platform web`) on a free
//                local port, with single-page fallback to index.html.
// --base <url>   uses a server that is already running instead.
// --width/--height  viewport, default 390×844 (a phone).
//
// Optional sign-in. The account comes from the environment, so nothing secret is on the
// command line:
//   --sign-in-route <route>  route of the sign-in screen (or CAPTURE_SIGN_IN_ROUTE)
//   --email-env <NAME>       variable holding the test account's email (default CAPTURE_EMAIL)
//   --password-env <NAME>    variable holding its password (default CAPTURE_PASSWORD)
//   CAPTURE_EMAIL_SELECTOR, CAPTURE_PASSWORD_SELECTOR, CAPTURE_SUBMIT_SELECTOR  optional overrides
// --email-env and --password-env let a project reuse the variables its environment already
// has, e.g. --email-env JAMLY_TEST_EMAIL. The values are never printed: only the names of
// the variables that are set or missing.
//
// Prints one line per route: the file written, and where the page ended up. A route that
// lands somewhere else (an auth gate redirecting to sign-in) is marked "redirected", so the
// report says which screens were really reached. Exit 1 if a route could not be captured.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const DEFAULTS = { width: 390, height: 844, settleMs: 800 };

function parseArgs(argv) {
  const opts = { routes: [], width: DEFAULTS.width, height: DEFAULTS.height, emailEnv: 'CAPTURE_EMAIL', passwordEnv: 'CAPTURE_PASSWORD' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    const need = () => {
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      i++;
      return value;
    };
    if (flag === '--out') opts.out = need();
    else if (flag === '--serve') opts.serve = need();
    else if (flag === '--base') opts.base = need();
    else if (flag === '--routes') opts.routes.push(...need().split(',').map((r) => r.trim()).filter(Boolean));
    else if (flag === '--width') opts.width = positiveInt(flag, need());
    else if (flag === '--height') opts.height = positiveInt(flag, need());
    else if (flag === '--sign-in-route') opts.signInRoute = need();
    else if (flag === '--email-env') opts.emailEnv = envName(flag, need());
    else if (flag === '--password-env') opts.passwordEnv = envName(flag, need());
    else throw new Error(`unknown flag ${flag}`);
  }
  if (!opts.out) throw new Error('--out is required');
  if (!opts.routes.length) throw new Error('--routes is required');
  if (Boolean(opts.serve) === Boolean(opts.base)) throw new Error('give exactly one of --serve or --base');
  for (const r of opts.routes) if (!r.startsWith('/')) throw new Error(`route must start with /: ${r}`);
  if (opts.signInRoute !== undefined && !opts.signInRoute.startsWith('/')) throw new Error(`--sign-in-route must start with /: ${opts.signInRoute}`);
  return opts;
}

// A variable name, not a value: refusing anything else stops a secret being passed by mistake.
function envName(flag, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`${flag} takes a variable name, e.g. TEST_EMAIL`);
  return value;
}

function positiveInt(flag, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer`);
  return n;
}

// "/" → "index.png", "/band/create" → "band-create.png", "/join/ABC?x=1" → "join-ABC-x-1.png".
function fileNameFor(route) {
  const name = route
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${name || 'index'}.png`;
}

// The file a static server returns for a URL path, or null to fall back to index.html.
// Never leaves root: "/../x" and encoded variants resolve to null.
function staticFileFor(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  const base = path.resolve(root);
  const full = path.resolve(base, '.' + path.posix.normalize('/' + decoded));
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  try {
    if (fs.statSync(full).isFile()) return full;
  } catch {
    // missing: single-page fallback
  }
  return null;
}

// Sign-in settings from the environment. Returns { config, missing }: config is null unless
// every required variable is set. Only names go into `missing`, never values.
// `names` says which variables hold the account; a route given on the command line
// replaces CAPTURE_SIGN_IN_ROUTE.
function signInFromEnv(env, names = {}) {
  const emailEnv = names.emailEnv || 'CAPTURE_EMAIL';
  const passwordEnv = names.passwordEnv || 'CAPTURE_PASSWORD';
  const values = {
    CAPTURE_SIGN_IN_ROUTE: names.signInRoute || env.CAPTURE_SIGN_IN_ROUTE,
    [emailEnv]: env[emailEnv],
    [passwordEnv]: env[passwordEnv],
  };
  const required = Object.keys(values);
  const missing = required.filter((name) => !values[name]);
  const anySet = required.some((name) => values[name]);
  if (missing.length) return { config: null, missing: anySet ? missing.map((n) => (n === 'CAPTURE_SIGN_IN_ROUTE' ? 'CAPTURE_SIGN_IN_ROUTE or --sign-in-route' : n)) : [] };
  return {
    config: {
      route: values.CAPTURE_SIGN_IN_ROUTE,
      email: values[emailEnv],
      password: values[passwordEnv],
      emailSelector: env.CAPTURE_EMAIL_SELECTOR || 'input[type="email"], input[autocomplete="email"]',
      passwordSelector: env.CAPTURE_PASSWORD_SELECTOR || 'input[type="password"]',
      submitSelector: env.CAPTURE_SUBMIT_SELECTOR || '[role="button"]:has-text("Sign in"), button:has-text("Sign in")',
    },
    missing: [],
  };
}

// Where a route ended up, compared with where it was asked to go.
function landing(requested, finalUrl) {
  const finalPath = new URL(finalUrl).pathname.replace(/\/+$/, '') || '/';
  const wanted = requested.split('?')[0].replace(/\/+$/, '') || '/';
  return { finalPath, redirected: finalPath !== wanted };
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

function serve(root) {
  const index = path.join(root, 'index.html');
  if (!fs.existsSync(index)) throw new Error(`no index.html in ${root}: export the web build first`);
  const server = http.createServer((req, res) => {
    const file = staticFileFor(root, req.url) || index;
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function signIn(page, base, cfg) {
  await page.goto(new URL(cfg.route, base).href, { waitUntil: 'networkidle' });
  await page.locator(cfg.emailSelector).first().fill(cfg.email);
  await page.locator(cfg.passwordSelector).first().fill(cfg.password);
  await page.locator(cfg.submitSelector).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(DEFAULTS.settleMs);
  const { redirected } = landing(cfg.route, page.url());
  return redirected; // left the sign-in screen: signed in
}

async function main(argv, env) {
  const opts = parseArgs(argv);
  const { config: signInCfg, missing } = signInFromEnv(env, opts);
  if (missing.length) console.log(`sign-in skipped: missing ${missing.join(', ')}`);

  let server;
  let base = opts.base;
  if (opts.serve) {
    server = await serve(opts.serve);
    base = `http://127.0.0.1:${server.address().port}`;
  }
  fs.mkdirSync(opts.out, { recursive: true });

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  let failed = 0;
  try {
    const context = await browser.newContext({ viewport: { width: opts.width, height: opts.height } });
    const page = await context.newPage();
    if (signInCfg) {
      const ok = await signIn(page, base, signInCfg);
      console.log(ok ? 'signed in' : 'sign-in did not leave the sign-in screen');
    }
    for (const route of opts.routes) {
      const file = path.join(opts.out, fileNameFor(route));
      try {
        await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
        await page.waitForTimeout(DEFAULTS.settleMs);
        await page.screenshot({ path: file });
        const { finalPath, redirected } = landing(route, page.url());
        console.log(`${redirected ? 'redirected' : 'reached   '}  ${route} → ${finalPath}  ${file}`);
      } catch (err) {
        failed++;
        console.log(`FAILED      ${route}  ${err.message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  return failed ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(2);
    },
  );
}

module.exports = { parseArgs, fileNameFor, staticFileFor, signInFromEnv, landing };
