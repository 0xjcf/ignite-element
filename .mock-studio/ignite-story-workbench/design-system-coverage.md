# Ignite Alchemy Design System Coverage

Status: foundation gate
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Token direction

The design system must now serve the clarified product split:

- product-shell tokens support `ALCH-NAR-*` operator flows, controls, and
  branches;
- preview and receipt tokens preserve literal `STORY-*` fixture truth; and
- additive evidence tokens distinguish exact, candidate, and unavailable
  context without competing with the ordinary receipt.

Shared token contract:

- semantic typography tokens for product headings, fixture names, page phases,
  receipt rows, certainty badges, and dense evidence annotations;
- surface tokens for base canvas, primary review area, preview pane, receipt
  pane, additive evidence panels, control rail, and inline status cards;
- accent tokens for ember/copper/acid cues without replacing literal status
  language;
- focus, border, divider, and grid tokens that survive dark-ink or luminous-map
  styling;
- motion tokens with reduced-motion fallbacks.

## Foundations and readiness

| Need ID | Need | Readiness | Accountability | Evidence |
| --- | --- | --- | --- | --- |
| `DS-001` | typography hierarchy for product shell plus dense fixture truth | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; implemented under `direct-1784661171192` / `task-1784655399770` in the next visual round | `ALCH-NAR-*` controls and literal Story labels must both remain readable |
| `DS-002` | tokenized surfaces for primary, secondary, preview, and alert panes | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; implemented under `direct-1784661171192` / `task-1784655399770` in the next visual round | product shell and fixture evidence occupy different roles |
| `DS-003` | certainty badge and icon system for exact/candidate/unavailable | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; extended under `direct-1784661171192` / `task-1784655399770`, validated in the measured Round 2 build | additive evidence only; non-color cues required |
| `DS-004` | control rail buttons for Run/Step/Back/Restart/Debug | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; implemented under `direct-1784661171192` / `task-1784655399770` in the next visual round | controls derive from product narratives, not fixture internals |
| `DS-005` | receipt table / ledger rows | `ready` | existing receipt-first product constraint accepted in this review cycle | ordinary Story receipt must stay primary |
| `DS-006` | coverage gap cards and exclusion chips | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; extended under `direct-1784661171192` / `task-1784655399770` when additive coverage review lands | uncovered-gap review remains additive |
| `DS-007` | page lane for Given/Intent/Behavior/Checkpoint release | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; implemented under `direct-1784661171192` / `task-1784655399770` against `ALCH-NAR-001-PAGE-01-DISCOVER-GIVEN` through `PAGE-07-VERIFY-RECEIPT` | `ALCH-NAR-001` through `ALCH-NAR-003` need visible review sequencing |
| `DS-008` | no-lens and unavailable evidence banners | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; implemented under `direct-1784661171192` / `task-1784655399770` for `ALCH-NAR-004` | `ALCH-NAR-004` must fail closed without fake machine coverage |
| `DS-009` | responsive panel collapse at 1024 | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; validated by the measured Round 2 build under `direct-1784661171192` / `task-1784655399770` | resilient width required across all `ALCH-NAR-*` |
| `DS-010` | reduced-motion state transitions | `ready-with-extension` | accepted by Ignite Alchemy product direction in this review cycle; validated by the measured Round 2 build under `direct-1784661171192` / `task-1784655399770` | acceptance criterion requires reduced motion |

## Component and pattern coverage

| Experience item | Required components/patterns | Readiness | Notes |
| --- | --- | --- | --- |
| `EXP-002` Story catalog | selectable cards/list rows, current Story summary block | ready-with-extension | must clearly separate product selection from fixture truth |
| `EXP-003` page lane | page cards or timeline markers for Given/Intent/Behavior/Checkpoint | ready-with-extension | must visibly represent `ALCH-NAR-001-PAGE-01-DISCOVER-GIVEN` through `PAGE-07-VERIFY-RECEIPT` without collapsing Behavior or second Intent/Checkpoint |
| `EXP-004` receipt/evidence workspace | tabs or segmented controls, pane headers, receipt rows, evidence cards | ready-with-extension | ordinary receipt primary, additive tabs secondary |
| `EXP-005` gap review | gap list, exclusion chips, provenance summary | ready-with-extension | must support uncovered and excluded distinctions |
| `EXP-006` control rail | primary/secondary button set with keyboard focus | ready | controls are product-owned and fixture-bound |
| `EXP-007` certainty system | icon + label + shape states for exact/candidate/unavailable | ready-with-extension | critical branch for `ALCH-NAR-004` and `ALCH-NAR-005`; validation plan is the measured Round 2 build |
| `EXP-009` failure/blocked state | failure card or banner with retry posture | ready-with-extension | must keep failure-first Debug visible |
| `EXP-010` responsive density adaptation | multi-pane desktop layout with resilient collapse | ready-with-extension | extension contract is explicit; validation plan is 1440 / 1280 / resilient 1024 measurement in the measured Round 2 build |

## Accessibility coverage

| Concern | Requirement | Readiness |
| --- | --- | --- |
| contrast | text, borders, and status cues remain readable over dark-ink or luminous surfaces | ready-with-extension |
| focus | visible focus ring or outline on Story picker and control rail | ready-with-extension |
| target size | primary controls remain comfortably clickable at 1024 | ready-with-extension |
| reduced motion | motion-safe fallbacks for replay, transition, and panel emphasis | ready-with-extension |
| non-color cues | exact/candidate/unavailable and failure/gap states use icon/text/shape, not color alone | ready-with-extension |
| terminology | literal product and fixture labels remain readable and unambiguous | ready |

## Narrative readiness summary

The narrative-authority correction changes readiness in one important way:
Round 2 visual synthesis is now allowed to proceed because the product contract
is no longer ambiguous.

Still required in the visual round under `direct-1784661171192` /
`task-1784655399770`, with the measured Round 2 build as the validation plan:

- `DS-007` page lane representation
- `DS-003` / `EXP-007` certainty system representation
- `EXP-010` responsive density proof
- accessibility proof for focus, contrast, targets, and reduced motion

Those are no longer narrative blockers. They are explicit Round 2 design and
measurement obligations.
