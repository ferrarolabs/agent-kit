// Run with: node --test (from the repo root). The browser part is not tested here: it is
// proven by a real run, pasted in the PR. These are the pure parts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, fileNameFor, staticFileFor, signInFromEnv, landing } = require('./capture');

test('parseArgs reads routes, viewport and one source', () => {
  const o = parseArgs(['--out', 'shots', '--serve', 'dist', '--routes', '/, /band/create', '--width', '360']);
  assert.deepEqual(o.routes, ['/', '/band/create']);
  assert.equal(o.width, 360);
  assert.equal(o.height, 844);
  assert.equal(o.serve, 'dist');
});

test('parseArgs refuses bad input', () => {
  assert.throws(() => parseArgs(['--routes', '/', '--serve', 'd']), /--out/);
  assert.throws(() => parseArgs(['--out', 'o', '--serve', 'd']), /--routes/);
  assert.throws(() => parseArgs(['--out', 'o', '--routes', '/']), /exactly one/);
  assert.throws(() => parseArgs(['--out', 'o', '--routes', '/', '--serve', 'd', '--base', 'http://x']), /exactly one/);
  assert.throws(() => parseArgs(['--out', 'o', '--routes', 'band', '--serve', 'd']), /start with \//);
  assert.throws(() => parseArgs(['--out', 'o', '--routes', '/', '--serve', 'd', '--width', '0']), /positive/);
  assert.throws(() => parseArgs(['--out', '--routes', '/']), /needs a value/);
  assert.throws(() => parseArgs(['--nope']), /unknown flag/);
});

test('fileNameFor turns a route into a safe file name', () => {
  assert.equal(fileNameFor('/'), 'index.png');
  assert.equal(fileNameFor('/band/create'), 'band-create.png');
  assert.equal(fileNameFor('/join/ABC123'), 'join-ABC123.png');
  assert.equal(fileNameFor('/join/a b?x=1'), 'join-a-b-x-1.png');
  assert.equal(fileNameFor('/../../etc/passwd'), '..-..-etc-passwd.png');
  assert.ok(!fileNameFor('/../../etc/passwd').includes('/'));
});

test('staticFileFor serves files inside root, falls back otherwise, never escapes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-'));
  fs.mkdirSync(path.join(root, '_expo'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html>');
  fs.writeFileSync(path.join(root, '_expo', 'app.js'), '');
  fs.writeFileSync(path.join(path.dirname(root), 'secret.txt'), 'x');
  assert.equal(staticFileFor(root, '/_expo/app.js?v=1'), path.join(root, '_expo', 'app.js'));
  assert.equal(staticFileFor(root, '/band/create'), null); // single-page fallback
  assert.equal(staticFileFor(root, '/_expo'), null); // a folder is not a file
  assert.equal(staticFileFor(root, '/../secret.txt'), null);
  assert.equal(staticFileFor(root, '/%2e%2e/secret.txt'), null);
  assert.equal(staticFileFor(root, '/%E0%A4%A'), null); // malformed encoding
});

test('signInFromEnv needs all three variables, and reports only names', () => {
  assert.deepEqual(signInFromEnv({}), { config: null, missing: [] });
  const partial = signInFromEnv({ CAPTURE_EMAIL: 'a@b.c' });
  assert.equal(partial.config, null);
  assert.deepEqual(partial.missing, ['CAPTURE_SIGN_IN_ROUTE or --sign-in-route', 'CAPTURE_PASSWORD']);
  assert.ok(!JSON.stringify(partial).includes('a@b.c'));
  const full = signInFromEnv({ CAPTURE_SIGN_IN_ROUTE: '/sign-in', CAPTURE_EMAIL: 'a@b.c', CAPTURE_PASSWORD: 'p', CAPTURE_SUBMIT_SELECTOR: '#go' });
  assert.equal(full.config.route, '/sign-in');
  assert.equal(full.config.submitSelector, '#go');
  assert.match(full.config.passwordSelector, /password/);
});

test('signInFromEnv reads the account from the variables a project already has', () => {
  const env = { JAMLY_TEST_EMAIL: 'a@b.c', JAMLY_TEST_PASSWORD: 'p' };
  const names = { signInRoute: '/sign-in', emailEnv: 'JAMLY_TEST_EMAIL', passwordEnv: 'JAMLY_TEST_PASSWORD' };
  const full = signInFromEnv(env, names);
  assert.deepEqual([full.config.route, full.config.email, full.config.password], ['/sign-in', 'a@b.c', 'p']);
  const partial = signInFromEnv({ JAMLY_TEST_EMAIL: 'a@b.c' }, names);
  assert.equal(partial.config, null);
  assert.deepEqual(partial.missing, ['JAMLY_TEST_PASSWORD']);
  assert.ok(!JSON.stringify(partial).includes('a@b.c'));
});

test('parseArgs takes variable names for the account, never values', () => {
  const o = parseArgs(['--out', 'o', '--routes', '/', '--serve', 'd', '--sign-in-route', '/sign-in', '--email-env', 'JAMLY_TEST_EMAIL', '--password-env', 'JAMLY_TEST_PASSWORD']);
  assert.deepEqual([o.signInRoute, o.emailEnv, o.passwordEnv], ['/sign-in', 'JAMLY_TEST_EMAIL', 'JAMLY_TEST_PASSWORD']);
  assert.throws(() => parseArgs(['--out', 'o', '--routes', '/', '--serve', 'd', '--email-env', 'me@example.com']), /variable name/);
  assert.throws(() => parseArgs(['--out', 'o', '--routes', '/', '--serve', 'd', '--sign-in-route', 'sign-in']), /start with \//);
});

test('landing tells a reached route from a redirect', () => {
  assert.deepEqual(landing('/sign-in', 'http://127.0.0.1:5/sign-in'), { finalPath: '/sign-in', redirected: false });
  assert.deepEqual(landing('/band/create/', 'http://127.0.0.1:5/band/create'), { finalPath: '/band/create', redirected: false });
  assert.deepEqual(landing('/', 'http://127.0.0.1:5/sign-in'), { finalPath: '/sign-in', redirected: true });
  assert.deepEqual(landing('/?a=1', 'http://127.0.0.1:5/'), { finalPath: '/', redirected: false });
});
