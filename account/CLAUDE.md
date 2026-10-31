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
4. **Keep a safety-net check-in** while it waits, if the session can schedule one. Stop when it is merged or closed, or when Elia says stop.
