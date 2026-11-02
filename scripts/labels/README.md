# Labels as code

GitHub labels for every repo, kept in step with files. The agent handshake (`agent:ready`, `agent:working`, `needs:elia`) only works if every repo spells the labels the same.

```bash
node scripts/labels/sync-labels.js --repo ferrarolabs/agent-kit --extra .github/labels.yml --check
node scripts/labels/sync-labels.js --repo ferrarolabs/jamly --extra ../jamly/.github/labels.yml --check
```

Run it from an agent-kit checkout. It needs `gh`, signed in, with access to the repo.

## The files
- **The kit's generic file** always comes first: [template/.github/labels.yml](../../template/.github/labels.yml). Type, agent state, `needs:elia`, `area:harness`.
- **`--extra <file>`** layers a repo's own file on top. Repeat it for more files; later ones win. A label with the same name (case-insensitive, as on GitHub) replaces the earlier one whole, so the repo's file gives the color too.
- **The format** is the small YAML the kit already uses: a list, one key per line, keys `name`, `color` (6 hex digits) and `description` (100 characters at most). Anything else is an error with its file and line, not a guess.

## Modes

| Mode | Writes | Exit |
|---|---|---|
| (none) | Creates missing labels; corrects color, description and name case | 0, or 2 on error |
| `--check` | Nothing | 1 when anything would change |
| `--dry-run` | Nothing | 0 |

Every run prints one line per change and per **extra**: a label on GitHub that is in no file.

## Additive: it never deletes
An extra is listed and left alone. Deleting a label takes it off every issue and PR that has it, and there is no undo. So a deletion is a person's decision, made by hand ([ADR 0022](../../docs/decisions/0022-labels-as-code-additive.md)).

## How it talks to GitHub
`gh api repos/<owner>/<name>/labels`, over REST. Cloud sessions can't reach GraphQL or org paths, but repo-scoped REST passes the proxy.

## Proven
- 2026-11-02, read-only: `--check` on agent-kit (with its `.github/labels.yml`) and on jamly (with its `dev` file): 0 to change, exit 0 on both.
- Seen failing, read-only: `--check` on agent-kit **without** its own file reports 4 description updates and exits 1. A missing file exits 2.
- The tests ([sync-labels.test.js](sync-labels.test.js)) run against an in-memory repo: a label deleted by hand is restored by the next run, a second run makes no call, and an extra survives an apply.
