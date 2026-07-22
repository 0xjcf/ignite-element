# Ignite Alchemy Approval Gate

Status: narrative-ready with corrected Round 3 candidates published; root
browser validation and human visual approval pending
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Narrative readiness receipt

Narrative readiness: `pass`

Golden walkthrough:

- `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW`
- acceptance evidence: the user explicitly approved a new material round with
  the direction to "build out the application over time as we progress through
  each narrative; do not throw the whole kitchen sink."

Design-driving pages:

- `ALCH-NAR-001-PAGE-01-DISCOVER-GIVEN`
- `ALCH-NAR-001-PAGE-02-STEP-INTENT-START-VOICE`
- `ALCH-NAR-001-PAGE-03-BEHAVIOR-PERMISSION-DENIED`
- `ALCH-NAR-001-PAGE-04-CHECKPOINT-PERMISSION-STAYS-A-FACT`
- `ALCH-NAR-001-PAGE-05-INTENT-TYPED-FALLBACK`
- `ALCH-NAR-001-PAGE-06-CHECKPOINT-NEW-RESPONDING-TURN`
- `ALCH-NAR-001-PAGE-07-VERIFY-RECEIPT`

Material branches:

- `ALCH-NAR-002-FAILED-CHECKPOINT-DEBUG`
- `ALCH-NAR-003-BACK-REPLAY`
- `ALCH-NAR-004-NO-LENS-REVIEW`
- `ALCH-NAR-005-ADVANCED-ADDITIVE-EVIDENCE`

Behavior evidence:

- `STORY-002` remains the golden subject fixture with exact Given, Intent,
  Behavior, Checkpoint, second Intent, and second Checkpoint truth from
  `examples/agents/voice-workbench/src/workbench-narratives.test.ts`.
- `STORY-003` and `STORY-004` remain additive timeout and stale-evidence
  receipts for the advanced branch.

Subject/operator split:

- `stories-and-narratives.md` keeps Ignite Alchemy's operator journey primary
  through `ALCH-US-*` and `ALCH-NAR-*`.
- `STORY-*` fixtures remain bound subject truth only. The reviewer tool may
  step, run, replay, and inspect receipts, but it may not redesign Voice
  Workbench or invent substitute domains.

Experience coverage:

- `experience-inventory.md` remains the authoritative inventory for the compact
  Story rail, dominant application-under-test preview, current-step strip,
  latent details drawer, and bounded additive evidence surfaces.

Design-system readiness:

- `design-system-coverage.md` remains the readiness artifact for token-first
  chrome, compact control rails, single-line page status, late receipt
  exposure, no-lens wording, responsive density, focus, and reduced-motion
  disposition.

Blocking gaps:

- none for visual synthesis

## Rejected round record

`dreamily-forest-8280` / Ignite Alchemy Story Runner is not an approved donor
for the next material round.

Rejection status:

- artifact: `ROUND-2`
- component: `430424171277877248`
- generated name: `dreamily-forest-8280`
- disposition: rejected by human feedback
- reason: kitchen-sink density and excessive simultaneous detail; it does not
  feel like a restrained developer tool and violates the approved direction to
  build the application progressively through the narrative.

This rejected artifact remains useful as provenance, but not as an approved
visual direction or donor for the next material round.

## Current gate

The next material round was admitted because narrative readiness passed and the
new human direction was explicit. That round produced two first-pass Round 3
revisions, but internal root preview inspection rejected those first revisions
because they still showed metadata-led previews and exposed receipt structure
too early.

Corrected revisions are now published:

- `ROUND-3A` / Ignite Alchemy Canvas Runner / `keenly-wood-5115` /
  component `430498394188955648` / revision `430502451452473344`
- `ROUND-3B` / Ignite Alchemy Focus Runner / `vibrantly-second-1236` /
  component `430498394214125568` / revision `430502451368595456`

Human feedback during this correction also identified a preferred leading
direction:

- `ROUND-3B-VAR2` / Ignite Alchemy Focus Runner (Variant 2) /
  `dreamily-sand-6842` / component `430503922197753859`

That preferred variant is treated as the leading donor/candidate only. It is
not yet browser-accepted and it is not a POC approval.

The corrected candidates and preferred variant are still unvalidated in-browser
at the repo level, so the next decision remains:

- root browser validation of the corrected candidates and preferred variant;
  then
- human visual/design approval before POC.
