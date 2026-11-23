// The one network layer of scripts/review-level: `gh api`, with an argument array, never a shell.
// api([method, path, ...flags], body) → parsed JSON. `token` picks the credential for this call.
'use strict';
const { execFileSync } = require('child_process');

function ghApi(token) {
  return ([method, path, ...flags], body) => {
    const args = ['api', '-X', method, path, ...flags, ...(body ? ['--input', '-'] : [])];
    const env = token ? { ...process.env, GH_TOKEN: token } : process.env;
    const out = execFileSync('gh', args, { encoding: 'utf8', env, input: body ? JSON.stringify(body) : undefined, stdio: ['pipe', 'pipe', 'pipe'] });
    return out.trim() ? JSON.parse(out) : null;
  };
}

module.exports = { ghApi };
