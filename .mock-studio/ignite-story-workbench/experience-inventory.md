# Ignite Alchemy Experience Inventory

Status: foundation gate
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Experience surfaces

| Experience ID | Kind | Purpose | Narrative coverage | Notes |
| --- | --- | --- | --- | --- |
| `EXP-001` | screen | primary desktop reviewer landing surface | `NAR-001` to `NAR-005` | both MagicPath directions are standalone landing/reviewer concepts |
| `EXP-002` | view | Story catalog and Story summary | `NAR-001-*` | must support idle selection and no-lens posture |
| `EXP-003` | view | phase lane / page release surface | `NAR-002-*`, `NAR-003-*` | must visibly separate Given, Intent, Behavior, Checkpoint |
| `EXP-004` | view | receipt and evidence workspace | `NAR-004-*` | receipt-first; additive evidence only |
| `EXP-005` | view | coverage and uncovered-gap review | `NAR-001-UNCOVERED-GAP`, `NAR-004-GAP-REVIEW` | must distinguish excluded, uncovered, unavailable |
| `EXP-006` | pattern | command/control rail | `NAR-002-*`, `NAR-003-*`, `NAR-005-*` | Run, Step, Back, Restart, Cancel, filters |
| `EXP-007` | pattern | certainty badge system | `NAR-002-CANDIDATE-EVIDENCE`, `NAR-004-EXACT`, `NAR-004-CANDIDATE`, `NAR-004-UNAVAILABLE` | non-color status cues required |
| `EXP-008` | pattern | final receipt summary | `NAR-004-PRIMARY` | ordinary Story receipt must stay primary |
| `EXP-009` | pattern | failure / blocked / retry surface | `NAR-002-ASSERTION-FAILURE`, `NAR-003-CANCELLED` | must not look like silent disappearance |
| `EXP-010` | pattern | responsive density adaptation | `NAR-005-*` | 1440, 1280, resilient 1024 |

## State-to-screen matrix

| State | Required surfaces | Required cues | Hidden or deferred surfaces |
| --- | --- | --- | --- |
| `STATE-IDLE-SELECTION` | `EXP-001`, `EXP-002`, `EXP-006` | selected Story summary, evidence mode, inactive final receipt | no replay timeline yet |
| `STATE-PAUSED-STEP` | `EXP-001`, `EXP-003`, `EXP-006`, `EXP-007` | current phase, next-step gate, keyboard-visible active control | no final receipt claim |
| `STATE-BACK-REPLAY` | `EXP-001`, `EXP-003`, `EXP-006` | replaying/back status, target prior page, fresh-fixture language | no in-place scrubber semantics |
| `STATE-COMPLETED-RECEIPT` | `EXP-001`, `EXP-004`, `EXP-006`, `EXP-008` | final receipt, additive evidence panes, stable completion language | no live mutation controls implied |
| `STATE-ASSERTION-FAILURE` | `EXP-001`, `EXP-003`, `EXP-009` | failed Checkpoint, non-color failure cue, retry or restart path | no false completion state |
| `STATE-EVIDENCE-EXACT` | `EXP-004`, `EXP-007` | exact cue, provenance reference | no candidate ambiguity language |
| `STATE-EVIDENCE-CANDIDATE` | `EXP-004`, `EXP-007` | candidate cue, ambiguity explanation | no exact claim |
| `STATE-EVIDENCE-UNAVAILABLE` | `EXP-002`, `EXP-004`, `EXP-007` | `no XState lens` or unavailable cue | no fake machine coverage |
| `STATE-UNCOVERED-GAP` | `EXP-005`, `EXP-007`, `EXP-009` | gap provenance, exclusions, next-step posture | no “all clear” summary |

## Narrative-to-experience matrix

| Narrative/branch | Primary surfaces | Secondary surfaces | Distinct visual state needed |
| --- | --- | --- | --- |
| `NAR-001-PRIMARY` | `EXP-002` | `EXP-006` | yes |
| `NAR-001-NO-LENS` | `EXP-002`, `EXP-007` | `EXP-004` | yes |
| `NAR-001-UNCOVERED-GAP` | `EXP-005` | `EXP-007`, `EXP-009` | yes |
| `NAR-002-PRIMARY` | `EXP-003`, `EXP-006` | `EXP-007` | yes |
| `NAR-002-ASSERTION-FAILURE` | `EXP-003`, `EXP-009` | `EXP-008` | yes |
| `NAR-002-CANDIDATE-EVIDENCE` | `EXP-004`, `EXP-007` | `EXP-003` | yes |
| `NAR-003-PRIMARY` | `EXP-003`, `EXP-006` | `EXP-004` | yes |
| `NAR-003-CANCELLED` | `EXP-009`, `EXP-006` | `EXP-003` | yes |
| `NAR-003-STALE-SUPPRESSED` | `EXP-004`, `EXP-009` | `EXP-003` | no, can share replay or cancellation frame if explicitly linked |
| `NAR-004-PRIMARY` | `EXP-004`, `EXP-008` | `EXP-005` | yes |
| `NAR-004-EXACT` | `EXP-004`, `EXP-007` | `EXP-005` | yes |
| `NAR-004-CANDIDATE` | `EXP-004`, `EXP-007` | `EXP-005` | yes |
| `NAR-004-UNAVAILABLE` | `EXP-004`, `EXP-007` | `EXP-002` | yes |
| `NAR-004-GAP-REVIEW` | `EXP-005`, `EXP-009` | `EXP-004` | yes |
| `NAR-005-PRIMARY` | `EXP-001`, `EXP-006` | all surfaces | yes across viewports |
| `NAR-005-1024-RESILIENT` | `EXP-001`, `EXP-010` | `EXP-004`, `EXP-005` | yes |
| `NAR-005-REDUCED-MOTION` | `EXP-001`, `EXP-007` | `EXP-006` | yes |

## Responsive anatomy

| Viewport | Required anatomy | Risk to watch |
| --- | --- | --- |
| `1440x900` | full landing composition with primary reviewer surface, dense evidence panes, visible donor-specific atmosphere | over-decoration hiding literal labels |
| `1280x800` | same surface with reduced whitespace and still-legible evidence hierarchy | clipped control rail or compressed receipt labels |
| `1024 resilient` | stacked or compressed layout that preserves catalog, current page, and final receipt/evidence access | orphaned side pane or inaccessible controls |

## Interaction contracts

| Interaction | Required behavior | Non-authoritative note |
| --- | --- | --- |
| keyboard navigation | visible focus, predictable order, Enter/Space activation where applicable | prototype may simulate controls but must not claim runtime wiring |
| reduced motion | no critical state communicated only through motion | motion is aesthetic only |
| certainty changes | exact/candidate/unavailable distinguished by text, iconography, and shape, not color alone | prototype does not compute certainty live |
| gap review | uncovered and excluded states are visibly separate | prototype does not compute coverage live |
| receipt inspection | ordinary final receipt stays visually primary when present | prototype does not generate live receipts |

## Measurement targets

The first visual round must retain receipts for:

- no horizontal overflow at 1440, 1280, and intended 1024 layout;
- visible focus on Story selection and control rail actions;
- target sizes for primary controls;
- readable dense evidence labels and literal terminology;
- reduced-motion-safe transitions or static equivalents;
- each visually distinct state in the state-to-screen matrix.
