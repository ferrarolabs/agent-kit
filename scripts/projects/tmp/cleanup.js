// TEMPORARY: delete the test board and the test field. Runs even when a step failed.
'use strict';
const fs = require('fs');
const path = require('path');
const { gql, rest, ORG, FIELD } = require('./common');
try {
  const number = Number(fs.readFileSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'test-board'), 'utf8'));
  const id = gql(`query($n:Int!){ organization(login:"${ORG}"){ projectV2(number:$n){ id title } } }`, { n: number }).organization.projectV2;
  if (id.title !== 'Sync test') throw new Error(`project ${number} is "${id.title}": not deleting it`);
  gql(`mutation($p:ID!){ deleteProjectV2(input:{projectId:$p}){ clientMutationId } }`, { p: id.id });
  console.log(`deleted test board ${number}`);
} catch (e) { console.log(`board: ${e.message}`); }
const field = rest(`orgs/${ORG}/issue-fields`).find((f) => f.name === FIELD);
if (field) { rest(`orgs/${ORG}/issue-fields/${field.id}`, 'DELETE'); console.log(`deleted field "${FIELD}"`); }
