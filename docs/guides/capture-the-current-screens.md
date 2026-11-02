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
Set three variables, and the script signs in once before it captures:

| Variable | What |
|---|---|
| `CAPTURE_SIGN_IN_ROUTE` | the sign-in route, e.g. `/sign-in` |
| `CAPTURE_EMAIL`, `CAPTURE_PASSWORD` | a test account |
| `CAPTURE_EMAIL_SELECTOR`, `CAPTURE_PASSWORD_SELECTOR`, `CAPTURE_SUBMIT_SELECTOR` | optional, when the defaults don't match the form |

The values are never printed. When some are set and some are missing, the script names the missing ones and captures signed out.

The web build must also talk to a backend. On jamly, `npx expo export` bakes `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` into the bundle. Without them, the app says it is not configured, and every route behind the gate redirects to sign-in. ADR 0016 allows the live project's URL, its publishable key and a test account in cloud sessions until there are real users. They have to be set in the cloud environment's variables.

## Where the screenshots go
- **Issue draft:** a UI decision includes the current screen.
- **PR:** before and after, for every screen the PR changes.
- **Images:** the API can't attach an image to a comment. Commit small PNGs to the PR branch and link them by commit permalink (`/blob/<sha>/...`, `?raw=1`), so the link survives the branch being deleted.

## What it can't see
- **Native-only screens and modules** (camera, `expo-sqlite`, secure storage): the web build either has no screen there or behaves differently. Say which ones in the issue.
- **Device checks.** A web screenshot is not iOS or Android, and not the dark-room check. Those stay Elia's.
