# 0021 · Model by kind of work, always by full id

**Status:** accepted · 2026-11-02 · from [Model policy: which model for which work, by full id](https://github.com/ferrarolabs/agent-kit/issues/28)

## Context
Sessions, subagents and scheduled tasks each pick a model. Without a rule, every agent picks its own: costly models do trivial work, cheap ones guess on hard work.

Aliases drift. On 2026-10-30, CLI 2.1.190 resolved the alias `sonnet` to Sonnet 4.6, an older model than the one meant. The same definition can run a different model on two machines.

## Decision
- **Haiku** (`claude-haiku-5-5`) for atomic, defined work with no interpretation.
- **Sonnet** (`claude-sonnet-5-5`) for complex but defined work.
- **Opus** (`claude-opus-5-5`) for coordination, reasoning and planning.
- **Always the full id**, never an alias: in the main session, in subagents' `model:` frontmatter, in Agent tool overrides, in scheduled tasks.
- The policy lives in [guides/model-policy.md](../guides/model-policy.md). Projects link to it from their `CLAUDE.md`.

## Consequences
- A new model family means one PR that updates the ids in the guide and in every definition that names one.
- The kit has no subagent definitions yet, so nothing changes today. Each one added in Phase 2 names a full id.
- Nothing enforces this yet. A check that fails on a bare alias in `.claude/agents/` can come with the first subagent.
