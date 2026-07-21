# Ignite Alchemy Design System Coverage

Status: foundation gate
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Token direction

Both first-round directions must stay token-first and desktop-primary while
projecting the same behavior contract.

Shared token contract:

- semantic typography tokens for Story/page headings, receipt rows, certainty
  badges, and dense evidence annotations;
- surface tokens for base canvas, primary work area, secondary evidence panels,
  control rail, and inline status cards;
- accent tokens for ember/copper/acid cues without replacing literal status
  language;
- focus, border, divider, and grid tokens that survive dark-ink or luminous-map
  styling;
- motion tokens with reduced-motion fallbacks.

Direction-specific emphasis:

| Direction | Visual intent | Required token posture |
| --- | --- | --- |
| `DIR-A` Evidence Ledger | editorial scientific notebook, audit-first, dark ink or vellum with ember/copper/acid accents | dense text hierarchy, ruled/grid paper feel, receipt-first surfaces |
| `DIR-B` Reaction Map | spatial systems map, luminous reaction paths, topology-first | node/edge emphasis, layered state-space view, clear path/graph hierarchy |

## Foundations and readiness

| Need ID | Need | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- |
| `DS-001` | typography hierarchy for dense review surfaces | compose | this task | literal Story/receipt/XState language required |
| `DS-002` | tokenized surfaces for primary, secondary, and alert panes | compose | this task | both directions need multiple evidence layers |
| `DS-003` | certainty badge and icon system for exact/candidate/unavailable | extend | this task | non-color cues required |
| `DS-004` | control rail buttons for Run/Step/Back/Restart/Cancel | compose | this task | visible focus and target sizing required |
| `DS-005` | receipt table / ledger rows | reuse | this task | receipt-first requirement |
| `DS-006` | coverage gap cards and exclusion chips | extend | this task | uncovered-gap review required |
| `DS-007` | paused-step phase lane | new | this task | explicit Given/Intent/Behavior/Checkpoint release view |
| `DS-008` | no-lens and unavailable evidence banners | compose | this task | no fake machine coverage allowed |
| `DS-009` | responsive panel collapse at 1024 | extend | this task | resilient width required |
| `DS-010` | reduced-motion state transitions | compose | this task | acceptance criterion requires reduced motion |

## Component and pattern coverage

| Experience item | Required components/patterns | Readiness | Notes |
| --- | --- | --- | --- |
| `EXP-002` Story catalog | selectable cards/list rows, current Story summary block | ready-with-extension | needs donor-specific hierarchy |
| `EXP-003` phase lane | page cards or timeline markers for Given/Intent/Behavior/Checkpoint | blocked until designed in donors | no existing repo design pattern to reuse directly |
| `EXP-004` receipt/evidence workspace | tabs or segmented controls, pane headers, receipt rows, evidence cards | ready-with-extension | must preserve literal labels |
| `EXP-005` gap review | gap list, exclusion chips, provenance summary | ready-with-extension | must support uncovered and excluded distinctions |
| `EXP-006` control rail | primary/secondary button set with keyboard focus | ready | common pattern, donor-specific styling only |
| `EXP-007` certainty system | icon + label + shape states for exact/candidate/unavailable | blocked until designed in donors | critical P0 gap until represented |
| `EXP-009` failure/blocked state | failure card or banner with retry posture | ready-with-extension | needs non-color emphasis |
| `EXP-010` responsive density adaptation | multi-pane desktop layout with resilient collapse | blocked until measured | must be proven in the first round |

## Accessibility coverage

| Concern | Requirement | Readiness |
| --- | --- | --- |
| contrast | text, borders, and status cues remain readable over dark-ink or luminous surfaces | blocked until measured |
| focus | visible focus ring or outline on Story picker and control rail | blocked until measured |
| target size | primary controls remain comfortably clickable at 1024 | blocked until measured |
| reduced motion | motion-safe fallbacks for replay, transition, and panel emphasis | blocked until measured |
| non-color cues | exact/candidate/unavailable and failure/gap states use icon/text/shape, not color alone | blocked until designed and measured |
| terminology | literal technical labels remain readable and unambiguous | ready |

## Critical gate summary

The pre-render foundation gate is not yet fully ready for approval because these
P0 items still need explicit first-round visual resolution and measurement:

- `DS-007` paused-step phase lane
- `DS-003` / `EXP-007` certainty system
- `EXP-010` responsive density adaptation
- accessibility proof for focus, contrast, targets, and reduced motion

This task may proceed to MagicPath visual synthesis because the missing items
are now explicit, owned by this task, and are the exact purpose of the first
material round. Approval remains blocked until the donor round and measurements
are recorded.
