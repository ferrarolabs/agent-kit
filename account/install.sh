#!/bin/sh
# Install the account layer into ~/.claude (ADR 0010, ADR 0017, ADR 0019):
#   CLAUDE.md                        the account rules
#   settings.json                    the account deny floor and the SessionStart hook
#   hooks/project-rules-check.js     says when a session's project rules didn't load
#
# With --laptop, also the laptop floor (ADR 0019): sandbox on, no unsandboxed retry,
# credentials hidden or masked. It goes into the system's managed-settings.d/ folder,
# so it needs sudo once, and no project or user file can turn it off.
#
# From a checkout:   sh account/install.sh [--laptop]
# From anywhere:     curl -fsSL https://raw.githubusercontent.com/ferrarolabs/agent-kit/main/account/install.sh | sh -s -- --laptop
#
# CLAUDE_CONFIG_DIR, when set, is used instead of ~/.claude (the probe uses it).
# AGENT_KIT_REF picks the branch or commit to download from (default: main).
# AGENT_KIT_MANAGED_DIR overrides the managed settings folder (tests only).
#
# CLAUDE.md and the hook are always replaced: edit them in agent-kit, never in place.
# An existing settings.json is never overwritten: the kit's floor is merged into it
# (account/merge-settings.js), with a backup. Lists add up; a value you set stays yours.
set -eu

laptop=no
for arg in "$@"; do
  case "$arg" in
    --laptop) laptop=yes ;;
    *) echo "agent-kit: unknown option $arg" >&2; exit 2 ;;
  esac
done

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

# Check the laptop floor can work before changing anything: with failIfUnavailable on,
# a missing sandbox would stop Claude Code from starting at all.
if [ "$laptop" = yes ]; then
  case "$(uname -s)" in
    Darwin) managed=${AGENT_KIT_MANAGED_DIR:-"/Library/Application Support/ClaudeCode"} ;;
    Linux)
      managed=${AGENT_KIT_MANAGED_DIR:-/etc/claude-code}
      for bin in bwrap socat; do
        command -v "$bin" >/dev/null 2>&1 || {
          echo "agent-kit: the sandbox needs $bin. Install bubblewrap and socat (apt install bubblewrap socat), then run this again." >&2
          exit 1
        }
      done
      ;;
    MINGW* | MSYS* | CYGWIN*)
      echo "agent-kit: native Windows has no Claude Code sandbox, so the laptop floor can't hold. Run Claude Code inside WSL2 and run this installer there." >&2
      exit 1
      ;;
    *) echo "agent-kit: no sandbox for $(uname -s); the laptop floor needs macOS, Linux or WSL2." >&2; exit 1 ;;
  esac
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

if [ "$laptop" = yes ]; then
  fetch laptop/managed-floor.json "$tmp/managed-floor.json"
  target="$managed/managed-settings.d/50-agent-kit-floor.json"
  sudo=""
  if [ "$(id -u)" != 0 ] && ! { mkdir -p "$managed/managed-settings.d" 2>/dev/null && [ -w "$managed/managed-settings.d" ]; }; then
    sudo=sudo
    echo "agent-kit: writing $target needs sudo."
  fi
  $sudo mkdir -p "$managed/managed-settings.d"
  $sudo cp "$tmp/managed-floor.json" "$target"
  $sudo chmod 644 "$target"
  echo "agent-kit laptop floor installed in $target. Prove it: node scripts/probe/probe-sandbox-floor.js"
fi
