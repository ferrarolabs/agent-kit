# 0001 · A separate kit repo, built on a real pilot

**Status:** accepted · 2026-10-30 · *when* extraction happens superseded by [ADR 0014](0014-kit-aligned-at-every-harness-merge.md)

## Context
I want an agentic system I can reuse across all my repos. Designing an abstract kit before using it almost always means redoing it: you don't yet know what's generic and what's project-specific.

## Decision
- The kit lives in this separate repo, which is the single source of truth.
- Components are built and proven on **jamly** first (phases 1–3), then extracted here (phase 4).
- Only what has worked on a real project goes into `template/`.

## Consequences
- `template/` stays empty at first; the repo's value is the plan.
- The early phases change jamly, not this repo; here we update the roadmap and the decisions.
