# The project template on issue fields

## The feature
The org's project template, *Agent work*, is the mould every repo's GitHub Project is copied from. Its spec, `scripts/projects/project-template.json`, now follows the [board design](../project-boards.md) of [ADR 0024](../decisions/0024-the-board-on-issue-fields.md):
- Status takes Stage's six values;
- the issue fields are on the project;
- there are five views on issue fields;
- the project is private.

`build-project.js` builds and checks the project from that spec. It now also catches what shouldn't be there, and can remove it from the template once.

## How it is layered

```text
project-template.json ──▶ build-project.js ──GraphQL──▶ the live project
   (the spec)               │ reads live state
                            ▼
                         lib.js: diff(spec, live) → ok / FAIL lines   ◀── lib.test.js
```

1. **The spec** says what the project must be.
2. **`lib.js`** compares it with the live project. It is pure: plain data in, a list of `ok`/`FAIL` out, no network.
3. **`build-project.js`** reads the live project, changes it on `build`, then runs the same comparison, so every build ends with its own check.
4. **`projects.yml`** runs the script with the org token. A cloud session starts it ([Project scripts in an Action](project-scripts-action.md)).

## Concepts

**A pure core for what can go wrong.** The part with the real logic, *what counts as a difference*, has no network in it. So `node:test` can hand it a project that matches the spec, break one thing, and check that the break is reported:

```js
test('an extra view is reported, and pruned', () => {
  const live = matching();
  live.views.push({ name: 'Milestone', layout: 'TABLE_LAYOUT', filter: '-status:Done', fields: [] });
  assert.match(fails(live).join('\n'), /view "Milestone" is not in the spec/);
});
```

There is one such test per kind of failure: an extra view, an extra field, a public project, Status out of order, a wrong colour, filter or field, a missing view or issue field. That is the kit's rule that a check comes with proof it can fail.

**Additive by default, prune once.** `build` creates and updates; it never deletes, unless `--prune` is given. `--prune` works only on the template, and only with `build`, for one reason: deleting a field deletes its values on every item. Repo projects hold real items, and syncing them is additive by rule ([Project sync](https://github.com/ferrarolabs/agent-kit/issues/66)). The template holds none, so cleaning it once is safe.

**A guard as a test.** The token the script runs with can write the org's projects. ADR 0024 says no job holding it writes `Ready`. The script now writes no field value on any item at all: Status belongs to the reconciler. A test fails if any project script contains an item-field write:

```js
assert.doesNotMatch(src, /updateProjectV2ItemFieldValue|clearProjectV2ItemFieldValue|issue-field-values/);
```

It is a text check, not a proof. But it turns "someone added an item write" from a silent change into a red CI run that a reviewer has to look at.

**A spec tied to its source.** Status must equal Stage's values. The test reads them from `docs/issue-structure.md`, not from a copy, so changing one side alone fails CI.

**What the API can't see.** Group, sort, column field, column limits, workflows and access can't be set or read through the API. Each run ends with a `MANUAL, NOT CHECKED` list, so a green run is never read as "the board is done".

## Decisions
- [ADR 0024](../decisions/0024-the-board-on-issue-fields.md): the board on issue fields.
- [The plan, refuted](https://github.com/ferrarolabs/agent-kit/issues/20#issuecomment-6780157136), and [its verdict](https://github.com/ferrarolabs/agent-kit/issues/20#issuecomment-6780533057): the template is built from `main` after the merge, never from the branch, so no unreviewed code runs with the token.

## Alternatives rejected
- **Build from the PR branch before merging.** It would run unreviewed code with the org token.
- **A `probe` mode with throwaway issues to test the filters.** That means more token power and noise in a public repo. The filters are tested on the first repo project instead, on real issues.
- **Deletions in the spec (`removeViews`).** Project sync would read them and delete on repo projects.
- **Setting each item's Status from Stage in the script.** It would be a second writer next to the reconciler, and it could write `Ready`.

## What running it found
- Against a fake `gh` seeded like today's template:
  - `check` reported 19 differences: public, the Status options, three missing issue fields, three extra fields, every view, and two extra views.
  - `build --prune` made exactly the expected 11 changes, with no item write.
  - `check` was then green.
- The live run happens from `main` after the merge, and its log is on the issue.

## Where to look
- `scripts/projects/project-template.json`: the spec.
- `scripts/projects/lib.js` and `lib.test.js`: the comparison and its failure cases.
- `scripts/projects/project-template.test.js`: the spec's own rules (Stage values, no item writes, no label filters, issues only, private).
- `scripts/projects/build-project.js`: build, prune, check.
- `.github/workflows/projects.yml`: the `prune` input and its guard.
