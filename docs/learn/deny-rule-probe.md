# Learn — the deny-rule probe

> What [Probe for deny rules as a reusable Sensor](https://github.com/ferrarolabs/agent-kit/issues/2) built, why it is shaped this way, and what it found. Usage is in [scripts/probe/README.md](../../scripts/probe/README.md).

## The feature in one paragraph

`probe-deny-rules.js` takes a repo and a list of commands, each marked "must be denied" or "must be allowed". For each one it starts a real, headless Claude Code session in a throwaway clone of the repo, asks it to run the command, and reads from Claude Code's own event stream whether the command was denied. It prints PASS or FAIL per case and exits 1 if any case is wrong.

## How the code is layered

```
main()                         args → clone → run every case → table → exit code
├─ prepareClone()              temp clone; origin = a local bare repo; settings copied from disk
├─ pool()                      runs N cases at a time (default 4)
│  └─ runCase()                spawns `claude -p … --output-format stream-json`
│     └─ verdictFromStream()   pure: stream lines → deny | allow | not attempted
└─ push-to-protected-branches.json   the cases: data, not code
```

`verdictFromStream` holds the logic, so it holds the tests (`node --test`). Everything else is plumbing, proven by running it.

## Concepts worth knowing

### 1. Guardrail vs boundary, and why a guardrail needs a sensor
A deny rule matches **command text**. Branch protection on GitHub refuses the push **whatever** the text was. The rule is a guardrail; the ruleset is the boundary. Guardrails fail silently when someone writes the command a new way. The probe is the sensor that notices.

### 2. Make the test unable to lie
Three choices remove every way a case could pass without the rule doing its job:
- every Bash command is **allowed** on the command line, and only **project** settings are read: if the command is blocked, a deny rule blocked it;
- the verdict comes from `permission_denials` in the event stream, **not** from what the model says;
- a case the model **didn't attempt** fails. No evidence is not a pass.

### 3. Make a failure harmless
The clone's `origin` is a local bare repo. So when a rule fails, the push really happens, but into a folder in `/tmp`. You can test "is this push denied?" without risking the push.

### 4. Controls
`feat/0-domain` contains `main`; `feat/0-dev-tools` contains `dev`. They must stay allowed. A rule that blocks them over-blocks, and agents would stop being able to push their own branches.

## What running it found
- **A real gap on jamly:** `git push --force-with-lease …` is allowed. The rule `Bash(git push --force *)` matches `--force` followed by a space, and `--force-with-lease` has none. Three more cases went in for flags at the end; on `dev`'s rules 3 of 4 force-pushes passed. Fixed in [Deny every spelling of a force-push](https://github.com/ferrarolabs/jamly/pull/33): 19 of 19.
- **Seen failing on purpose:** with `Bash(git push *:dev)` removed from a copy of jamly's rules, `git push origin HEAD:dev` came out `allow`, exit 1.
- The unit tests were seen failing too: with denials ignored, 2 of 5 go red.

## Alternatives rejected
- **Parse the rules and simulate the matcher.** Faster and free, but it tests our idea of how Claude Code matches, not Claude Code. The probe asks the real thing.
- **One session for all cases.** Cheaper, but the original run saw the model refuse some commands on its own in a long list.

## Where to look
- `scripts/probe/probe-deny-rules.js`, top comment first.
- `scripts/probe/push-to-protected-branches.json` for the cases.
