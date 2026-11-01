# Learn — CI for agent-kit

> What [CI for agent-kit, then require it in the main ruleset](https://github.com/ferrarolabs/agent-kit/issues/6) built, and why it is shaped this way.

## The feature in one paragraph

Every PR, and every push to `main`, runs one job: **Docs, links, JSON, scripts**. It lints the Markdown, checks that every relative link and anchor resolves, parses every JSON file, checks that every script parses, and runs the unit tests. Any failure turns the PR red, with the file and line.

## How it's layered

```text
.github/workflows/ci.yml          one job, five steps, in order of cost
├─ markdownlint-cli2 (pinned)     style; rules and reasons in .markdownlint-cli2.jsonc
├─ scripts/check/check-links.js   relative links + anchors, no dependencies
├─ node -e JSON.parse             every tracked .json
├─ node --check                   every script parses
└─ node --test                    every *.test.js
```

## Concepts worth knowing

### 1. A docs repo still has code inputs
`scripts/projects/project-template.json` is read by `build-project.js`. A stray comma doesn't look like a bug in review; it breaks the script the next time someone runs it. Parsing every JSON file costs nothing and catches it.

### 2. Links are the argument
An ADR cites the ADRs it supersedes; the inventory and `template/README.md` cite the PR where each piece was proven. A dead link is a claim with no evidence. So links get a check, and anchors too: `PLAN.md#final-layout-of-this-repo` breaks silently when the heading is renamed.

### 3. Deterministic checks only
External URLs are not checked. They fail for reasons a PR didn't cause: rate limits, outages, a site moving. A check that is red for no reason teaches everyone to ignore red. Relative links are the ones a PR can break.

GitHub's anchor rule, implemented in `slug()`: lower case, punctuation dropped, each space becomes a hyphen, repeated headings get `-1`, `-2`.

```js
slug('3.4 Size S / M / L') // → '34-size-s--m--l'
```

### 4. No `package.json`
`node --test` and `node --check` ship with Node. `markdownlint-cli2` runs through `npx` at a pinned version. Nothing to install, nothing to update.

### 5. Seen failing
A commit added a link to a file that doesn't exist. CI went red with `docs/ROADMAP.md:79  missing file: does-not-exist.md`; the next commit reverted it. Both stay in the history as proof.

### 6. Why the required check waits
A ruleset that requires a check blocks every PR where that check never reports. PRs cut before the workflow existed would never report it. So the check becomes required after this merges, and open PRs merge `main` in.

## Alternatives rejected
- **lychee or markdown-link-check** for links: they check external URLs too, which makes CI flaky.
- **Fixing 400 lint findings** for line length and blank lines: churn across every doc, for a style the repo deliberately doesn't use.

## Where to look
- `.github/workflows/ci.yml`
- `scripts/check/check-links.js` and its tests
- `.markdownlint-cli2.jsonc`
