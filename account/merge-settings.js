#!/usr/bin/env node
// Merge the kit's settings into an existing settings file, never overwriting it (issue 8, ADR 0017).
//
//   node account/merge-settings.js <existing.json> <kit.json>
//
// Rules, and why:
// - Objects merge key by key. A key only the kit has is added.
// - Lists add up: the kit's entries are appended when the file doesn't have them yet. Claude Code
//   merges permission lists across scopes the same way, so a deny rule is never lost.
// - A value both files set differently stays as the file has it. It is the owner's choice. The
//   script names it on stderr, so the owner can decide.
// - "$schema" and "$comment" are labels, not settings: the file's own wins, silently.
// - The file is backed up next to itself before it is written. Running twice changes nothing.
//
// Exit code: 0 on success (conflicts included), 2 on bad usage or unreadable JSON.

const fs = require('node:fs');

const LABELS = new Set(['$schema', '$comment']);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A key that doesn't depend on property order, so { a, b } and { b, a } are the same entry.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// Pure: returns the merged value and the paths where the two disagreed.
function mergeSettings(existing, kit, path = '') {
  const conflicts = [];
  if (isObject(existing) && isObject(kit)) {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(kit)) {
      const here = path ? `${path}.${key}` : key;
      if (!(key in existing)) merged[key] = value;
      else if (LABELS.has(key) && !path) continue;
      else {
        const inner = mergeSettings(existing[key], value, here);
        merged[key] = inner.merged;
        conflicts.push(...inner.conflicts);
      }
    }
    return { merged, conflicts };
  }
  if (Array.isArray(existing) && Array.isArray(kit)) {
    const seen = new Set(existing.map(stable));
    const added = kit.filter((item) => !seen.has(stable(item)));
    return { merged: [...existing, ...added], conflicts };
  }
  if (stable(existing) !== stable(kit)) conflicts.push(path);
  return { merged: existing, conflicts };
}

function main(argv) {
  const [file, kitFile] = argv;
  if (!file || !kitFile) {
    console.error('usage: merge-settings.js <existing.json> <kit.json>');
    return 2;
  }
  let existing;
  let kit;
  try {
    existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    kit = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
  } catch (error) {
    console.error(`merge-settings: ${error.message}. Nothing was changed.`);
    return 2;
  }
  const { merged, conflicts } = mergeSettings(existing, kit);
  const text = `${JSON.stringify(merged, null, 2)}\n`;
  if (stable(merged) === stable(existing)) {
    console.log(`${file}: already has everything the kit adds.`);
  } else {
    const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, backup);
    fs.writeFileSync(file, text);
    console.log(`${file}: merged the kit's settings. Backup: ${backup}`);
  }
  for (const where of conflicts) {
    console.error(`merge-settings: ${where} differs from the kit; kept the file's value. Check it.`);
  }
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { mergeSettings, stable };
