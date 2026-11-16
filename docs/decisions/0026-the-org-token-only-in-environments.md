# 0026 · The org token lives only in environments: `main` free, branches approved

**Status:** accepted · 2026-11-16 · from [Keep PROJECT_TOKEN away from branch code](https://github.com/ferrarolabs/agent-kit/issues/173), part of [Project sync](https://github.com/ferrarolabs/agent-kit/issues/66)

## Context
`PROJECT_TOKEN` was a repository secret. Any workflow run could read it, whatever branch its code came from. An agent can push a branch, change `projects.yml` on it, and run that code with the org token. With Issues write on the token, that code could set Stage `Ready`. The [board design §6](../project-boards.md#6-status-the-job-and-the-token) promises that no job holding the token does that. The promise held only for reviewed code on `main`.

Branch runs are still needed. An agent must test a change to the project scripts on the real boards before its PR.

## Decision
- **Two environments in agent-kit**, both holding `PROJECT_TOKEN`:
  - `projects`: deployment branches limited to `main`. No approval, so the nightly and on-merge runs need no click.
  - `projects-branch`: any branch, with Elia as required reviewer. A branch run waits until he approves it.
- `projects.yml` picks the environment from the ref: `main` gets `projects`, anything else gets `projects-branch`.
- **No repository secret.** The old one is deleted after the switch.
- The token is a new one, made only for the Actions (`projects-actions`). No cloud session holds it.

## Consequences
- Code on a branch can't get the token without Elia's click. Changing the environment name on a branch doesn't help: `projects` refuses any branch but `main`. Proven on 2026-11-16: a branch run asking for `projects` was refused before a runner started.
- Testing a branch costs Elia one approval per run. An agent batches its live checks to keep that low.
- Until `projects-branch` holds the secret, a branch run fails at the token check with a clear message.
