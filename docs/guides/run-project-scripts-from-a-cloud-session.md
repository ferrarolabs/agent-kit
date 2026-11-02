# Run the project scripts from a cloud session

`scripts/projects/build-project.js` talks to GraphQL. A cloud session can't: the proxy blocks GraphQL and org paths, whatever the token. It can start a workflow and read its run. So the script runs in the [Projects workflow](../../.github/workflows/projects.yml), with the `PROJECT_TOKEN` secret ([Project scripts run in an Action](https://github.com/ferrarolabs/agent-kit/issues/83)).

## Inputs

| Input | Values | Means |
|---|---|---|
| `mode` | `check` (default), `build` | `check` changes nothing and exits 1 on drift. `build` creates what is missing |
| `title` | e.g. `Agent work`, `Jamly` | The project's title. Letters, digits, spaces, `.`, `-`, `_` |
| `repo` | e.g. `jamly`; empty | The repo in `ferrarolabs` the project belongs to. Empty means the org template (`--template`) |
| `extra` | `true`, `false` | Also apply the repo's `.github/project-extra-views.json` |

The workflow refuses anything else before it runs the script.

## Start a run

With the GitHub MCP tool:

```text
actions_run_trigger  method=run_workflow  owner=ferrarolabs  repo=agent-kit
                     workflow_id=projects.yml  ref=main
                     inputs={"mode": "check", "title": "Agent work"}
```

Or over REST:

```bash
gh api -X POST repos/ferrarolabs/agent-kit/actions/workflows/projects.yml/dispatches \
  -f ref=main -f 'inputs[mode]=check' -f 'inputs[title]=Agent work'
```

The call returns nothing on success (HTTP 204). Use `ref=main` unless you are testing a change to the workflow on a branch.

## Read the run

1. `actions_list  method=list_workflow_runs  resource_id=projects.yml` and take the newest run. Wait for `status: completed`.
2. `conclusion: success` means the project matches the template (`check`) or was built (`build`).
3. For the output, `actions_list  method=list_workflow_jobs  resource_id=<run id>`, then `get_job_logs  job_id=<job id>  return_content=true`. Each line of the script is `ok` or `FAIL`. The same output is in the run's summary page.

## When it fails

- **`The PROJECT_TOKEN secret is empty or missing`**: the secret isn't set. Only Elia can add it: an agent can't read or set secrets.
- **`N difference(s) from the template`**: real drift. The `FAIL` lines say what differs.
- **A GraphQL error**: usually the token lacks Projects read/write on the org.
