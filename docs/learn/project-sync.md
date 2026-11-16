# The project sync

## The feature
Every board (the org template, agent-kit, Jamly) is kept in line with `scripts/projects/project-template.json` by a GitHub Action. It runs after every merge to `main` that touches the project scripts, and every night. If something needs Elia, one issue says so.

## How it is layered

```text
projects.json ──▶ sync-projects.js ──for each board──▶ build-project.js --sync ──GraphQL──▶ the board
                        │                                      │
                        │◀──────────── results (json) ─────────┘
                        ▼
                  results.json ──▶ report-sync.js ──REST──▶ "Project sync: action needed"
```

1. **The registry** lists the boards, by number.
2. **The driver** runs the same build script a person would run, once per board, and collects what it did.
3. **The build script, in sync mode**, compares the board with the spec and fixes what differs. It never deletes.
4. **The report** turns the results into one issue, or closes it.

## Concepts

**Desired state, or reconciliation.** The spec says how a board should look. The job reads the board, compares, and fixes the difference. Kubernetes and Terraform work this way. You declare the result, not the steps.

**Idempotence.** Running the job twice gives the same result as running it once. A second run finds nothing to fix. That is what makes it safe to run every night.

**Additive changes.** Adding is safe; deleting loses data. So the job only adds and fixes, and leaves deletions to a person. Database migrations follow the same rule ("expand, then contract").

**Identity by number, not by name.** A title can be renamed or duplicated. A number can't. Finding a board by number means a rename never makes the job create an empty copy.

**Quiet alerts.** A red run every night for a known problem trains you to ignore red. One issue that comments only when something changes, and closes itself, keeps the signal clear.

## Where to read the code
- `scripts/projects/sync-projects.js`: the driver.
- `scripts/projects/build-project.js`, search for `sync`: what sync mode skips.
- `scripts/projects/lib.js`: `registryError`, `extraViewsError`, `boardOutcome`, `reportLines`, `reportAction`. All pure, all tested in `sync.test.js`.
- [ADR 0027](../decisions/0027-the-sync-is-additive.md): the decision.
