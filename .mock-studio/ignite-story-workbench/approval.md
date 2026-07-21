# Ignite Alchemy Approval Gate

Status: Round 2 direction approved for prototype iteration; browser acceptance pending measurement
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Human feedback outcome

The first material donor round was explicitly rejected by human feedback. Both
of these directions remain archived as rejected references:

- `DIR-A` Evidence Ledger
- `DIR-B` Reaction Map

Reason captured for both: the directions were over-engineered relative to the
reviewer shell the product needs.

## Approved replacement direction

The approved replacement direction for the next prototype iteration is:

- `ROUND-2` / Ignite Alchemy Story Runner / `dreamily-forest-8280`

This approval is for prototype iteration only. It does not claim browser-ready
acceptance, production parity, or implementation handoff completeness.

## What was accepted

The accepted direction matches the requested reviewer experience:

- restrained header with product, Story, status, and Run / Step / Back
- compact Story list on the left
- dominant application-under-test preview in the center
- small Given -> Intent -> Behavior -> Checkpoint lane
- compact result bar
- collapsed Debug drawer with failure-first disclosure
- tabs for failure/current checkpoint, Context diff, Receipt, Machine, and Coverage
- exact, candidate, and unavailable evidence language kept literal
- XState graph confined to the Machine tab when a lens exists

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

This document now records a design-direction approval, not a browser-acceptance
approval. The next acceptance gate is live measurement of the published Round 2
artifact.
