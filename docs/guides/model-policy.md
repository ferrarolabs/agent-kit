# Model policy: which model for which work

Pick the model by the kind of work, and always name it by its **full id** ([ADR 0021](../decisions/0021-model-policy-by-full-id.md)).

## The policy

| Work | Model | Full id |
|---|---|---|
| Atomic and fully defined, no interpretation: rename, move, apply a given list, run a check and report | Haiku | `claude-haiku-5-5` |
| Complex but defined: implement an issue with clear acceptance criteria, port a proven piece, write tests for a spec | Sonnet | `claude-sonnet-5-5` |
| Coordination, reasoning, planning: triage, plans, architecture, review, debugging an unknown failure, orchestrating other agents | Opus | `claude-opus-5-5` |

When in doubt, go one level up. A cheap model that guesses costs more than an expensive one that doesn't.

## Always the full id, never an alias

Aliases such as `sonnet` or `opus` are resolved by the CLI, and the answer changes with the CLI version. On 2026-10-30, CLI 2.1.190 resolved `sonnet` to Sonnet 4.6, not the latest Sonnet. A full id means the same model on every machine and in every session.

When a new model family ships, update the ids in this guide and in every place listed below, in one PR.

## Where it applies

- **Main session:** start it with the full id (`claude --model claude-opus-5-5`, or the model picker in the app). Coordination work runs here, so it is usually Opus.
- **Subagents:** the `model:` field in `.claude/agents/<role>.md` frontmatter names a full id. The kit has no subagent definitions yet; every one added must follow this rule.
- **Agent tool calls:** when an orchestrating session starts a worker with a `model` override, it follows the table above. A fork always runs on the parent's model.
- **Scheduled tasks and sessions started by an agent:** pass the full id as the model.

## How to check

`grep -rn "^model:" .claude/agents/ template/.claude/agents/` lists every subagent's model. Each value must be a full id such as `claude-sonnet-5-5`, never a bare alias.
