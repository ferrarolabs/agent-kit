#!/bin/sh
# Install the account layer into ~/.claude (ADR 0010, ADR 0017):
#   CLAUDE.md                        the account rules
#   settings.json                    the account deny floor and the SessionStart hook
#   hooks/project-rules-check.js     says when a session's project rules didn't load
#
# From a checkout:   sh account/install.sh
# From anywhere:     curl -fsSL https://raw.githubusercontent.com/ferrarolabs/agent-kit/main/account/install.sh | sh
#
# CLAUDE_CONFIG_DIR, when set, is used instead of ~/.claude (the probe uses it).
# AGENT_KIT_REF picks the branch or commit to download from (default: main).
#
# CLAUDE.md and the hook are always replaced: edit them in agent-kit, never in place.
# An existing settings.json is never overwritten: the kit's floor is merged into it
# (account/merge-settings.js), with a backup. Lists add up; a value you set stays yours.
set -eu

dest=${CLAUDE_CONFIG_DIR:-$HOME/.claude}
ref=${AGENT_KIT_REF:-main}
base="https://raw.githubusercontent.com/ferrarolabs/agent-kit/$ref/account"

# Run from a checkout when the files sit next to this script; download them otherwise.
here=$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")
if [ -n "$here" ] && [ -f "$here/settings.json" ] && [ -f "$here/CLAUDE.md" ]; then
  fetch() { cp "$here/$1" "$2"; }
else
  fetch() { curl -fsSL "$base/$1" -o "$2"; }
fi

mkdir -p "$dest/hooks"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for f in CLAUDE.md settings.json merge-settings.js hooks/project-rules-check.js; do
  mkdir -p "$tmp/$(dirname "$f")"
  fetch "$f" "$tmp/$f"
done

cp "$tmp/CLAUDE.md" "$dest/CLAUDE.md"
cp "$tmp/hooks/project-rules-check.js" "$dest/hooks/project-rules-check.js"

if [ ! -f "$dest/settings.json" ] || cmp -s "$tmp/settings.json" "$dest/settings.json"; then
  cp "$tmp/settings.json" "$dest/settings.json"
elif command -v node >/dev/null 2>&1; then
  node "$tmp/merge-settings.js" "$dest/settings.json" "$tmp/settings.json"
else
  cp "$tmp/settings.json" "$dest/settings.kit.json"
  echo "agent-kit: node not found, so $dest/settings.json was kept as it is. The kit's floor is in $dest/settings.kit.json: merge it by hand." >&2
fi
echo "agent-kit account layer installed in $dest"
