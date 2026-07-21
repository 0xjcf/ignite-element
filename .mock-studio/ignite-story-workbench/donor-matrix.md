# Ignite Alchemy Donor Matrix

Status: first-round donor comparison
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
Selection: pending explicit human selection

## Donor register

| Donor ID | Direction | MagicPath component | Generated name | Component ID | Revision ID | Share/API URL |
| --- | --- | --- | --- | --- | --- | --- |
| `DIR-A` | Evidence Ledger | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | `https://api.magicpath.ai/v1/calm-pool-4819` |
| `DIR-B` | Reaction Map | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | `https://api.magicpath.ai/v1/noble-creek-8025` |

## Shared contract coverage

Both donors were authored against the same Story Workbench behavior contract and
must be judged against the same reviewer surface:

- idle Story selection
- paused stepping
- Back and replay
- completed receipt review
- assertion failure handling
- exact, candidate, and unavailable transition evidence
- no-XState-lens operation
- uncovered-gap review
- keyboard-visible controls
- non-color cues
- reduced-motion-safe presentation
- responsive fit targets at 1440x900 and 1280x800 with resilient 1024 layout

## Behavior and state matrix

| State or reviewer demand | `DIR-A` Evidence Ledger | `DIR-B` Reaction Map | Surface lead |
| --- | --- | --- | --- |
| `STATE-IDLE-SELECTION` | strong catalog and Story summary framing with notebook-style selection rail | strong top-level orientation but less direct catalog density | `DIR-A` |
| `STATE-PAUSED-STEP` | phase lane and current step posture read clearly in dense ledger layout | central topology makes active step position very legible | split |
| `STATE-BACK-REPLAY` | replay status reads as procedural audit event | replay route reads as spatial return path | split |
| `STATE-COMPLETED-RECEIPT` | strongest receipt-first hierarchy and annex posture | completed proof remains visible but secondary to map | `DIR-A` |
| `STATE-ASSERTION-FAILURE` | failure card and recovery language fit the audit notebook idiom | failure node is visible but slightly less procedural | `DIR-A` |
| `STATE-EVIDENCE-EXACT` | exact certainty reads well in tabular evidence | exact route proof is strongest in graph/path form | `DIR-B` |
| `STATE-EVIDENCE-CANDIDATE` | ambiguity language is explicit in panel copy | candidate path ambiguity is visually intuitive on map edges | `DIR-B` |
| `STATE-EVIDENCE-UNAVAILABLE` | `no XState lens` fallback reads clearly in receipt-first mode | unavailable posture remains visible but less central | `DIR-A` |
| `STATE-UNCOVERED-GAP` | exclusions and uncovered review fit annex/ledger model | gaps can be surfaced, but inventory reading is less efficient | `DIR-A` |
| keyboard focus visibility | explicit control chips and section boundaries support visible focus | map-plus-inspector still workable, but denser hotspots need careful QA later | `DIR-A` |
| non-color evidence cues | labels, chips, and receipt language do most of the work | legends and node shapes help, but color carries more hierarchy | `DIR-A` |
| reduced motion | straightforward to collapse to immediate state swaps | animated route emphasis will need stricter restraint in implementation | `DIR-A` |
| 1440x900 fit | strong dense review posture | strong showcase posture | split |
| 1280x800 fit | controlled compression across notebook panels | still readable, but map dominance starts to compete with evidence panes | `DIR-A` |
| resilient 1024 fit | more likely to preserve controls and literal labels under stacking | can survive, but topology density becomes the main risk | `DIR-A` |

## Strengths and liabilities

| Donor | Strengths | Liabilities | Best use if selected |
| --- | --- | --- | --- |
| `DIR-A` Evidence Ledger | strongest receipt-first hierarchy, literal reviewer terminology, dense evidence reading, gap review, and no-lens fallback | topology/path reasoning is less emotionally striking than the map direction | primary landing and reviewer shell for audit-first users |
| `DIR-B` Reaction Map | strongest explanation of exact versus candidate path evidence, memorable spatial identity, strong central-state orientation | less efficient for long-form receipt review, uncovered-gap inventory, and 1024-density resilience | additive topology/evidence mode or alternate visual lead |

## Surface donor recommendation by area

| Surface area | Preferred donor | Why |
| --- | --- | --- |
| landing identity | `DIR-B` | stronger first-glance spatial signature for Ignite Alchemy |
| Story picker and session setup | `DIR-A` | clearer catalog and summary density |
| active step review | mixed | `DIR-A` for procedural checkpoints, `DIR-B` for route awareness |
| receipt and annex evidence | `DIR-A` | strongest audit and provenance posture |
| topology certainty explanation | `DIR-B` | exact/candidate path proof reads naturally on map |
| uncovered-gap review | `DIR-A` | exclusions and provenance inventory are clearer in ledger form |
| implementation-risk posture | `DIR-A` | easier path to accessible, reduced-motion, resilient reviewer shell |

## Decision gate

No donor is approved in this document. The first material round is complete, and
the outcome remains `pending explicit human selection`.
