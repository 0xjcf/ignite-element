# Ignite Alchemy Approval Gate

Status: visual iteration paused pending executable narrative gate review
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Human feedback outcome

The first material donor round was explicitly rejected by human feedback. Both
of these directions remain archived as rejected references:

- `DIR-A` Evidence Ledger
- `DIR-B` Reaction Map

Reason captured for both: the directions were over-engineered relative to the
reviewer shell the product needs.

## Replacement direction state

The replacement visual direction remains the same candidate:

- `ROUND-2` / Ignite Alchemy Story Runner / `dreamily-forest-8280`

That direction is now paused behind a stricter narrative gate. Further MagicPath
iteration is deferred until the reviewer shell is re-anchored on the exact
executable Story names, page ids, checkpoints, commands, and receipts from
`examples/agents/voice-workbench/src/workbench-narratives.test.ts`.

## What remains directionally accepted

The candidate direction still matches the requested reviewer shell shape:

- restrained header with product, Story, status, and Run / Step / Back
- compact Story list on the left
- dominant application-under-test preview in the center
- small Given -> Intent -> Behavior -> Checkpoint lane
- compact result bar
- collapsed Debug drawer with failure-first disclosure
- tabs for failure/current checkpoint, Context diff, Receipt, Machine, and Coverage
- exact, candidate, and unavailable evidence language kept literal
- XState graph confined to the Machine tab when a lens exists

Those layout intentions remain advisory until they are rechecked against the new
story-first narrative contract.

## Why the gate is paused

The immediate acceptance sequence changed. Before more visual work, the
foundation must prove that the reviewer shell is driven by:

- exact executable Story names;
- exact Given / Intent / Behavior / Checkpoint page sequences;
- exact commands and `canExecute` outcomes;
- exact ordinary receipt truth; and
- bounded reviewer flows for failure, no-lens review, and Back replay.

## What remains unproven

Recorded in this turn:

- MagicPath component creation, submission, share/API URL, generated name, revision, and preview URL
- source-confirmed interactions for Story selection, Run, Step, Back, Debug toggle, failure auto-open, and evidence tabs

Not yet proven in this turn:

- live browser overflow behavior at 1440x900, 1280x800, and resilient 1024
- keyboard traversal order and visible focus in the published build
- target sizing
- contrast verification
- reduced-motion verification in a measured browser session

See `receipts/measurements.json` for the exact partial receipt.

## Gate meaning

This document no longer grants active visual-iteration approval. It records that
the first-round donors were rejected, the Round 2 shell remains the current
candidate, and all further MagicPath refinement is paused until the executable
narrative gate is reviewed and accepted.
