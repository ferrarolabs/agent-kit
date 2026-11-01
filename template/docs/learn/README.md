# Learn notes

From agent-kit ADR 0013.

Every PR that adds or changes behaviour ships a note here, `<story>.md`, written by the agent that built it, before the merge. The owner reads it during the review: they own the feature, not every line, and learn from each one.

## What a note covers
1. **The feature in one paragraph.**
2. **How the code is layered**, as a small tree, and what each layer's one job is.
3. **Concepts worth knowing**: each technology or idea behind it, what it is and why it is used here, with a real snippet.
4. **Decisions**, linked to the ADR or the decision log.
5. **Alternatives rejected**, and why.
6. **What testing or running it found.**
7. **Where to look** in the code.

## How it's written
For a developer who knows the stack's basics and wants to grow. The why, not only the what. Short sentences, real snippets, no filler.

## Keeping it true
Linked at the top of the PR with a permalink to the commit (`/blob/<sha>/docs/learn/…`), which survives the branch being deleted. When review changes the code, the note changes in the same push.
