# Ignite Alchemy Approval Gate

Status: pending explicit human selection
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## First-round result

The first material donor round is complete. Two distinct MagicPath reviewer
directions now exist over the same Story Workbench behavior matrix:

- `DIR-A` Evidence Ledger
- `DIR-B` Reaction Map

No direction is approved by this document. This gate remains open until the
human reviewer explicitly selects a donor direction or requests another round.

## Covered reviewer contract

Both directions were authored to cover the same required reviewer states and
terms:

- Ignite Alchemy / Story Workbench identity
- Story, Intent, Behavior, Checkpoint, receipt, XState, command, view, and coverage vocabulary
- idle Story selection
- paused stepping
- Back and replay
- completed receipt review
- assertion failure posture
- exact, candidate, and unavailable evidence certainty
- no-XState-lens fallback
- uncovered-gap review
- keyboard-visible controls
- non-color cues
- reduced-motion-safe presentation

## Direction summary

| Direction | Strongest qualities | Main tradeoff |
| --- | --- | --- |
| `DIR-A` Evidence Ledger | strongest audit notebook hierarchy, receipt-first review, failure handling, no-lens posture, and uncovered-gap inventory | less spatially memorable for topology certainty |
| `DIR-B` Reaction Map | strongest reaction-path identity and exact-versus-candidate topology explanation | weaker fit for dense receipt reading and 1024 review resilience |

## Measured versus unmeasured

- Recorded:
  - MagicPath component IDs, revisions, share/API URLs, and preview image URLs
  - source-level presence of viewport toggles and reduced-motion toggles in both donors
- Not recorded as proven:
  - viewport overflow behavior
  - keyboard traversal order
  - target sizing
  - contrast
  - live browser interaction against published donor builds

See `receipts/measurements.json` for the exact receipt and limitation record.

## Required next step

Human reviewer must choose one of these outcomes:

- approve `DIR-A` as the implementation donor
- approve `DIR-B` as the implementation donor
- request a second material round with explicit adjustment notes

Until that happens, approval remains `pending explicit human selection`.
