'use strict';
// Tests for Stage and Status from the spec (issue 176).
const test = require('node:test');
const assert = require('node:assert');
const { planStage, stagePayload, statusTarget, sameStatus, planRestore, verifyRestore, chunks } = require('./status-plan');
const { syncStageField, syncStatus } = require('./status-step');

const live = [
  { id: 1, name: 'Inbox', color: 'gray', description: '', priority: 1 },
  { id: 2, name: 'Ready', color: 'blue', description: '', priority: 2 },
  { id: 3, name: 'Old', color: 'red', description: '', priority: 3 },
];
const opt = (name, color, extra = {}) => ({ name, color, description: '', ...extra });

test('Stage: same options, nothing to do', () => {
  const p = planStage([opt('Inbox', 'gray'), opt('Ready', 'blue'), opt('Old', 'red')], live);
  assert.strictEqual(p.changed, false);
});

test('Stage: a rename keeps the option id, so the issues keep their value', () => {
  const p = planStage([opt('Inbox', 'gray'), opt('Ready', 'blue'), opt('New', 'red', { was: 'Old' })], live);
  assert.deepStrictEqual(p.renamed, [['Old', 'New']]);
  assert.deepStrictEqual(p.removed, []);
  const body = stagePayload(p, live, []);
  assert.deepStrictEqual(body[2], { id: 3, name: 'New', color: 'red', description: '', priority: 3 });
});

test('Stage: an option without was and a new name is an add, and the old one a removal', () => {
  const p = planStage([opt('Inbox', 'gray'), opt('Ready', 'blue'), opt('New', 'red')], live);
  assert.deepStrictEqual(p.added, ['New']);
  assert.deepStrictEqual(p.removed, ['Old']);
  assert.ok(!('id' in stagePayload(p, live, [])[2]), 'a new option is sent without an id');
});

test('Stage: a removal still in use is kept, with its id', () => {
  const p = planStage([opt('Inbox', 'gray'), opt('Ready', 'blue')], live);
  const body = stagePayload(p, live, ['Old']);
  assert.deepStrictEqual(body.map((o) => [o.id, o.name]), [[1, 'Inbox'], [2, 'Ready'], [3, 'Old']]);
});

test('Stage: a colour, description or order change is an update', () => {
  assert.ok(planStage([opt('Inbox', 'pink'), opt('Ready', 'blue'), opt('Old', 'red')], live).updated);
  assert.ok(planStage([opt('Ready', 'blue'), opt('Inbox', 'gray'), opt('Old', 'red')], live).updated);
  assert.ok(planStage([opt('Inbox', 'gray', { description: 'new' }), opt('Ready', 'blue'), opt('Old', 'red')], live).updated);
});

test('Status target: Stage order, upper-case colours; same compares names and colours in order', () => {
  const t = statusTarget([{ name: 'B', color: 'blue', priority: 2 }, { name: 'A', color: 'gray', priority: 1 }]);
  assert.deepStrictEqual(t.map((x) => [x.name, x.color]), [['A', 'GRAY'], ['B', 'BLUE']]);
  assert.ok(sameStatus([{ name: 'A', color: 'GRAY' }, { name: 'B', color: 'BLUE' }], t));
  assert.ok(!sameStatus([{ name: 'B', color: 'BLUE' }, { name: 'A', color: 'GRAY' }], t));
});

const items = [
  { id: 'a', status: 'A', stage: 'B', number: 1 }, // keeps its column
  { id: 'b', status: 'Gone', stage: 'B', number: 2 }, // column removed: goes to its Stage
  { id: 'c', status: 'Gone', stage: null, number: 3 }, // no Stage: none, reported
  { id: 'd', status: null, stage: 'A', number: 4 }, // empty: filled from Stage
  { id: 'e', status: 'Old', stage: 'New', number: 5 }, // renamed: Stage's new name
];

test('restore after a replace: old column, else Stage, else none', () => {
  const p = planRestore(items, ['A', 'B', 'New'], { replaced: true });
  assert.deepStrictEqual(p.writes, [{ id: 'a', want: 'A' }, { id: 'b', want: 'B' }, { id: 'd', want: 'A' }, { id: 'e', want: 'New' }]);
  assert.deepStrictEqual(p.unplaced, [{ id: 'c', number: 3 }]);
});

test('without a replace, only empty cards are filled', () => {
  const p = planRestore(items, ['A', 'B', 'New'], { replaced: false });
  assert.deepStrictEqual(p.writes, [{ id: 'd', want: 'A' }]);
});

test('verify is card by card: swapped values fail even when counts match', () => {
  const expected = new Map([['a', 'A'], ['b', 'B']]);
  assert.deepStrictEqual(verifyRestore(expected, new Map([['a', 'A'], ['b', 'B']])), []);
  assert.strictEqual(verifyRestore(expected, new Map([['a', 'B'], ['b', 'A']])).length, 2);
  assert.deepStrictEqual(verifyRestore(expected, new Map([['a', 'B'], ['b', 'B']]), new Set(['a'])), [], 'a card set by someone is skipped');
});

test('chunks of 50', () => {
  assert.deepStrictEqual(chunks(Array(120).fill(0), 50).map((c) => c.length), [50, 50, 20]);
});

