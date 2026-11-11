# A repo project as a copy of the template

## The feature
`build-project.js --from-template "Agent work"` creates a repo's GitHub Project by **copying** the org template, instead of building an empty one from the spec. Then it finishes the copy for the repo:
- it makes the copy private;
- it links the repo and adds its issues;
- it creates the repo's extra views;
- it runs the same comparison as `check`.

In the `projects.yml` workflow it is the `from_template` input.

## Why a copy
Some settings can only be made by hand in GitHub's UI: a view's group, sort and the board's column field, and the workflows. Built from the spec, every new repo project would need those clicks again. A copy brings them along. GitHub copies "views, custom fields, … configured workflows (except any auto-add workflows), and insights". So the clicks are made **once**, on the template, and every repo gets them.

Auto-add is the one exception: it is per repo, and copies never inherit it. The script prints it as the last manual step.

## How it is layered

```text
                 ┌─ no project with that title ─▶ copyProjectV2(template) ─┐
build-project.js ┤                                                         ├─▶ private ─▶ link repo ─▶ add issues
                 └─ project exists (not a template) ───────────────────────┘        ─▶ views: only what differs ─▶ diff
```

- **`lib.js`** holds what can be tested without GitHub:
  - `argError`: the guards on the command line;
  - `viewNeedsUpdate`: does a view differ from the spec?
  - `diff`: the comparison, now including group, sort and column field.
- **`build-project.js`** does the calls.

## Concepts

**Read what you can't write.** The API can't *set* a view's group, sort or column field, but it can *read* them (`groupByFields`, `sortByFields`, `verticalGroupByFields`). So the spec declares them, the owner sets them by hand on the template, and `check` compares them on every project. A manual setting becomes a checked one:

```json
{ "name": "Needs me", "groupBy": ["Stage"], "sortBy": [{ "field": "Priority", "direction": "DESC" }] }
```

**Change only what differs.** On a copied view, a blind update could reset what was set by hand. So `build` updates a view only when its layout, filter or fields differ from the spec. If an update ever does reset group or sort, `check` reads them back and turns red. The dry run proves it: a fake `gh` that resets on update makes `check` fail on that view.

**Private first.** A copy takes the template's visibility. The first write after the copy makes it private, before linking or adding anything, and a rerun does it again.

**Refuse the wrong target.** Projects are found by title, and GitHub's search is fuzzy. So:
- the script matches the exact title;
- it refuses a title equal to the template's;
- it refuses to touch any project marked as a template;
- it stops if two projects share a title.

**Idempotent.** A second run finds the project and doesn't copy again. Issues already in it are added again harmlessly.

## Decisions
- [ADR 0024](../decisions/0024-the-board-on-issue-fields.md): the board on issue fields.
- [The plan, refuted](https://github.com/ferrarolabs/agent-kit/issues/21#issuecomment-6796025104): copy rather than build, read group and sort back, private first.

## Alternatives rejected
- **Copy by hand with "Use this template".** One click, but every repo would have to be finished by hand. Elia chose the script.
- **Never update a copied view.** A filter changed by hand would never be repaired. Updating only what differs, and reading group and sort back, keeps both.
- **A fixed list of allowed repos in the workflow.** It would need a PR for every new repo. The repo name is already validated, and linking a repo that doesn't exist fails.

## What running it found
- Against a fake `gh` with a finished template:
  - the copy for agent-kit was made private first, then linked, then given its 2 issues (the PR was skipped);
  - a rerun didn't copy again;
  - a title equal to the template's was refused;
  - with updates that reset group and sort, `check` failed on the updated view.
- Live, in [Create the projects as copies](https://github.com/ferrarolabs/agent-kit/issues/22):
  - `check` on the template ([run 43023567604](https://github.com/ferrarolabs/agent-kit/actions/runs/43023567604)) was green on every line, including the group, sort and column field set by hand. `verticalGroupByFields` is indeed the board's column field.
  - The first copy for agent-kit ([run 43023650028](https://github.com/ferrarolabs/agent-kit/actions/runs/43023650028)) worked, and the copy was already private. Then **linking it to the repo was refused**: the project token has no permission on the repository. Linking only lists the project in the repo's Projects tab, so it is now a warning and a manual step, and the run goes on.
  - The first fix missed it: `gh` prints the GraphQL error on stdout and exits 1, so the reason is in the exception's `stdout`, not its `message`. A fake `gh` returning the same response caught it before the PR.
  - After the fix ([run 43026506767](https://github.com/ferrarolabs/agent-kit/actions/runs/43026506767)): the rerun found project 4 and didn't copy again, added 120 issues, and `check` was green. Jamly the same ([run 43027163053](https://github.com/ferrarolabs/agent-kit/actions/runs/43027163053), project 5).
  - **A project's search index lags.** The `check` right after adding counted 77 open issues out of 78; a second `check` a few minutes later counted 78. So a count right after a build is a lower bound, not a fact.
  - T9 passed: the exclusion filter kept exactly the issues in `Asking`, `In validation` and the one with no Stage.

## Where to look
- `scripts/projects/build-project.js`: the copy, private first, the view updates.
- `scripts/projects/lib.js` and `lib.test.js`: `argError`, `viewNeedsUpdate`, and the group/sort/column comparison.
- `scripts/projects/project-template.json`: `groupBy`, `sortBy` and `columnBy` per view.
- `.github/workflows/projects.yml`: the `from_template` input and its guard.
