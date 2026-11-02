# Project scripts in an Action

## The feature
`build-project.js` builds and checks the org's GitHub Projects. It needs GraphQL, and a cloud session can't reach GraphQL. So the script now also runs in a GitHub Actions workflow, `projects.yml`, started by hand with `workflow_dispatch`. A cloud session starts it through the REST API, which the proxy lets through, and reads the result from the run's log. The work moves to a machine that can do it; the session only presses the button and reads the answer.

## How it is layered

```text
cloud session ──dispatch (REST)──▶ projects.yml ──GraphQL, PROJECT_TOKEN──▶ GitHub Projects
      ▲                                  │
      └────────── run log, summary ──────┘
```

1. **Inputs** (`mode`, `title`, `repo`, `extra`) are the only thing the session controls.
2. **The validation step** checks the token is there and every input has the expected shape.
3. **The run step** builds the argument list and calls the same script a person would run on a laptop.

## Concepts

**`workflow_dispatch`.** A trigger that runs a workflow on request, with typed inputs. Here it is the bridge across the proxy: dispatching is a REST call on a repo path, so it is allowed.

**Secrets live in Actions, not in the session.** `PROJECT_TOKEN` is read only inside the job, as `${{ secrets.PROJECT_TOKEN }}`. The session never sees it, and can't set it: the proxy blocks the secrets API. That is why adding it is Elia's step.

**Script injection.** `${{ inputs.title }}` written inside a `run:` script is pasted into the shell text before bash reads it. A title like `x"; curl evil #` would then run `curl`. So inputs go in as environment variables and the script reads `"$TITLE"`: bash treats it as data, never as code.

```yaml
env:
  TITLE: ${{ inputs.title }}
run: |
  set -- --owner ferrarolabs --title "$TITLE"
```

`set --` builds the argument list as an array, so a title with spaces stays one argument.

**Allowlist validation.** Even as data, a strange title or repo name is a sign of a mistake or an attack. The inputs must match a narrow pattern, and a repo name can't start with a dot, so `..` can't walk up the API path. The workflow fails with a readable `::error::` line before the script runs.

**`concurrency`.** Two `build` runs on the same project would race on its views. The `projects` group queues them one after the other.

**Least privilege.** `permissions: contents: read`: the job's own `GITHUB_TOKEN` can only read the repo. Everything else is done with `PROJECT_TOKEN`, which only has what the projects need.

## Decisions
- **One workflow, all modes.** The Status Action ([ADR 0007](../decisions/0007-project-boards.md)) and the reconciler will share the token, but not this workflow: they run on events and on a schedule.
- **`extra` fetched from the target repo.** jamly's extra views live in jamly. The workflow reads `.github/project-extra-views.json` from the repo through the API, so agent-kit needn't hold a copy.

## Alternatives rejected
- **A token in the cloud environment, and the script in the session.** The token is there already, but the proxy blocks GraphQL regardless of the token.
- **`repository_dispatch`.** It works too, but has no typed inputs and no form in the UI, so Elia couldn't start a run by hand as easily.

## What testing found
- The validation step was run locally against 11 inputs, good and hostile: a missing token, an unknown mode, a title with `"; curl`, a title with `$(id)`, repo names `../x`, `jamly/../../x` and `..`, and `extra` with no repo. All were refused, and the good ones passed. The first version accepted `..` as a repo name; the pattern was tightened.
- The live run can't happen before the merge: a dispatched workflow must exist on the default branch, and the secret isn't set yet.

## Where to look
- [.github/workflows/projects.yml](../../.github/workflows/projects.yml)
- [The guide](../guides/run-project-scripts-from-a-cloud-session.md)
- [scripts/projects/build-project.js](../../scripts/projects/build-project.js)