// ---- a fake board: GraphQL and REST in memory
function fakeBoard({ options, cards, stages, onRead }) {
  const state = { options: options.map((n, i) => ({ id: `o${i}`, name: n, color: 'GRAY' })), cards: new Map(cards), writes: [], replaces: 0, reads: 0 };
  const optName = (id) => (state.options.find((o) => o.id === id) || {}).name;
  const gql = (q, v) => {
    if (/updateProjectV2Field\(/.test(q)) {
      state.replaces++;
      state.options = v.o.map((o, i) => ({ id: `n${state.replaces}-${i}`, name: o.name, color: o.color }));
      for (const k of state.cards.keys()) state.cards.set(k, null); // what GitHub does: every card loses Status
      return {};
    }
    if (/updateProjectV2ItemFieldValue/.test(q)) {
      for (const m of q.matchAll(/itemId:"([^"]+)",fieldId:"([^"]+)",value:\{singleSelectOptionId:"([^"]+)"\}/g)) {
        assert.strictEqual(m[2], 'STATUS', 'only the Status field is written');
        state.writes.push(m[1]);
        state.cards.set(m[1], optName(m[3]));
      }
      return {};
    }
    if (/field\(name:"Status"\)/.test(q)) return { node: { field: { id: 'STATUS', options: state.options } } };
    if (/items\(first:100/.test(q)) {
      state.reads++;
      if (onRead) onRead(state);
      const nodes = [...state.cards].map(([id, s]) => ({ id, fieldValueByName: s ? { name: s } : null, content: { number: Number(id.slice(1)), repository: { nameWithOwner: 'o/r' } } }));
      return { node: { items: { pageInfo: { hasNextPage: false }, nodes } } };
    }
    throw new Error(`unexpected query ${q.slice(0, 40)}`);
  };
  const rest = (p) => {
    const n = Number(/issues\/(\d+)\//.exec(p)[1]);
    return stages[n] ? [{ issue_field_id: 7, single_select_option: { name: stages[n] } }] : [];
  };
  return { gql, rest, state };
}

const stageField = { id: 7, options: [{ name: 'A', color: 'gray', priority: 1 }, { name: 'B', color: 'blue', priority: 2 }] };

test('syncStatus: replace, then every card is back where it should be', () => {
  const b = fakeBoard({ options: ['A', 'B', 'Gone'], cards: [['i1', 'A'], ['i2', 'Gone'], ['i3', 'Gone'], ['i4', null]], stages: { 1: 'B', 2: 'B', 4: 'A' } });
  let saved = null;
  const r = syncStatus({ gql: b.gql, rest: b.rest, projectId: 'P', stageField, write: true, log: () => {}, saveSnapshot: (s) => { saved = s; } });
  assert.strictEqual(r.replaced, true);
  assert.ok(saved && saved.length === 4, 'the snapshot is saved before the replace');
  assert.deepStrictEqual([...b.state.cards], [['i1', 'A'], ['i2', 'B'], ['i3', null], ['i4', 'A']]);
  assert.deepStrictEqual(r.unplaced, [{ id: 'i3', number: 3 }]);
  assert.deepStrictEqual(r.mismatches, []);
});

test('syncStatus: same options, only an empty card is filled; a second run does nothing', () => {
  const b = fakeBoard({ options: ['A', 'B'], cards: [['i1', 'B'], ['i2', null]], stages: { 1: 'A', 2: 'B' } });
  b.state.options = b.state.options.map((o, i) => ({ ...o, color: i ? 'BLUE' : 'GRAY' }));
  const r = syncStatus({ gql: b.gql, rest: b.rest, projectId: 'P', stageField, write: true, log: () => {}, saveSnapshot: () => {} });
  assert.strictEqual(r.replaced, false);
  assert.deepStrictEqual(b.state.writes, ['i2'], 'a card with a Status is never touched, even if Stage differs');
  syncStatus({ gql: b.gql, rest: b.rest, projectId: 'P', stageField, write: true, log: () => {}, saveSnapshot: () => {} });
  assert.deepStrictEqual(b.state.writes, ['i2'], 'idempotent');
});

test('syncStatus: a card someone sets during the run is not overwritten', () => {
  const b = fakeBoard({
    options: ['A', 'B', 'Gone'], cards: [['i1', 'A'], ['i2', 'Gone']], stages: { 1: 'A', 2: 'B' },
    onRead: (s) => { if (s.reads === 2) s.cards.set('i1', s.options.find((o) => o.name === 'B').name); },
  });
  const r = syncStatus({ gql: b.gql, rest: b.rest, projectId: 'P', stageField, write: true, log: () => {}, saveSnapshot: () => {} });
  assert.strictEqual(b.state.cards.get('i1'), 'B', 'the person\'s move stays');
  assert.ok(!b.state.writes.includes('i1'));
  assert.deepStrictEqual(r.mismatches, []);
});

test('syncStageField: a rename PATCHes with the id; a removal in use is refused and kept', () => {
  const calls = [];
  let options = live.map((o) => ({ ...o }));
  const rest = (p, opts) => {
    if (opts && opts.method) { calls.push(opts.body.options); options = opts.body.options; return {}; }
    return [{ id: 70, name: 'Stage', options }];
  };
  const stage = { field: 'Stage', options: [opt('Inbox', 'gray'), opt('Ready', 'blue')] };
  const r = syncStageField({ rest, owner: 'o', stage, inUse: (n) => n === 'Old', write: true, log: () => {} });
  assert.deepStrictEqual(r.refused, ['Old']);
  assert.deepStrictEqual(calls[0].map((o) => o.id), [1, 2, 3], 'every live id is sent: nothing is recreated');
  const calls2 = [];
  const rest2 = (p, opts) => { if (opts && opts.method) { calls2.push(opts.body); return {}; } return [{ id: 70, name: 'Stage', options: live }]; };
  syncStageField({ rest: rest2, owner: 'o', stage: { field: 'Stage', options: [opt('Inbox', 'gray'), opt('Ready', 'blue'), opt('Old', 'red')] }, inUse: () => false, write: true, log: () => {} });
  assert.deepStrictEqual(calls2, [], 'no change, no PATCH');
});
