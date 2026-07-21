# Ignite Alchemy Approval Gate

Status: narrative gate reviewed
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Narrative readiness receipt

| Check | Verdict | Evidence |
| --- | --- | --- |
| Product authority is primary | `pass` | `stories-and-narratives.md` now defines `ALCH-US-*` and `ALCH-NAR-*` as the design-driving contract for Ignite Alchemy itself. |
| Golden walkthrough is a product narrative, not a fixture identity mistake | `pass` | `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW` is the golden product walkthrough and binds to `STORY-002` only as its subject fixture. The visible product sequence now explicitly includes `ALCH-NAR-001-PAGE-01-DISCOVER-GIVEN` through `ALCH-NAR-001-PAGE-07-VERIFY-RECEIPT`, including Behavior and the second Intent / Checkpoint. |
| Subject-fixture truth remains explicit and bounded | `pass` | `STORY-001` to `STORY-004` remain the only named executable fixtures and retain exact commands, checkpoints, and receipt posture from `examples/agents/voice-workbench/src/workbench-narratives.test.ts`. |
| UI surfaces and controls derive from product narratives | `pass` | `experience-inventory.md` and `narrative-machine-matrix.md` now trace the full corrected `ALCH-NAR-001-PAGE-*` sequence and only bind preview / receipt content to selected `STORY-*`. |
| Material branches are present and bounded | `pass` | failed-checkpoint Debug, Back replay, no-lens review, and advanced additive evidence each have explicit `ALCH-NAR-*` identifiers and rejoin or terminal outcomes. |
| Design-system gate is aligned to the narrative split | `pass` | `design-system-coverage.md` now uses only `ready`, `ready-with-extension`, `blocked`, or `deferred`; critical extensions have explicit accountability to the accepted Ignite Alchemy product direction, tracked work under `direct-1784661171192` / `task-1784655399770`, and a measured Round 2 validation plan. |
| Human acceptance evidence exists for using this corrected narrative as the gate | `pass` | The user instruction to "correct the documents and then proceed" is recorded as acceptance evidence for the clarified product narrative gate. |

Narrative readiness verdict: `pass`

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

This direction is no longer blocked on narrative authority. It remains subject
to the ordinary Round 2 design and measurement work.

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

Those layout intentions are now subordinate to the corrected `ALCH-NAR-*`
contract rather than a story-first product framing.

## Remaining non-narrative proof

Not yet proven in this turn:

- live browser overflow behavior at 1440x900, 1280x800, and resilient 1024
- keyboard traversal order and visible focus in the published build
- target sizing
- contrast verification
- reduced-motion verification in a measured browser session

These remain visual / measurement obligations rather than narrative blockers.
