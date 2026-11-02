# Labels as code

## The feature
Labels are how an agent and Elia talk: `agent:ready` says "you may start", `needs:elia` says "I'm stuck". If one repo spelled it `needs-elia`, an agent there would never see the signal. `scripts/labels/sync-labels.js` keeps every repo's labels in step with files: the kit's generic file, plus the repo's own file on top. `--check` says whether a repo has drifted, without touching it.

## How it is layered
Three layers, each testable alone:

1. **Parse.** `parseLabels(text)` turns the YAML subset into `{ name, color, description }` objects, or throws with `file:line`.
2. **Plan.** `layer(...lists)` stacks the files. `plan(desired, current)` compares them with GitHub and returns `{ create, update, extra }`. Pure functions: no file, no network.
3. **Act.** `githubClient()` wraps `gh api`. `run()` wires the three and picks the exit code.

The tests replace layer 3 with an in-memory repo:

```js
const gh = fakeGitHub(inStep().filter((l) => l.name !== 'agent:ready'));
run(['--repo', 'o/r', '--extra', 'repo.yml'], { client: gh, read, log: quiet });
assert.deepEqual(gh.calls, [['create', 'agent:ready']]);
```

That is dependency injection without a framework: `run` takes its client as a parameter, with the real one as the default.

## Concepts behind it
- **Idempotence.** Running twice does what running once does. The plan is computed from what is on GitHub now, so a second run finds nothing and makes no call. That makes it safe for a nightly job.
- **Declarative config.** The file says what should exist, not what to do. The script works out the steps. The same idea as Terraform, at a tiny scale.
- **Drift detection.** `--check` exits 1 on any difference, so CI or a scheduled job can turn red on it. Exit 2 is kept for another failure (bad file, API error), so "drifted" and "broken" are never confused.
- **Additive sync.** A mirror would delete what's not in the files. Here an extra label is only listed. Deleting a label removes it from every issue that has it, with no undo, so that stays a person's decision ([ADR 0022](../decisions/0022-labels-as-code-additive.md)).
- **Strict parsing of a subset.** The kit has no `package.json`, so no YAML library. The script accepts a small subset and rejects anything else with its line. A typo like `colour:` is an error, not a key silently ignored.
- **Case-insensitive names.** GitHub treats `Type:Bug` and `type:bug` as the same label. The plan does too, and fixes the case with `new_name` in a PATCH.

## Decisions
- [ADR 0022](../decisions/0022-labels-as-code-additive.md): one generic file with repo files on top, additive, no dependency.
- [ADR 0011](../decisions/0011-org-first-then-sync.md): org first, the rest synced from agent-kit. This script is the label part.

## Alternatives rejected
A full mirror, a `--prune` flag, a YAML library, a marketplace Action, field-by-field merging. Why: [ADR 0022](../decisions/0022-labels-as-code-additive.md#alternatives-rejected).

## What running it found
- Both repos were already in step: 0 changes on agent-kit and on jamly.
- agent-kit's type descriptions differ from the generic file ("the kit" instead of "a user"). Without its own file, `--check` reports 4 updates and exits 1. That is the check seen failing on real data, read-only.
- Both repos still have the `priority:*` labels that ADR 0008 replaced. The script lists them as extra and leaves them.

## Where to look
- [scripts/labels/sync-labels.js](../../scripts/labels/sync-labels.js): `plan()` is the heart.
- [scripts/labels/sync-labels.test.js](../../scripts/labels/sync-labels.test.js): the "deleted by hand comes back" test.
- [.github/labels.yml](../../.github/labels.yml): agent-kit's own layer.
