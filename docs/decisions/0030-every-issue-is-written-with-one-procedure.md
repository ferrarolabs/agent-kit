# 0030 · Every issue is written with one procedure, the writing-issues skill

**Status:** accepted · 2026-11-19 · from [Spec skill: turn an idea into a complete issue](https://github.com/ferrarolabs/agent-kit/issues/151). Amends [ADR 0023](0023-the-work-flow-from-an-idea-to-a-pr.md) (step 1 of the flow) and PLAN §3 (where "writing specs" lives).

## Context
An issue is all the implementing agent reads. Two things go wrong:
- **It describes a solution, not the need.** The owner asks for what they have in mind, and the agent builds it well, even when the real need was different or smaller.
- **It leaves room to guess.** A word like "fast", or "the user" when there are two roles, becomes a choice the agent makes alone.

ADR 0023 decided an interview, a body and a cold read, called by the owner. It left open where the skill lives ([Decide: which skills live at account level vs in the kit](https://github.com/ferrarolabs/agent-kit/issues/14)) and had a single body for every type.

## Decision
- **One procedure for every issue, never called by name.** The skill is `writing-issues`. Its description makes it load whenever an issue is created, rewritten or split, by the owner or by an agent. "Working as an agent" in `CLAUDE.md` makes it a rule too, because a description can fail to trigger.
- **The type comes first**: Feature, Bug, Task, Epic or Decision, by the tree in [issue structure §2](../issue-structure.md#2-issue-types). Each type has its own real-need questions and its own body ([the body of each type](../issue-structure.md#the-body-of-each-type)). These bodies are designed here, so [Define the issue body for each issue type](https://github.com/ferrarolabs/agent-kit/issues/147) keeps only the issue forms.
- **Find the real need before writing a requirement.** Separate the solution asked for from the problem behind it (the XY problem). Ask about past events, not hypotheticals (*The Mom Test*). Ask why until the problem is one the project owns. Write the job story (*Jobs to be Done*). Ask the kill question. Propose a reframe when the evidence points elsewhere; the owner chooses, and a rejected one is recorded in Out of scope. These questions are free text. Small, atomic work skips them, except a Decision.
- **Then close every gap**: one multiple-choice question at a time, the recommendation first. **"Enough" ends the interview.** Every point still open is settled by the recommendation and marked as an assumption, which the owner confirms in one message. This follows Spec Kit: guess by default, record the guess, ask only what matters.
- **A cold reader checks the body.** The `cold-reader` agent gets only the body, plus the project's `CLAUDE.md` as standing rules, because the implementer has those too. It reports only **material** findings: what would change what is built, or whether it passes. Without that bar, its first real run listed 40 points, most of them settled by `CLAUDE.md` (branch names, Stage). It runs on `claude-opus-5-5` ([model policy](../guides/model-policy.md)), with `Read` as its only tool. Claude Code refuses to start an agent with zero tools. `Read` has no shell, no network and no MCP, so injected text in a body has no way out. At most two rounds.
- **Alone, the same procedure, with questions parked.** An agent opening an issue with nobody to answer settles what the repo answers. It writes the rest as **Open questions**, each with a recommended answer. The interview resumes from them when the owner next works on the issue.
- **One OK covers every write; Stage is always `Inbox`.** The draft is saved as soon as the problem is agreed, so a dead session loses nothing.
- **Where it lives: in the repo, so it travels with the code.** The skill is `.claude/skills/writing-issues/`, plus `.claude/agents/cold-reader.md`. Anyone who opens a session on the repo has it, cloud or local, on any Claude plan. agent-kit holds the **original**. It is built here because agent-kit writes issues every day, so this is the real project that proves it (ADR 0001). Other repos get a copy: jamly by PR first, then `template/.claude/skills/` once jamly has used it, then every repo through the sync job ([ADR 0011](0011-org-first-then-sync.md)). This reverses [ADR 0014](0014-kit-aligned-at-every-harness-merge.md)'s direction for this one piece; [inventory.md](../inventory.md) records it.

## Alternatives rejected
- **A skill on the claude.ai account**, as PLAN §3 had it. It reaches only that account, or that claude.ai organization on a Team or Enterprise plan, and not every contributor to the repos. Anthropic's docs don't say whether organization skills load in cloud sessions. Each update is a manual upload, outside review.
- **Install it with `account/install.sh`.** It reaches only environments whose setup script runs the installer. Its download path fetches files one by one, so every skill file would need a manifest.
- **A skill called by name (`/write-spec`).** Issues opened without it would skip the procedure. Agents open issues too.
- **One body for every type.** A Bug needs steps and expected behaviour; a Decision needs options. One table forced Given / When / Then onto both.
- **A cold reader with no tools at all.** Claude Code refuses it ("would be spawned with zero tools"), as seen on 2026-11-19.

## Consequences
- Every session on agent-kit lists one more skill: 231 more input tokens on the first turn (35,333 → 35,564, [tools.md](../tools.md)).
- Issues take longer to write and less time to build: the questions move from the plan and the PR to the issue.
- The skill's sections and `docs/issue-structure.md` can't drift: `scripts/check/issue-bodies.test.js` compares them in CI. It was seen failing on a renamed heading.
- [Decide: which skills live at account level vs in the kit](https://github.com/ferrarolabs/agent-kit/issues/14) gets its first answer for this one skill: a method that must reach whoever works on a repo lives in the repo.
- The jamly copy is its own issue, opened from this one.
