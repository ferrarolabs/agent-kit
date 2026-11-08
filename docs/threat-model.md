# Threat model: the lethal trifecta

An agent session is dangerous where three legs meet ([Threat model for agent sessions](https://github.com/ferrarolabs/agent-kit/issues/58), from the Harness Engineering workshop, module 5):

1. **Private data:** something the session can read that a stranger shouldn't.
2. **Untrusted content:** text a stranger wrote that reaches the model.
3. **A way out:** a channel the session can use to send data where a stranger can read it.

With all three, one injected sentence in an issue can make an agent read a secret and post it. Cut one leg and the attack has nowhere to go. This file lists, for each kind of session, which legs it has and what cuts them.

**Update it** when an environment, a credential or a network rule changes, and at the end of every phase.

Checked on 2026-11-02, against agent-kit `main` at `c853da5` and jamly's `.claude/settings.json` on the same day.

## The sessions

| Session | Where | Rules loaded |
|---|---|---|
| **Cloud, agent-kit** | The `agent-kit` environment ([guide](guides/cloud-environment-for-agent-kit.md)), one repo | agent-kit's `.claude/settings.json` + the account floor |
| **Cloud, jamly** | The shared Ferrarolabs Dev Environment, jamly only | jamly's `.claude/settings.json` + the account floor |
| **Cloud, two repos** | The shared environment, jamly and agent-kit, started above both | The account floor only ([ADR 0017](decisions/0017-account-deny-floor.md)) |
| **Local** | Elia's laptop, native Windows, rare ([ADR 0019](decisions/0019-laptop-sandbox-floor-deferred.md)) | The repo's settings + the account floor, no sandbox |

## The legs, per session

| Session | Private data | Untrusted content | A way out | Trifecta? |
|---|---|---|---|---|
| Cloud, agent-kit | GitHub write access to the session's repos | Yes | GitHub only | **Yes**, through GitHub |
| Cloud, jamly | GitHub write access; the Supabase test account | Yes | GitHub; any `*.supabase.co` host | **Yes** |
| Cloud, two repos | Same as cloud, jamly | Yes | Same as cloud, jamly | **Yes**, with fewer denies |
| Local | Whatever the laptop holds outside `.env` | Yes | Unrestricted network | **Yes**, accepted |

No session cuts a leg completely. What keeps the risk low today is that the private data is worth little: no secret Supabase key anywhere in the cloud, no real users, and the repos are already public.

## Leg 1: private data

### Cloud data
- **No Supabase secret, ever.** No service-role key, no database password, no CLI token ([ADR 0016](decisions/0016-cloud-sessions-test-against-the-live-backend-until-real-users.md), jamly D42). The agent can't write the schema, and a stolen value can't either.
- **The jamly environment holds the project URL, the publishable key and one test account** (ADR 0016). The URL and key are public: they ship in every app build. The test account sees only what row-level security lets any user see. No real users exist yet, so it reaches only test data. **Accepted risk** until the first real user, when agent tests move to a separate project: [Before the first real user: move agent tests to a separate Supabase project](https://github.com/ferrarolabs/jamly/issues/25).
- **The agent-kit environment holds no variables or secrets** ([guide](guides/cloud-environment-for-agent-kit.md)). It doesn't allow `*.supabase.co` either.
- **GitHub access is scoped.** The session reaches only its configured repos, and GraphQL is refused. Seen on 2026-11-02: `gh api orgs/ferrarolabs/projectsV2` and `gh api graphql` both returned 403 ("sessions are bound to their configured repositories"; "GitHub GraphQL is not available"). Within those repos the session can push branches, open PRs and comment, as Elia. Protected branches are cut off by the rulesets and the deny rules. **Accepted risk**, narrowed later by [Agents act on GitHub as a bot account, not as Elia](https://github.com/ferrarolabs/agent-kit/issues/113).
- **`.env` is unreadable** to the Read tool, by the deny floor and by each project's settings.

### Local data
- Local commands can read credentials outside `.env`: SSH keys, the `gh` token, any CLI login ([ADR 0019](decisions/0019-laptop-sandbox-floor-deferred.md)). **Accepted risk** while local work is rare. The designed fix is [Laptop sandbox floor, once local sessions become regular work](https://github.com/ferrarolabs/agent-kit/issues/120).

## Leg 2: untrusted content

This leg can't be cut. Both repos are public ([ADR 0005](decisions/0005-public-under-mit.md), jamly D47), so anyone can open an issue or comment on one. Other sources: web pages the agent fetches, and npm packages (jamly's setup runs `npm ci`).

What narrows it:
- **Only collaborators can set Stage.** On GitHub, setting an issue field needs triage access or more, as adding a label does ([issue fields, community discussion](https://github.com/orgs/community/discussions/175366)). An agent starts only on Stage `Ready`, or on an issue Elia names in the session, and never sets `Ready` itself. A stranger can't put work in front of an agent. Caveat: every agent acts as Elia's account today, so the field's history can't tell Elia from an agent ([bot account](https://github.com/ferrarolabs/agent-kit/issues/113)).
- **No agent starts on its own yet.** Every session is started by Elia. When [An agent starts on its own](https://github.com/ferrarolabs/agent-kit/issues/76) is built, the trigger must check who set Stage `Ready`.
- **The project can't set `Ready` for someone else.** The board's columns are Stage, and a drag writes it ([ADR 0024](decisions/0024-the-board-on-issue-fields.md)). The project is private, with Elia as its only admin, so a stranger can't drag a card. The project token, held only by Actions, never writes `Ready` to Stage or Status: the reconciler only copies values the owner set, and sets `Done` on close.
- **The agent treats fetched text as data, not instructions.** That is a rule in the session's own prompt, so it's a promise, not a boundary.

What doesn't: a stranger's comment on a `Ready` issue is still read by the agent. Accepted, because the other two legs are kept thin.

## Leg 3: a way out

### Cloud exits
- **The network is limited.** Outbound HTTPS goes through an egress proxy that refuses hosts not on the environment's allowlist (403). agent-kit allows the package managers and `raw.githubusercontent.com`.
- **jamly allows `*.supabase.co`.** The wildcard matches any Supabase project, including an attacker's. That's an open exit: [Narrow the cloud allowlist from `*.supabase.co` to jamly's own project host](https://github.com/ferrarolabs/agent-kit/issues/127).
- **GitHub is a way out by design.** A comment, a branch or a PR on a public repo is public. Accepted: the agent must write to GitHub to do its job. Two things narrow it: the session reaches only its own repos, and [PreToolUse gates as default-deny classifiers](https://github.com/ferrarolabs/agent-kit/issues/59) will look at what it sends.
- **The command log posts every command to the issue** ([ADR 0020](decisions/0020-template-hooks-tested-with-node-test.md)). It redacts 11 secret patterns first, each seen failing on jamly. A secret in a shape the patterns don't know would go out. Accepted, and a reason to keep secrets out of the session in the first place.
- **Pushes to protected branches are denied** by the deny rules and rejected by the rulesets. That protects `main`, not secrecy: a feature branch is just as public.

### Local exits
- No egress filter. Accepted with the private-data leg, and fixed by the same deferred work: [Laptop sandbox floor](https://github.com/ferrarolabs/agent-kit/issues/120) or [Local devcontainer with an egress allowlist that proves itself](https://github.com/ferrarolabs/agent-kit/issues/64).

## Two-repo cloud sessions
They load no project rules ([ADR 0017](decisions/0017-account-deny-floor.md)). The account floor still denies `.env`, every force-push, pushes to `dev`, `staging` and `main`, and `rm -rf`. jamly's Supabase and EAS denies are missing. The boundary there is that the environment holds no credential for them, not the deny rule.

## Unknowns
Not verified when this was written. Each is a question, not a claim.
- **What the container's credential variables hold.** A cloud session sees variables named `GH_TOKEN`, `GITHUB_TOKEN`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Their values weren't inspected. They may be proxy placeholders or real tokens.
- **Whether `WebFetch` follows the allowlist.** If it is fetched outside the container, it may be a way out the proxy doesn't see.

## Where each boundary lives

| Boundary | Cuts | Where |
|---|---|---|
| No Supabase secret in the cloud | Private data | The environment's settings ([ADR 0016](decisions/0016-cloud-sessions-test-against-the-live-backend-until-real-users.md)) |
| Separate agent-kit environment, no variables | Private data | [guide](guides/cloud-environment-for-agent-kit.md) |
| `.env` denied | Private data | `account/settings.json`, each project's `.claude/settings.json` |
| GitHub scoped to the session's repos, no GraphQL | Private data, a way out | The session's GitHub proxy |
| Issue fields need triage access | Untrusted content | GitHub |
| Egress allowlist | A way out | The environment's settings |
| Push denies and rulesets | A way out (to protected branches only) | Deny rules, GitHub rulesets |
| Command log redaction | A way out (partial) | `template/.claude/hooks/command-log.js` |
