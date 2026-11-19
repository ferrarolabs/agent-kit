# Writing issues

## The feature
Every issue in agent-kit is written by one procedure, the `writing-issues` skill. The skill:
1. works out what kind of work it is;
2. asks the questions that kind needs, to find the real need behind the request;
3. closes every gap an agent would otherwise guess;
4. writes the body from that type's template;
5. has a reader with no context check it.

Nobody calls it by name: it loads whenever an issue is written. When an agent opens an issue alone, it runs the same steps and parks what only the owner can answer.

## How it is layered

```text
.claude/skills/writing-issues/
├── SKILL.md             the procedure, seven steps: what to do, in order
├── reference.md         the questions per type, the writing rules, the cold reader's brief, the sources
└── templates/<type>.md  one body per type: the sections, in order, each with a hint
.claude/agents/cold-reader.md   the checker: reads only the body, Read is its only tool
docs/issue-structure.md         "The body of each type": the table the templates must match
scripts/check/issue-bodies.js   compares the two; its test runs in CI
```

- `SKILL.md` stays short. It is loaded into context whenever the skill triggers, so the detail lives in `reference.md`, read only when the interview starts. This is *progressive disclosure*.
- The templates are data, not prose. A test can read their `##` headings and compare them with the doc.

## Concepts

**The XY problem.** People ask about the solution they tried (X), not the problem they have (Y). So the skill restates the request and then asks what it is for. The Problem section names no solution, so the Goal can still be challenged.

**Past events, not hypotheticals** (*The Mom Test*). "Would you use this?" gets a polite yes. "When did this last happen, and what did you do?" gets a fact. Facts about the past predict need. Opinions about the future don't.

**The job story** (*Jobs to be Done*): *When [situation], I want [motivation], so I can [outcome]*. It anchors a feature in a situation rather than a persona, and it names no solution. If the owner corrects it when it is read back, the correction is the need.

**Given / When / Then** (Gherkin). One starting state, one action, one observable result. Two results make two requirements. With *Verified by*, each requirement says how it is tested before anyone writes code. That is what lets the e2e agent judge the result from the issue alone.

**Guess, then mark it.** Spec Kit's rule: when there is a reasonable default, take it and write it down as an assumption, rather than asking. Here, "enough" switches the skill to that mode, so the owner decides how long the interview lasts.

**The cold read.** The writer always knows what they meant, so a writer can't find their own ambiguity. A fresh agent that sees only the body can. The test on a seeded body:

```text
FR1 · Given the user is logged in · When they search · Then results appear fast
```

The cold reader flagged "fast" (no number, no percentile, server or browser?) and, in FR2, "an admin or the user" (the same details for both roles, or different?).

**A skill's description is its trigger.** Claude reads every skill's description at the start of a session and loads the body when a task matches. So the description says *when*: "whenever an issue is created, drafted, rewritten or split". A description can still fail to trigger, so `CLAUDE.md` states the same rule.

## Decisions
[ADR 0030](../decisions/0030-every-issue-is-written-with-one-procedure.md):
- one procedure for every issue;
- the type comes first;
- the real need comes before requirements;
- "enough" turns open points into assumptions;
- the cold reader has `Read` only;
- the skill lives in the repo, and agent-kit holds the original.

## Alternatives rejected
- **A skill on the claude.ai account.** It reaches only that account, not every contributor, and updates skip review.
- **A skill called by name.** Issues written without it would skip the procedure.
- **One body for every type.** Given / When / Then doesn't fit a Bug's steps or a Decision's options.
- **A cold reader with zero tools.** Claude Code refuses to start it.

## What testing found
- **A cold reader with zero tools won't start.** The harness refused `tools: TodoWrite` ("would be spawned with zero tools"), because that tool doesn't exist in this version. `Read` is the smallest tool that works.
- **A new agent file doesn't load into a running session.** The cold reader had to be tested in a fresh headless session (`claude -p`).
- **The cost.** The skill costs 231 input tokens on the first turn of every agent-kit session.
- **The template test fails when it should.** Renaming *Functional requirements* in the Feature template turned it red.

- **A cold reader with no bar is too strict to finish.** On the first real issue it wrote, [Copy the writing-issues skill to jamly](https://github.com/ferrarolabs/agent-kit/issues/185), it listed about 40 points. Most were already settled by `CLAUDE.md`. Giving it `CLAUDE.md` and a materiality bar cut that to the points that change the build. It still flagged both traps in the seeded body.

## Where to look
- `.claude/skills/writing-issues/SKILL.md`: the seven steps.
- `.claude/skills/writing-issues/reference.md` §1: the questions per type.
- `scripts/check/issue-bodies.test.js`: what keeps the templates and the doc equal.
