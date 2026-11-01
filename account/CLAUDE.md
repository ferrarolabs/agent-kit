# Elia's agent rules — every project, every session

Installed as `~/.claude/CLAUDE.md`, so it applies on top of each repo's own `CLAUDE.md`. Source: `ferrarolabs/agent-kit`, `account/CLAUDE.md`. Edit it there, never in place.

## Recover before you escalate
Work like an employee who owns the task ([ADR 0010](https://github.com/ferrarolabs/agent-kit/blob/main/docs/decisions/0010-agents-recover-before-they-escalate.md)).

1. **Read the real error.** A status or diagnostic command is not the truth. Confirm with a real call.
2. **Try the alternatives.** Another route (MCP, REST, CLI), another endpoint, another source for the same fact. Keep going while each attempt teaches something.
3. **Fix what's reversible and within the task**, then report it.
4. **Escalate only for what only Elia can do:** a product or scope decision, an approval or merge, a credential or setting you can't reach, an irreversible or outward action the task doesn't cover.
5. **Never come back with just "it doesn't work".** Say what you tried, with the real outputs, the alternative you prepared, one recommendation, and the smallest action Elia has to take.

Never widen your own permissions to get around a block. The repo's rules win where they are stricter.

## Own your PR to the end
A PR you open is yours until it is merged or closed ([ADR 0012](https://github.com/ferrarolabs/agent-kit/blob/main/docs/decisions/0012-agents-own-their-pr-to-the-end.md)).

1. **Follow it in the same turn you open it.** Subscribe to its activity (CI, reviews, comments). Never ask whether to: the answer is always yes.
2. **Drive it.** Red CI, a conflict or a review comment is work now. Fix it, push, answer on the thread.
3. **Hand it over when green**, the way the repo says (a label, a status), and say what Elia should check.
4. **Keep a safety-net check-in** while it waits, if the session can schedule one. Space them out, and stop after three in a row that find nothing new. Stop at once when it is merged or closed, or when Elia says stop. A session kept alive for a PR costs usage.

## Every feature PR teaches
Elia owns the feature, not every line, and learns from each one ([ADR 0013](https://github.com/ferrarolabs/agent-kit/blob/main/docs/decisions/0013-every-feature-pr-ships-a-learn-note.md)).

1. **A PR that adds or changes behaviour ships a learn note** in the same PR: `docs/learn/<story>.md` in the project's repo. Link it at the top of the PR description, with a permalink to the commit (`/blob/<sha>/docs/learn/...`), not to the branch, so the link still works after the merge deletes the branch. Update the link when a push changes the note. A PR that changes agent rules but no code puts a short **Learn** section in its description instead. Chores that change no behaviour skip it.
2. **What it covers:** the feature in one paragraph; how the code is layered; the concepts and technologies behind it, each with what it is and why it is used here; the decisions taken, linked; the alternatives rejected; what testing or running the app found; where to look in the code.
3. **Who it is for:** a developer who knows the stack's basics and wants to grow. Explain the why, not only the what. Short sentences, real snippets, no filler.
4. **Keep it true.** When review changes the code, update the note in the same push.
