// TEMPORARY, validation of issue 176 only. Reverted before the PR.
'use strict';
const { execFileSync } = require('child_process');
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 1 << 26 });
const gql = (query, variables = {}) => {
  const j = JSON.parse(gh(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables })));
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
};
const rest = (p, method, body) => {
  const out = method ? gh(['api', '-X', method, p, ...(body ? ['--input', '-'] : [])], body ? JSON.stringify(body) : undefined) : gh(['api', p]);
  return out.trim() ? JSON.parse(out) : null;
};
const ORG = 'ferrarolabs';
const REPO = 'ferrarolabs/agent-kit';
const FIELD = 'Stage test';
const TITLE = 'Sync test';
// issue -> [Stage test value, starting Status on the test board]
const CASES = { 2: ['A', 'A'], 3: ['B', 'Extra'], 5: ['Old', 'Old'], 6: ['B', null], 7: [null, 'Extra'] };
// What each card must hold after the sync, and #5's field value after the rename.
const EXPECT = { 2: 'A', 3: 'B', 5: 'New', 6: 'B', 7: null };
module.exports = { gh, gql, rest, ORG, REPO, FIELD, TITLE, CASES, EXPECT };
