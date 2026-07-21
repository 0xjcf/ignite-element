# Ignite Alchemy Experience Inventory

Status: foundation gate
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Experience surfaces

UI surfaces and controls derive from `ALCH-NAR-*` product narratives. The
application preview, command traces, checkpoints, and receipts shown inside
those surfaces derive from the selected `STORY-*` fixture.

| Experience ID | Kind | Purpose | Product narrative coverage | Bound fixture content |
| --- | --- | --- | --- | --- |
| `EXP-001` | screen | primary desktop Ignite Alchemy reviewer surface | `ALCH-NAR-001` to `ALCH-NAR-005` | selected Story preview and receipt |
| `EXP-002` | view | Story catalog and selected fixture summary | `ALCH-NAR-001`, `ALCH-NAR-004` | `STORY-001` to `STORY-004` names, starting posture, summary |
| `EXP-003` | view | page lane / page release surface | `ALCH-NAR-001`, `ALCH-NAR-002`, `ALCH-NAR-003` | Given, Intent, Behavior, Checkpoint pages from the selected fixture |
| `EXP-004` | view | receipt and additive evidence workspace | `ALCH-NAR-001`, `ALCH-NAR-004`, `ALCH-NAR-005` | ordinary Story receipt plus additive tabs |
| `EXP-005` | view | coverage and gap review | `ALCH-NAR-004`, `ALCH-NAR-005` | additive uncovered / excluded / unavailable evidence |
| `EXP-006` | pattern | command/control rail | `ALCH-NAR-001`, `ALCH-NAR-002`, `ALCH-NAR-003` | Step, Run, Back, Restart, Debug entry bound to fixture posture |
| `EXP-007` | pattern | certainty badge system | `ALCH-NAR-004`, `ALCH-NAR-005` | exact / candidate / unavailable additive evidence only |
| `EXP-008` | pattern | final receipt summary | `ALCH-NAR-001`, `ALCH-NAR-002` | ordinary Story receipt remains primary |
| `EXP-009` | pattern | failure / blocked / retry surface | `ALCH-NAR-002`, `ALCH-NAR-005` | failed checkpoint, stale evidence, or timeout review posture |
| `EXP-010` | pattern | responsive density adaptation | all `ALCH-NAR-*` | same selected fixture truth across 1440, 1280, and resilient 1024 |

## Product-state-to-screen matrix

| Product state | Required surfaces | Required cues | Hidden or deferred surfaces |
| --- | --- | --- | --- |
| `ALCH-STATE-IDLE-SELECTION` | `EXP-001`, `EXP-002`, `EXP-006` | selected Story summary, review posture, inactive final receipt | no replay timeline yet |
| `ALCH-STATE-PAUSED-STEP` | `EXP-001`, `EXP-003`, `EXP-006`, `EXP-007` | current product page, bound fixture phase, keyboard-visible active control | no final receipt claim |
| `ALCH-STATE-BACK-REPLAY` | `EXP-001`, `EXP-003`, `EXP-006` | replaying status, target prior page, fresh-fixture language | no in-place scrubber semantics |
| `ALCH-STATE-COMPLETED-RECEIPT` | `EXP-001`, `EXP-004`, `EXP-006`, `EXP-008` | final receipt, additive evidence panes, stable completion language | no live mutation controls implied |
| `ALCH-STATE-FAILED-CHECKPOINT` | `EXP-001`, `EXP-003`, `EXP-009` | failed Checkpoint, non-color failure cue, retry or restart path | no false completion state |
| `ALCH-STATE-EVIDENCE-EXACT` | `EXP-004`, `EXP-007` | exact cue, provenance reference | no candidate ambiguity language |
| `ALCH-STATE-EVIDENCE-CANDIDATE` | `EXP-004`, `EXP-007` | candidate cue, ambiguity explanation | no exact claim |
| `ALCH-STATE-EVIDENCE-UNAVAILABLE` | `EXP-002`, `EXP-004`, `EXP-007` | `No XState lens` or unavailable cue | no fake machine coverage |
| `ALCH-STATE-UNCOVERED-GAP` | `EXP-005`, `EXP-007`, `EXP-009` | gap provenance, exclusions, next-step posture | no all-clear summary |

## Product-narrative-to-experience matrix

| Product narrative / branch | Primary surfaces | Secondary surfaces | Distinct visual state needed | Bound fixture role |
| --- | --- | --- | --- | --- |
| `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW` | `EXP-002`, `EXP-003`, `EXP-006`, `EXP-008` | `EXP-004` | yes | `STORY-002` supplies preview and receipt truth |
| `ALCH-NAR-002-FAILED-CHECKPOINT-DEBUG` | `EXP-003`, `EXP-009` | `EXP-008`, `EXP-004` | yes | selected fixture supplies failed page and receipt truth |
| `ALCH-NAR-003-BACK-REPLAY` | `EXP-003`, `EXP-006` | `EXP-004` | yes | selected fixture is rebuilt and replayed deterministically |
| `ALCH-NAR-004-NO-LENS-REVIEW` | `EXP-002`, `EXP-004`, `EXP-007` | `EXP-005` | yes | selected fixture remains fully reviewable without Machine evidence |
| `ALCH-NAR-005-ADVANCED-ADDITIVE-EVIDENCE` | `EXP-004`, `EXP-005`, `EXP-009` | `EXP-007` | yes | `STORY-003` and `STORY-004` supply timeout and stale receipts |

## Responsive anatomy

| Viewport | Required anatomy | Risk to watch |
| --- | --- | --- |
| `1440x900` | full reviewer composition with catalog, preview, page lane, and dense evidence panes | over-decoration hiding literal labels |
| `1280x800` | same surface with reduced whitespace and still-legible evidence hierarchy | clipped control rail or compressed receipt labels |
| `1024 resilient` | stacked or compressed layout that preserves catalog, current product page, and final receipt / evidence access | orphaned side pane or inaccessible controls |

## Interaction contracts

| Interaction | Required behavior | Bound authority note |
| --- | --- | --- |
| Story selection | selecting a catalog item updates the selected product review target | product chooses which `STORY-*` fixture to review; it does not alter fixture truth |
| Step / Run | visible focus, predictable order, Enter / Space activation where applicable | product releases fixture pages but does not rewrite them |
| Back replay | visibly indicates deterministic replay from a fresh fixture | product owns replay policy; fixture owns replayed truth |
| reduced motion | no critical state communicated only through motion | motion is aesthetic only |
| certainty changes | exact / candidate / unavailable distinguished by text, iconography, and shape, not color alone | additive evidence only; not fixture truth |
| receipt inspection | ordinary final receipt stays visually primary when present | product does not generate alternate receipts |

## Measurement targets

The first visual round must retain receipts for:

- no horizontal overflow at 1440, 1280, and intended 1024 layout;
- visible focus on Story selection and control rail actions;
- target sizes for primary controls;
- readable dense evidence labels and literal terminology;
- reduced-motion-safe transitions or static equivalents;
- each visually distinct state in the product-state-to-screen matrix.
