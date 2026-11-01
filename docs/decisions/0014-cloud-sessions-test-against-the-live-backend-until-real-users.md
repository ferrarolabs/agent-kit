# 0014 · Cloud sessions test against the live backend, until real users arrive

**Status:** accepted · 2026-11-01

## Context
[PLAN.md](../PLAN.md) says the cloud environment holds no production credentials. jamly's rules went further: cloud sessions get no Supabase credentials at all (jamly D42), so an agent can't write to the live project.

On [feat(16): set what I play in this band](https://github.com/ferrarolabs/jamly/pull/17), that meant the agent couldn't run the app, and Elia found on his phone what a run would have caught. When the agent did run it, it found a real bug that every unit test had missed ([Before the PR, the agent uses the feature as a user would](https://github.com/ferrarolabs/agent-kit/issues/92)).

jamly has one Supabase project and no users yet. Elia decided on 2026-10-31 to use it for agent tests.

## Decision
Until jamly has real users, cloud sessions may use the live Supabase project **as an app user**:

- The environment holds the project URL and publishable key (`EXPO_PUBLIC_SUPABASE_*`), and one dedicated test account (`JAMLY_TEST_EMAIL`, `JAMLY_TEST_PASSWORD`).
- The network allowlist includes `*.supabase.co`.
- The agent signs in as the test account and reads or writes data only through the app, as a user would. It may create test data (for example a band named "Agent test band").

What does **not** change:
- No secret or service-role key, no database password, no access token for the Supabase CLI. The agent still can't push migrations or config (jamly D42).
- The publishable key is public anyway: it ships in every app build. Row-level security is the boundary, so the test account sees only what any user would.

This is an exception to PLAN's "no production credentials". It ends when the first real user is invited. From then on, agent tests use a separate test project, and the live project's values leave the cloud environment.

## Consequences
- Agents can run the feature end to end before the PR, with screenshots, on real data and real security rules.
- Test data lives next to real data until the switch. It must be easy to find and delete: test bands are named as such.
- The test account's password is a plain environment variable, which the agent can read. That's acceptable for an account with no real data. A network secret would hide it, but sign-in sends the password in the request body, which network secrets don't cover.
- jamly's D42 and the line in its `CLAUDE.md` ("The cloud session has no Supabase credentials, by design") are no longer true as written. They are updated in jamly: [Cloud sessions may test against the live Supabase project: update D42 and CLAUDE.md](https://github.com/ferrarolabs/jamly/issues/24).
- The switch to a separate test project needs an issue before the first invite: [Before the first real user: move agent tests to a separate Supabase project](https://github.com/ferrarolabs/jamly/issues/25).
