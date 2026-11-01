# Decisions

An ADR records **one significant decision**, the context that forced it, and the consequences accepted with it. The value is the reasoning: in six months, "why didn't we use X?" has a real cost if it isn't already answered here.

## When to write one
- It is expensive to reverse: a framework, a database, a data shape.
- It constrains what the product can become.
- A future reader would otherwise question it and re-litigate it.

Everything smaller goes in a decision log: one row per decision, with the why and where it lives.

## Rules
- Numbered in sequence: `NNNN-short-title.md`.
- Never edited once accepted. A changed decision is a new ADR that supersedes the old one; the old one's status line points to it.

## Format

```markdown
# NNNN · Title

**Status:** proposed | accepted | superseded by NNNN · YYYY-MM-DD

## Context
The forces at play. What makes this a decision rather than an obvious choice.

## Decision
What we do.

## Consequences
What we accept along with it, good and bad.
```
