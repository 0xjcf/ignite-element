# Ignite Alchemy Experience Inventory

Status: foundation gate for the dev/test companion-tool direction
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Experience surfaces

UI surfaces derive from Alchemy operator narratives. The attached subject
preview, command traces, checkpoints, and receipts derive from the selected
`STORY-*` fixture.

| Experience ID | Kind | Purpose | Product narrative coverage | Bound subject content |
| --- | --- | --- | --- | --- |
| `EXP-001` | screen | primary dev/test Alchemy workspace | `ALCH-NAR-001` to `ALCH-NAR-007` | attached subject preview plus tool controls |
| `EXP-002` | view | launch/attach toolbar with env and subject status | `ALCH-NAR-001`, `ALCH-NAR-002`, `ALCH-NAR-007` | host-only connection facts |
| `EXP-003` | view | page lane / page release surface | `ALCH-NAR-001`, `ALCH-NAR-003`, `ALCH-NAR-004` | Given, Intent, Behavior, Checkpoint pages from the selected fixture |
| `EXP-004` | view | docked Inspector with Story, Debug, Machine, and Evidence tabs | `ALCH-NAR-001`, `ALCH-NAR-003`, `ALCH-NAR-005` | additive receipt and inspection context |
| `EXP-005` | pattern | Alchemy toolbar control rail | `ALCH-NAR-001`, `ALCH-NAR-002`, `ALCH-NAR-004` | Story select, Step, Run, Back, Restart, attach/detach, Inspector |
| `EXP-006` | pattern | branch chooser lane at page 4 | `ALCH-NAR-001-BRANCH-TYPED-FALLBACK`, `ALCH-NAR-001-BRANCH-RETRY-MICROPHONE` | admitted `submitPrompt` and `startVoiceCapture` only |
| `EXP-007` | pattern | production-absence contract surface | `ALCH-NAR-007` | build/security receipts proving the optimized subject application build excludes Alchemy by default |
| `EXP-008` | pattern | headless/CI parity receipt surface | `ALCH-NAR-006` | same Story/controller receipts without Alchemy rendering |

## Product-state-to-screen matrix

| Product state | Required surfaces | Required cues | Hidden or deferred surfaces |
| --- | --- | --- | --- |
| `ALCH-STATE-DETACHED` | `EXP-001`, `EXP-002` | `DEV`/`TEST` badge, disconnected or attach posture | no Story receipt yet |
| `ALCH-STATE-ATTACHED-READY` | `EXP-001`, `EXP-002`, `EXP-005` | connected subject identity such as `Local · Voice Workbench · Connected` | no final receipt claim |
| `ALCH-STATE-PAUSED-STEP` | `EXP-001`, `EXP-003`, `EXP-005` | current page, current phase, keyboard-visible active control | no final receipt claim |
| `ALCH-STATE-BRANCH-BOUNDARY` | `EXP-001`, `EXP-003`, `EXP-005`, `EXP-006` | two admitted branch choices only, branch provenance language, subject preview still shows real controls | no invented third branch |
| `ALCH-STATE-BACK-REPLAY` | `EXP-001`, `EXP-003`, `EXP-005` | replaying status, restored prior page or branch boundary | no in-place rewind semantics |
| `ALCH-STATE-COMPLETED-RECEIPT` | `EXP-001`, `EXP-004`, `EXP-005` | ordinary Story receipt, branch choice receipt, stable completion language | no live mutation controls implied |
| `ALCH-STATE-FAILED-CHECKPOINT` | `EXP-001`, `EXP-003`, `EXP-004` | failed checkpoint, Inspector auto-opened on Debug | no false completion state |
| `ALCH-STATE-NO-LENS` | `EXP-004` | exact `No XState lens` fallback | no fake machine coverage |
| `ALCH-STATE-HEADLESS-CI` | `EXP-008` | same Story/controller semantics without rendered Alchemy | no shell required |
| `ALCH-STATE-PRODUCTION-ABSENT` | `EXP-007` | explicit absence contract | no hidden dev-only UI |

## Product-narrative-to-experience matrix

| Product narrative / branch | Primary surfaces | Secondary surfaces | Distinct visual state needed | Bound role |
| --- | --- | --- | --- | --- |
| `ALCH-NAR-001-DEVTOOL-STORY-REVIEW` | `EXP-002`, `EXP-003`, `EXP-005`, `EXP-004` | `EXP-008` | yes | `STORY-002` supplies preview and receipt truth |
| `ALCH-NAR-001-BRANCH-TYPED-FALLBACK` | `EXP-003`, `EXP-006` | `EXP-004` | yes | subject branch remains `submitPrompt` |
| `ALCH-NAR-001-BRANCH-RETRY-MICROPHONE` | `EXP-003`, `EXP-006` | `EXP-004` | yes | subject branch remains `startVoiceCapture` |
| `ALCH-NAR-002-ATTACH-AND-DETACH` | `EXP-002`, `EXP-005` | `EXP-001` | yes | host/runtime lifecycle only |
| `ALCH-NAR-003-FAILED-CHECKPOINT-DEBUG` | `EXP-003`, `EXP-004` | `EXP-005` | yes | subject truth remains intact |
| `ALCH-NAR-005-NO-LENS-REVIEW` | `EXP-004` | `EXP-003` | yes | Story review remains complete |
| `ALCH-NAR-006-HEADLESS-CI-PARITY` | `EXP-008` | `EXP-007` | yes | headless parity only |
| `ALCH-NAR-007-PRODUCTION-ABSENCE` | `EXP-007` | none | yes | production exclusion contract |

## Interaction contracts

| Interaction | Required behavior | Authority note |
| --- | --- | --- |
| attach/detach | Alchemy may attach or detach the subject runtime through a dev-only bridge | host lifecycle only; no subject authority rewrite |
| Step / Run | visible focus, predictable order, one page per Step, typed fallback as the declared Run default at page 4 | product releases Story pages but does not rewrite them |
| branch choice | branch chooser shows exactly the admitted page-4 branches and records the selected choice in replay/receipt | tool lane input only; preview keeps its real controls |
| Back replay | visibly indicates deterministic replay from a fresh fixture, including return to the branch boundary when needed | product owns replay policy; fixture owns replayed truth |
| Inspector tabs | Story / Debug / Machine / Evidence remain additive and docked | subject truth remains primary |
| production absence | no Alchemy surface appears in optimized subject application builds by default | build/security contract, not a hidden toggle |

## Measurement targets

The next tool-hosted visual round must retain receipts for:

- no horizontal overflow at 1440, 1280, and intended 1024 layouts;
- visible focus on toolbar controls, attach/detach controls, branch choices,
  and Inspector tabs;
- docked Inspector reflow instead of overlay;
- explicit branch-boundary posture at page 4 with exactly two admitted choices;
- headless receipt parity placeholders; and
- explicit production-absence proof placeholders.

Deferred downstream implementation follow-through:

- `task-1784602868853` for controller branch/replay/headless behavior
- `task-1784602883094` for Machine/XState lens and retry-edge rendering
- `task-1784602901002` for docked host shell, attach lifecycle, and
  subject-build exclusion
- `task-1784602939863` for replay/receipt provenance hardening
