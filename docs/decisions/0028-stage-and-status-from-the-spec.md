# 0028 · Stage and Status come from the spec, and no card loses its column

**Status:** accepted · 2026-11-16 · from [Stage and Status come from the spec](https://github.com/ferrarolabs/agent-kit/issues/176), part of [Project sync](https://github.com/ferrarolabs/agent-kit/issues/66)

## Context
Status is a board field that mirrors the org's Stage issue field ([ADR 0024](0024-the-board-on-issue-fields.md)). Their values were written twice: Stage by hand in the org settings, Status in the spec. Elia asked (2026-11-16) for one description, applied by itself.

Two API facts shape it, both checked in GitHub's published API descriptions:
- An org issue field's options can be updated **keeping their ids** (`PATCH /orgs/{org}/issue-fields/{id}`). Issues keep their value, and a rename carries over.
- A board's single-select options **can't** keep their ids (`updateProjectV2Field` replaces the list). Every card loses its Status, as on 2026-10-30.

## Decision
- **The spec describes Stage**: names, colours, descriptions, order (`stage` in `project-template.json`). A rename is written as the new name with `"was"`: the old one.
- **The sync applies it to the org's Stage field first**, keeping ids. A value the spec drops is removed only when no card on any registered board holds it; otherwise it is kept and reported.
- **Then every board's Status takes Stage's names and colours.** When they differ, the sync saves every card, replaces the options, and puts each card back: in its old column if it still exists, else in its Stage's, else in none, and reported. It checks every card against a fresh read.
- **Every run fills a card that has a Stage and no Status.** So a run that stops halfway is finished by the next one.
- **A card someone moves during the run is not overwritten**: cards are re-read just before the write, and only empty ones are written.
- **`status-step.js` is the only code that writes a card's field value**, and only the board's Status, looked up by name. It writes values copied from the card itself or from Stage, never a value of its own.
- After a replace, the report issue asks Elia to re-save the "Item closed" workflow on that board. The API can't edit workflows.

## Consequences
- Changing Stage is a one-line PR. It reaches the org and every board in one run.
- The sync is now a second writer of Status, next to the [reconciler](https://github.com/ferrarolabs/agent-kit/issues/78) to come. It only puts back or copies values set by people, so the `Ready` rule holds.
- A replace costs one write per card, in batches of 50, with retries on rate limits.
