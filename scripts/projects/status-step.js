// Stage and Status from the spec (issue 176, ADR 0028).
//
// 1. syncStageField: the org's Stage field gets the spec's options. The REST API keeps an
//    option's id when it is sent, so no issue loses its value, and a rename (`was`) carries over.
//    A value the spec drops is removed only when no card on any registered board holds it.
// 2. syncStatus, per board: Status gets Stage's names and colours. A board's options can't keep
//    their ids, so replacing them wipes every card. So: save every card, replace, put each back
//    (its old column if it still exists, else its Stage's, else none), then check card by card.
//    Every run also fills a card that has a Stage and no Status, so a crashed run converges.
//
// Network goes through the injected `gql` (GraphQL) and `rest` (REST, returns parsed JSON),
// so node:test drives it with fakes. This is the only file that writes an item's field value.
'use strict';
const { planStage, stagePayload, statusTarget, sameStatus, planRestore, verifyRestore, chunks } = require('./status-plan');

// ---- the org's Stage field
function readStageField(rest, owner, name) {
  const field = rest(`orgs/${owner}/issue-fields`).find((f) => f.name === name);
  if (!field) throw new Error(`the org has no issue field "${name}"`);
  return field;
}

// `inUse(name)` says whether any card holds that value. Returns { field, changed, refused }.
function syncStageField({ rest, owner, stage, inUse, write, log }) {
  const field = readStageField(rest, owner, stage.field);
  const plan = planStage(stage.options, field.options || []);
  const refused = plan.removed.filter((name) => inUse(name));
  if (!plan.changed && !refused.length) return { field, changed: false, refused };
  if (!write) return { field, changed: plan.changed, refused };
  const payload = stagePayload(plan, field.options, refused);
  rest(`orgs/${owner}/issue-fields/${field.id}`, { method: 'PATCH', body: { options: payload } });
  for (const [a, b] of plan.renamed) log(`renamed ${stage.field} "${a}" to "${b}"`);
  for (const n of plan.removed.filter((x) => !refused.includes(x))) log(`removed ${stage.field} "${n}"`);
  if (plan.added.length) log(`added ${stage.field} ${plan.added.map((n) => `"${n}"`).join(', ')}`);
  if (plan.updated) log(`updated ${stage.field} colours, descriptions or order`);
  return { field: readStageField(rest, owner, stage.field), changed: true, refused };
}

// ---- a board's Status
const ITEMS_Q = `query($p:ID!,$after:String){ node(id:$p){ ... on ProjectV2{ items(first:100, after:$after){
  pageInfo{ hasNextPage endCursor }
  nodes{ id fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } }
    content{ ... on Issue{ number repository{ nameWithOwner } } } } } } } }`;

function readItems(gql, projectId) {
  const out = [];
  let after = null;
  for (;;) {
    const page = gql(ITEMS_Q, { p: projectId, after }).node.items;
    for (const n of page.nodes) {
      if (!n.content || !n.content.repository) continue; // drafts and PRs carry no Stage
      out.push({ id: n.id, status: n.fieldValueByName ? n.fieldValueByName.name : null, repo: n.content.repository.nameWithOwner, number: n.content.number });
    }
    if (!page.pageInfo.hasNextPage) return out;
    after = page.pageInfo.endCursor;
  }
}

// An issue's value for the Stage field, by REST. null if it has none.
function stageOf(rest, item, fieldId) {
  const values = rest(`repos/${item.repo}/issues/${item.number}/issue-field-values`);
  const v = (values || []).find((x) => x.issue_field_id === fieldId);
  if (!v) return null;
  return (v.single_select_option && v.single_select_option.name) || (typeof v.value === 'string' ? v.value : null);
}

function readStatusField(gql, projectId) {
  return gql(`query($p:ID!){ node(id:$p){ ... on ProjectV2{ field(name:"Status"){ ... on ProjectV2SingleSelectField{ id options{ id name color } } } } } }`, { p: projectId }).node.field;
}

// The one place an item's field value is written: the board's own Status field, looked up here.
function writeStatus(gql, projectId, writes) {
  const status = readStatusField(gql, projectId);
  const optionId = (name) => {
    const o = status.options.find((x) => x.name === name);
    if (!o) throw new Error(`Status has no option "${name}"`);
    return o.id;
  };
  // Small batches: 50 writes in one request timed out on GitHub's side (HTTP 504, 2026-11-17).
  for (const batch of chunks(writes, 10)) {
    const parts = batch.map((w, i) => `w${i}: updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:"${w.id}",fieldId:"${status.id}",value:{singleSelectOptionId:"${optionId(w.want)}"}}){ clientMutationId }`);
    withRetry(() => gql(`mutation($p:ID!){ ${parts.join(' ')} }`, { p: projectId }));
  }
}

// Secondary rate limits come back as errors; wait and try again, a few times.
function withRetry(fn, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      return fn();
    } catch (e) {
      const text = `${e.message}\n${e.stdout || ''}`;
      if (i + 1 >= tries || !/rate limit|secondary|abuse|timeout|50[234]/i.test(text)) throw e;
      const until = Date.now() + 2000 * 2 ** i;
      while (Date.now() < until) { /* wait: the script is synchronous on purpose */ }
    }
  }
}

// Returns { replaced, written: [ids], unplaced: [{id, number}], mismatches: [...] }.
function syncStatus({ gql, rest, projectId, stageField, write, log, saveSnapshot }) {
  const target = statusTarget(stageField.options);
  const status = readStatusField(gql, projectId);
  const replace = !sameStatus(status.options, target);
  const items = readItems(gql, projectId);
  // Stage is read only where it is needed: every card before a replace, else the empty ones.
  const need = replace ? items : items.filter((i) => !i.status);
  for (const i of need) i.stage = stageOf(rest, i, stageField.id);
  if (!write) return { replaced: replace, written: [], unplaced: [], mismatches: [], wouldReplace: replace, wouldFill: need.filter((i) => i.stage).length };

  if (replace) {
    saveSnapshot(items.map(({ id, status: s, stage }) => ({ id, status: s, stage })));
    gql(`mutation($f:ID!,$o:[ProjectV2SingleSelectFieldOptionInput!]){ updateProjectV2Field(input:{fieldId:$f,singleSelectOptions:$o}){ clientMutationId } }`, {
      f: status.id, o: target.map((t) => ({ name: t.name, color: t.color, description: t.description })),
    });
    log(`replaced Status options with ${target.map((t) => t.name).join(', ')}`);
  }
  const names = target.map((t) => t.name);
  const plan = planRestore(need, names, { replaced: replace });
  // Re-read just before writing: a card someone set meanwhile is not overwritten.
  const now = new Map(readItems(gql, projectId).map((i) => [i.id, i.status]));
  const writes = plan.writes.filter((w) => !now.get(w.id));
  writeStatus(gql, projectId, writes);
  if (writes.length) log(`set Status on ${writes.length} card(s) from their saved column or Stage`);

  const after = new Map(readItems(gql, projectId).map((i) => [i.id, i.status]));
  const mismatches = verifyRestore(plan.expected, after, new Set(plan.writes.filter((w) => !writes.includes(w)).map((w) => w.id)));
  return { replaced: replace, written: writes.map((w) => w.id), unplaced: plan.unplaced, mismatches };
}

module.exports = { syncStageField, syncStatus, readItems, stageOf, writeStatus, withRetry };
