// TEMPORARY: check the test board card by card, and the rename on the test field.
'use strict';
const fs = require('fs');
const path = require('path');
const { gql, rest, ORG, REPO, FIELD, EXPECT } = require('./common');
const number = Number(fs.readFileSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'test-board'), 'utf8'));
const oldId = Number(fs.readFileSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'old-option-id'), 'utf8'));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };

const field = rest(`orgs/${ORG}/issue-fields`).find((f) => f.name === FIELD);
const renamed = field.options.find((o) => o.name === 'New');
check(renamed && renamed.id === oldId, `"Old" renamed to "New" keeping id ${oldId}: ${JSON.stringify(field.options.map((o) => [o.id, o.name]))}`);
const v5 = rest(`repos/${REPO}/issues/5/issue-field-values`).find((x) => x.issue_field_id === field.id);
check(v5 && v5.single_select_option && v5.single_select_option.name === 'New', `issue 5 still holds the renamed value: ${JSON.stringify(v5)}`);

const p = gql(`query($n:Int!){ organization(login:"${ORG}"){ projectV2(number:$n){ field(name:"Status"){ ... on ProjectV2SingleSelectField{ options{ name } } }
  items(first:50){ nodes{ fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } } content{ ... on Issue{ number } } } } } } }`, { n: number }).organization.projectV2;
check(JSON.stringify(p.field.options.map((o) => o.name)) === '["A","B","New"]', `Status options ${JSON.stringify(p.field.options.map((o) => o.name))}`);
for (const [n, want] of Object.entries(EXPECT)) {
  const card = p.items.nodes.find((i) => i.content && i.content.number === Number(n));
  const got = card && card.fieldValueByName ? card.fieldValueByName.name : null;
  check(got === want, `issue ${n}: Status ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
}
console.log(bad ? `${bad} check(s) failed` : 'all checks passed');
process.exit(bad ? 1 : 0);
