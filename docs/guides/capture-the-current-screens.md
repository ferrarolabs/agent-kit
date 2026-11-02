# Capture the current screens

**Rule:** before an agent proposes where something goes in the UI, it looks at the screen it changes. It takes a screenshot in the cloud session and puts it in the issue draft. In the PR it shows the screen before and after.

## Why
Drafting [A4 — Set what I play in this band](https://github.com/ferrarolabs/jamly/issues/16), an agent placed an editor from the docs alone. Nobody could judge the proposal, because nobody could see the screens it changed. A PM knows the product it ships ([Agents know the product's screens before proposing where things go](https://github.com/ferrarolabs/agent-kit/issues/87)).

## How
Build the app for web, then capture each route with the Playwright already installed in cloud sessions. On an Expo project:

```bash
# in the project
npm ci
npx expo export --platform web --output-dir dist-web

# from an agent-kit checkout
node scripts/screens/capture.js --serve <project>/dist-web --out <scratchpad>/shots \
  --routes /,/sign-in,/band/create
```

The script serves the export on a free local port. Every route falls back to `index.html`, so the client router takes over. Each route is captured at 390×844, a phone. One line per route says where the page ended up:

```text
redirected  / → /sign-in  …/shots/index.png
reached     /sign-in → /sign-in  …/shots/sign-in.png
```

`redirected` means the route was not reached: the screenshot shows wherever the app sent you, usually an auth gate. Never present a redirected screenshot as the screen you meant.

Use `--base <url>` instead of `--serve` when a dev server is already running. Change the size with `--width` and `--height`.

## Getting past sign-in
Give the sign-in route and the names of the variables that hold a test account. The script signs in once before it captures:

| Flag or variable | What |
|---|---|
| `--sign-in-route <route>` (or `CAPTURE_SIGN_IN_ROUTE`) | the sign-in route, e.g. `/sign-in` |
| `--email-env <NAME>`, `--password-env <NAME>` | the variables that hold the test account. Default `CAPTURE_EMAIL` and `CAPTURE_PASSWORD` |
| `CAPTURE_EMAIL_SELECTOR`, `CAPTURE_PASSWORD_SELECTOR`, `CAPTURE_SUBMIT_SELECTOR` | optional, when the defaults don't match the form |

Point the flags at the variables the project's environment already has. No new variable is needed. On jamly ([ADR 0016](../decisions/0016-cloud-sessions-test-against-the-live-backend-until-real-users.md)):

```bash
node scripts/screens/capture.js --serve dist-web --out shots --routes /,/band/create \
  --sign-in-route /sign-in --email-env JAMLY_TEST_EMAIL --password-env JAMLY_TEST_PASSWORD
```

The flags take variable *names*. A value that isn't a name (an email, say) is refused, so a secret never ends up on the command line. The values are never printed. When some are set and some are missing, the script names the missing ones and captures signed out.

The web build must also talk to a backend. On jamly, `npx expo export` bakes `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` into the bundle. Without them, the app says it is not configured, and every route behind the gate redirects to sign-in. ADR 0016 allows the live project's URL, its publishable key and a test account in cloud sessions until there are real users. They live in jamly's cloud environment, so run the capture from a session on that environment.

## Where the screenshots go
- **Issue draft:** a UI decision includes the current screen.
- **PR:** before and after, for every screen the PR changes.
- **Images:** show them inline, never as a bare link. The API can't upload an attachment, so commit small PNGs to the PR branch and embed them with a commit permalink: `![Sign-in](https://raw.githubusercontent.com/<owner>/<repo>/<sha>/docs/learn/img/<file>.png)`. A permalink by commit survives the branch being deleted.

## What it can't see
- **Native-only screens and modules** (camera, `expo-sqlite`, secure storage): the web build either has no screen there or behaves differently. Say which ones in the issue.
- **Device checks.** A web screenshot is not iOS or Android, and not the dark-room check. Those stay Elia's.
