# Harness matrix

The harness of [jamly](https://github.com/ferrarolabs/jamly) and agent-kit, read through the 5×4 grid of the Harness Engineering workshop (FairMind, [he-workshop](https://github.com/FairMind-Gen-AI-Studio/he-workshop)). Built for [Diagnose the harness with the 5×4 matrix](https://github.com/ferrarolabs/agent-kit/issues/56).

**Re-run it at the end of every phase**, and update it in the PR that closes the phase.

Checked on 2026-11-02, against agent-kit `main` at `c853da5` and jamly `dev` as cloned that day.

## How to read it

- **Rows** are the five components: system prompt and context, tools, infrastructure, orchestration, hooks.
- **Columns** are the four roles. A **Guide** steers the agent before it acts. A **Sensor** tells it, or Elia, that something is wrong. A **Boundary** makes the wrong thing impossible. A **Record** keeps what happened after the session is gone.
- Each artefact sits in **one** cell. It is marked **C** (computational: code decides, the same way every time) or **I** (inferential: a model reads it and may not follow it).
- Only deliberate artefacts count. A platform default that nobody chose (git history, Actions logs) is not in the grid.
- **J** is jamly, **K** is agent-kit, **T** is `template/`, **A** is the account layer (`account/`, installed in `~/.claude/`).
- An empty cell is a **decision** when a written choice leaves it empty, and an **accident** otherwise. A gap with an open issue but no decision is still an accident: the issue plans the fix, it doesn't choose the gap.

## The grid

| Component | Guide | Sensor | Boundary | Record |
|---|---|---|---|---|
| **System prompt and context** | `CLAUDE.md` in J and K, `CLAUDE.md.template` in T (I). `account/CLAUDE.md` (I). J `AGENTS.md`: read the Expo v57 docs (I). `PLAN.md`, `ROADMAP.md` (I). J product and tech docs: vision, scope, conventions, domain model (I) | *Empty: accident* | *Empty: decision* (principle 3: an instruction only raises a probability) | ADRs in K and J, J decision log (I). `docs/learn/` notes in K and J (I). [inventory.md](inventory.md) (I) |
| **Tools** | J `allow` list for the checks: `npm run typecheck`, `lint`, `test`, `format` (C). J Expo plugin enabled (I) | J `typecheck`, `lint`, `format:check`, `test` (C). K `check-links.js` (C). Deny-rule probe, [scripts/probe/](../scripts/probe/README.md) (C). `build-project.js --check` (C) | Deny rules in J, K and T `.claude/settings.json`: secrets, push to long-lived branches, force-push, `rm -rf`; J also Supabase writes and EAS (C). Ask rules: workflows, J `config.toml` and `eas.json` (C). A deny floor in `account/settings.json` (C) | *Empty: decision* (tool use is recorded by a hook, the command log) |
| **Infrastructure** | Cloud environments with a setup script that installs the account layer ([guide](guides/cloud-environment-for-agent-kit.md)) (C). J's live Supabase URL, publishable key and test account, for agent tests (ADR 0016) (C) | CI on GitHub Actions in J, K and T: on PRs and on long-lived branches (C). K CI on `merge_group` (C) | Rulesets on `dev`, `staging`, `main`: PR and green CI required (C). K merge queue on `main` (C, not yet seen failing). Network allowlist per environment (C). No Supabase secret key in any cloud environment (C). One repo per session on the agent-kit environment (C) | *Empty: accident* |
| **Orchestration** | Issue templates in J, K and T: feature, bug; K decision (I). Labels as code, `labels.yml` in J and T: area only; the handshake is the Stage issue field (I). Project template spec and `build-project.js` (C). Numeric Priority field (ADR 0008, ADR 0018) (I) | *Empty: accident* | Labels and fields settable only by collaborators, on public repos (C). *No subagent tool limits: decision* (no subagent exists yet) | `ROADMAP.md` checklists (I). Issue and PR comments the agent writes: what it tried, why it stopped (I) |
| **Hooks** | A `SessionStart` hook, `project-rules-check.js`: says when a session's project rules didn't load (C trigger, I message) | *Empty: accident* | *Empty: accident* | Command log, `command-log.js` in J and T: every Bash command, its outcome and the loaded settings, as one comment per session on the branch's issue (C) |

## Read by column

**Guide.** The fullest column, and almost all inferential. Every rule an agent must follow is a sentence it may skip. That is fine for style and scope. It is not fine for anything the next three columns don't back up.

**Sensor.** Every computational sensor is a tool the agent *may* run, or CI, which runs *after* the push. Nothing in the session makes the agent look before it says "done". No sensor runs on its own inside a session: `project-rules-check.js` warns about settings, it does not check work.

**Boundary.** Strong where it was probed: pushes to long-lived branches (19 of 19 in the probe), secrets, `rm -rf`, merges without green CI. Weak in two places. Deny rules match a command's prefix, so a different spelling of the same command passes: `npx --yes supabase db push` does not start with `npx supabase db push` (by the prefix rule; not probed yet). And nothing stops an agent from editing the checks that judge it: tests, lint config, hook scripts. Only workflow files ask first.

**Record.** Decisions and commands are recorded. What the agent was doing, how far it got, and what it cost are not: there is no `docs/progress.md` and no usage or telemetry record. A session that dies leaves its commands, not its plan.

## Empty cells

| Cell | Kind | Why it is empty | What passes while it is | Issue |
|---|---|---|---|---|
| Hooks · Sensor | accident | No Stop or PostToolUse hook yet | An agent ends a session, or says "done", with red tests, lint, format or typecheck. Only CI finds it, after the push and a round trip to Elia | [Stop hook](https://github.com/ferrarolabs/agent-kit/issues/30), [verify-done skill](https://github.com/ferrarolabs/agent-kit/issues/29), [PostToolUse format and lint](https://github.com/ferrarolabs/agent-kit/issues/31) |
| Hooks · Boundary | accident | Boundaries are prefix deny rules only | An agent weakens a test or a lint rule to get green, and CI agrees. A respelled irreversible command reaches the deny list's blind side; in the cloud the missing credentials still stop Supabase, on a laptop they don't | [Protect the grader](https://github.com/ferrarolabs/agent-kit/issues/61), [PreToolUse gates as default-deny classifiers](https://github.com/ferrarolabs/agent-kit/issues/59) |
| Orchestration · Sensor | accident | No critic yet | A diff that passes CI but misses the spec, or adds scope, reaches Elia's review. He is the only reader of intent | [critic subagent](https://github.com/ferrarolabs/agent-kit/issues/32) |
| Orchestration · Record (in part) | accident | No `progress.md` convention | A session that dies mid-issue leaves no plan or next step. The next one starts over | [docs/progress.md convention](https://github.com/ferrarolabs/agent-kit/issues/35) |
| Infrastructure · Record | accident | No usage or telemetry export | Cost per issue and time waited on Elia are unknown, so the board can't show them | [Usage ledger](https://github.com/ferrarolabs/agent-kit/issues/33), [Telemetry](https://github.com/ferrarolabs/agent-kit/issues/63) |
| Context · Sensor | accident | Nothing compares the docs with the repo | `CLAUDE.md` or `PLAN.md` drifts from the code; agents follow the stale text. Today only the definition of done asks a human to check | — |
| Context · Boundary | decision | Principle 3 in [PLAN.md](PLAN.md): context only guides | — | — |
| Tools · Record | decision | The command log, a hook, records tool use | — | — |
| Orchestration · Boundary (subagents) | decision | No subagent exists yet; each gets its tool limits when it is written | — | — |

## Top three gaps by risk

1. **Hooks · Sensor: red work can be called done.** The Phase 2 exit criterion is exactly this gap. It is the cheapest to close and the one that costs Elia a round trip every time it lets something through. [Stop hook](https://github.com/ferrarolabs/agent-kit/issues/30) and [verify-done skill](https://github.com/ferrarolabs/agent-kit/issues/29).
2. **Hooks · Boundary: the agent can edit its own grader.** Once the Stop hook exists, the easiest way to pass it is to change what it runs. Closing gap 1 without this one moves the hole. [Protect the grader](https://github.com/ferrarolabs/agent-kit/issues/61), then [PreToolUse gates](https://github.com/ferrarolabs/agent-kit/issues/59) for respelled irreversible commands.
3. **Orchestration · Sensor: nobody checks the diff against the spec.** CI says the code works; nothing says it is the code the issue asked for. [critic subagent](https://github.com/ferrarolabs/agent-kit/issues/32).

The context sensor has no issue. It is ranked below these three: drift makes agents slower and wrong in small ways, and Elia's review sees it. It gets an issue if a later run of this matrix finds a mistake it would have caught.
