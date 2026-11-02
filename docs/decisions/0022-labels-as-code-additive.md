# 0022 · Labels as code: one generic file, repo files on top, a sync that never deletes

**Status:** accepted · 2026-11-02 · from [Labels as code for the whole org](https://github.com/ferrarolabs/agent-kit/issues/27)

## Context
Labels carry the agent workflow: `agent:ready`, `agent:working`, `needs:elia` (ADR 0007). They must be spelled the same in every repo. jamly has `.github/labels.yml`; agent-kit got the same labels by hand. Org-level labels are only defaults for new repos (ADR 0011), so they can't keep existing repos aligned.

Cloud sessions reach repo-scoped REST, but not GraphQL or org paths.

## Decision
- **One generic file, the kit's** `template/.github/labels.yml`. A repo adds its own file on top. A label with the same name in a later file replaces the earlier one whole.
- **One script**, `scripts/labels/sync-labels.js`, over `gh api` REST. `--check` exits 1 on drift.
- **Additive.** It creates and corrects labels. It never deletes one. A label on GitHub that is in no file is listed as *extra*.
- **The format stays the small YAML subset the kit already has**, parsed by the script, with no dependency. Anything outside the subset is an error.
- agent-kit gets its own `.github/labels.yml`, with the four type descriptions that say "the kit".

## Alternatives rejected
- **Delete what's not in the files** (a full mirror). GitHub's default labels, and any label a person adds, would vanish, along with their place on every issue. There is no undo.
- **A `--prune` flag.** The same risk behind one flag. Not needed yet: when a removal is decided, it is done once, by hand.
- **A YAML library or a marketplace Action.** The kit has no `package.json`, and the subset is small enough to parse strictly.
- **Merging fields across files** (a repo file overriding only a description). Harder to read: the whole label is in one place instead.

## Consequences
- Removing a label is a manual step. Today both repos still have `priority:now`, `priority:next` and `priority:later`, though ADR 0008 replaced them with the Priority field.
- A repo file must give a label's color even when it only changes the description.
- The sync job of ADR 0011 can run this script with `--check` and report drift.
