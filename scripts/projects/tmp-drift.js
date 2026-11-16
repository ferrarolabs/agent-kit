// TEMPORARY, validation of issue 175 only: change the "Shipped" filter on the agent-kit board (project 4)
// outside the spec, as a person would by hand. The sync that follows must put it back.
'use strict';
const { execFileSync } = require('child_process');
const gql = (query, variables) => {
  const j = JSON.parse(execFileSync('gh', ['api', 'graphql', '--input', '-'], { input: JSON.stringify({ query, variables }), encoding: 'utf8' }));
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
};
const p = gql(`query{ organization(login:"ferrarolabs"){ projectV2(number:4){ title views(first:50){ nodes{ id name filter } } } } }`).organization.projectV2;
const v = p.views.nodes.find((x) => x.name === 'Shipped');
gql(`mutation($v:ID!,$f:String!){ updateProjectV2View(input:{viewId:$v,filter:$f}){ clientMutationId } }`, { v: v.id, f: 'is:issue is:closed reason:completed' });
console.log(`drift: board "${p.title}" view "Shipped" filter "${v.filter}" -> "is:issue is:closed reason:completed"`);
