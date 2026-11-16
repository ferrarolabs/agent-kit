// TEMPORARY: a test org field and a test board, so the real Stage and boards are never touched.
'use strict';
const fs = require('fs');
const path = require('path');
const { gql, rest, ORG, REPO, FIELD, TITLE, CASES } = require('./common');

const fields = rest(`orgs/${ORG}/issue-fields`);
const stage = fields.find((f) => f.name === 'Stage');
console.log('REAL STAGE OPTIONS (read only, to align the spec):');
console.log(JSON.stringify(stage.options.map(({ id, name, color, description, priority }) => ({ id, name, color, description, priority }))));

let field = fields.find((f) => f.name === FIELD);
if (!field) field = rest(`orgs/${ORG}/issue-fields`, 'POST', {
  name: FIELD, data_type: 'single_select', visibility: 'organization_members_only',
  options: [{ name: 'A', color: 'gray', priority: 1 }, { name: 'B', color: 'blue', priority: 2 }, { name: 'Old', color: 'red', priority: 3 }],
});
console.log(`field "${FIELD}" ${field.id}: ${JSON.stringify(field.options.map((o) => [o.id, o.name]))}`);
fs.writeFileSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'old-option-id'), String(field.options.find((o) => o.name === 'Old').id));

const org = gql(`query{ organization(login:"${ORG}"){ id projectV2(number:3){ id } } }`).organization;
const board = gql(`mutation($p:ID!,$o:ID!,$t:String!){ copyProjectV2(input:{projectId:$p,ownerId:$o,title:$t,includeDraftIssues:false}){ projectV2{ id number template } } }`,
  { p: org.projectV2.id, o: org.id, t: TITLE }).copyProjectV2.projectV2;
if (board.template) gql(`mutation($p:ID!){ unmarkProjectV2AsTemplate(input:{projectId:$p}){ clientMutationId } }`, { p: board.id });
console.log(`test board ${board.number}`);
fs.writeFileSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'test-board'), String(board.number));

const statusId = () => gql(`query($p:ID!){ node(id:$p){ ... on ProjectV2{ field(name:"Status"){ ... on ProjectV2SingleSelectField{ id options{ id name } } } } } }`, { p: board.id }).node.field;
let status = statusId();
gql(`mutation($f:ID!,$o:[ProjectV2SingleSelectFieldOptionInput!]){ updateProjectV2Field(input:{fieldId:$f,singleSelectOptions:$o}){ clientMutationId } }`, {
  f: status.id, o: ['A', 'B', 'Old', 'Extra'].map((name) => ({ name, color: 'GRAY', description: '' })),
});
status = statusId();

for (const [n, [value, start]] of Object.entries(CASES)) {
  const issue = rest(`repos/${REPO}/issues/${n}`);
  const item = gql(`mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`, { p: board.id, c: issue.node_id }).addProjectV2ItemById.item;
  if (value) rest(`repos/${REPO}/issues/${n}/issue-field-values`, 'POST', { issue_field_values: [{ field_id: field.id, value }] });
  if (start) gql(`mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ clientMutationId } }`,
    { p: board.id, i: item.id, f: status.id, o: status.options.find((o) => o.name === start).id });
  console.log(`issue ${n}: ${FIELD}=${value} Status=${start}`);
}

fs.writeFileSync(path.join(__dirname, '..', 'projects.json'), JSON.stringify({ owner: ORG, projects: [{ title: TITLE, number: board.number, repo: 'agent-kit' }] }));
console.log('registry: the test board only');
