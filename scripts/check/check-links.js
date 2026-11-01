#!/usr/bin/env node
// Checks every relative link in the repo's Markdown: the file must exist, and an anchor
// (#section) must match a heading in that file. External links (http, mailto) are not
// checked: they fail for reasons that have nothing to do with a PR (rate limits, outages).
//
//   node scripts/check/check-links.js [root]
//
// Prints one line per broken link, file:line first. Exit 1 if any is broken.

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);

function markdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens.
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

// Code blocks and inline code hold examples, not links.
function stripCode(text) {
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (code) => ' '.repeat(code.length));
}

function anchorsOf(text) {
  const anchors = new Set();
  const seen = new Map();
  for (const line of stripCode(text).split('\n')) {
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slug(m[1]);
    const n = seen.get(base) || 0;
    anchors.add(n ? `${base}-${n}` : base);
    seen.set(base, n + 1);
  }
  return anchors;
}

function linksOf(text) {
  const links = [];
  const lines = stripCode(text).split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      links.push({ target: m[1], line: i + 1 });
    }
  });
  return links;
}

function check(root) {
  const broken = [];
  const anchorCache = new Map();
  const anchors = (file) => {
    if (!anchorCache.has(file)) anchorCache.set(file, anchorsOf(fs.readFileSync(file, 'utf8')));
    return anchorCache.get(file);
  };
  for (const file of markdownFiles(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const { target, line } of linksOf(text)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, https:, mailto:
      const [rawPath, anchor] = target.split('#');
      const linkPath = decodeURIComponent(rawPath);
      const resolved = linkPath ? path.resolve(path.dirname(file), linkPath) : file;
      const where = `${path.relative(root, file)}:${line}`;
      if (!fs.existsSync(resolved)) {
        broken.push(`${where}  missing file: ${target}`);
        continue;
      }
      if (anchor && resolved.endsWith('.md') && !anchors(resolved).has(anchor.toLowerCase())) {
        broken.push(`${where}  missing anchor: ${target}`);
      }
    }
  }
  return broken;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const broken = check(root);
  for (const b of broken) console.log(b);
  console.log(broken.length ? `\n${broken.length} broken link(s).` : 'All relative links resolve.');
  process.exit(broken.length ? 1 : 0);
}

module.exports = { slug, anchorsOf, linksOf, check, stripCode };
