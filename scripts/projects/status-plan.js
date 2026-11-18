// Pure planning for status-step.js: no network, so node:test drives it.
'use strict';

const norm = (s) => (s == null ? '' : String(s));

// Spec options [{name, color, description, was?}] against the org field's options
// [{id, name, color, description, priority}]. Matching is by name, or by `was` for a rename.
function planStage(spec, live) {
  const used = new Set();
  const rows = spec.map((s, i) => {
    const match = live.find((l) => l.name === s.name) || (s.was ? live.find((l) => l.name === s.was) : null);
    if (match) used.add(match.id);
    return { spec: s, match, priority: i + 1 };
  });
  const renamed = rows.filter((r) => r.match && r.match.name !== r.spec.name).map((r) => [r.match.name, r.spec.name]);
  const added = rows.filter((r) => !r.match).map((r) => r.spec.name);
  const removed = live.filter((l) => !used.has(l.id)).map((l) => l.name);
  const updated = rows.some((r) => r.match && (
    norm(r.match.color) !== norm(r.spec.color) || norm(r.match.description) !== norm(r.spec.description) || r.match.priority !== r.priority));
  return { rows, renamed, added, removed, updated, changed: renamed.length > 0 || added.length > 0 || removed.length > 0 || updated };
}

// The PATCH body: every spec option, with its id when it exists, then the refused removals kept as they are.
function stagePayload(plan, live, keep) {
  const out = plan.rows.map((r) => ({
    ...(r.match ? { id: r.match.id } : {}),
    name: r.spec.name, color: r.spec.color, description: r.spec.description || '', priority: r.priority,
  }));
  for (const name of keep) {
    const l = live.find((x) => x.name === name);
    out.push({ id: l.id, name: l.name, color: l.color || 'gray', description: l.description || '', priority: out.length + 1 });
  }
  return out;
}

// What a board's Status should be: Stage's options in their order, colours in the project's case.
function statusTarget(stageOptions) {
  return [...stageOptions]
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))
    .map((o) => ({ name: o.name, color: String(o.color || 'gray').toUpperCase(), description: o.description || '' }));
}

function sameStatus(live, target) {
  return JSON.stringify(live.map((o) => [o.name, o.color])) === JSON.stringify(target.map((t) => [t.name, t.color]));
}

// For each card: its old column if it still exists, else its Stage's, else none.
// `items`: [{id, status, stage, number}]. After a replace every card is placed; otherwise only empty ones.
function planRestore(items, names, { replaced }) {
  const has = new Set(names);
  const writes = [];
  const expected = new Map();
  const unplaced = [];
  for (const i of items) {
    if (!replaced && i.status) continue;
    const want = (replaced && i.status && has.has(i.status)) ? i.status : (i.stage && has.has(i.stage) ? i.stage : null);
    expected.set(i.id, want);
    if (want) writes.push({ id: i.id, want });
    else unplaced.push({ id: i.id, number: i.number });
  }
  return { writes, expected, unplaced };
}

// Card by card, against a fresh read. `skipped`: cards someone set during the run, left as they are.
function verifyRestore(expected, after, skipped = new Set()) {
  const out = [];
  for (const [id, want] of expected) {
    if (skipped.has(id)) continue;
    const got = after.has(id) ? after.get(id) : null;
    if ((got || null) !== (want || null)) out.push({ id, want, got });
  }
  return out;
}

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

module.exports = { planStage, stagePayload, statusTarget, sameStatus, planRestore, verifyRestore, chunks };
