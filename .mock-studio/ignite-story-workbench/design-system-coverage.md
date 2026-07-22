# Ignite Alchemy Design System Coverage

Status: narrative-ready companion-tool coverage recorded; rendered acceptance
still pending
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Token direction

The design system direction now serves a reusable dev/test companion tool:

- shell tokens brand `Ignite Alchemy` as a tool, not as the subject app;
- environment and connection badges expose `DEV` / `TEST` plus subject status;
- preview tokens preserve literal Voice Workbench truth inside the workspace;
- Inspector tokens support a docked sibling split rather than an overlay; and
- build/security tokens keep production absence explicit for the optimized
  subject application build while allowing a separate dev/test Alchemy tool.

## Foundations and disposition

| Need ID | Need | Candidate posture | Accountability | Evidence boundary |
| --- | --- | --- | --- | --- |
| `DS-001` | tool-shell chrome for `Ignite Alchemy` with environment badge | narrative-ready | upcoming tool-host revision must show `Ignite Alchemy` plus `DEV` or `TEST` | no rendered acceptance claimed yet |
| `DS-002` | subject connection status such as `Local · Voice Workbench · Connected` | narrative-ready | host contract only | no rendered acceptance claimed yet |
| `DS-003` | toolbar Story controls separate from subject controls | narrative-ready | Step, Run, Back, Restart stay in Alchemy chrome | no rendered acceptance claimed yet |
| `DS-004` | branch chooser lane for the two admitted page-4 branches | narrative-ready | tool lane only; preview keeps real controls | no rendered acceptance claimed yet |
| `DS-005` | docked Inspector sibling split | narrative-ready | Story/Debug/Machine/Evidence live in the Inspector | no rendered acceptance claimed yet |
| `DS-006` | live Machine tab with exact `No XState lens` fallback | narrative-ready | Machine remains additive and mapped to real subject edges | no rendered acceptance claimed yet |
| `DS-007` | headless/CI parity surfaces and receipt labels | narrative-ready | no shell required in CI | no rendered acceptance claimed yet |
| `DS-008` | production-absence build/security contract language | narrative-ready | no Alchemy route/assets/bridge in production by default | no rendered acceptance claimed yet |
| `DS-009` | responsive split-pane behavior at 1440, 1280, and 1024 | pending-rendered-proof | non-overlay sibling split required | no browser receipt claimed yet |
| `DS-010` | reduced-motion and focus treatment across toolbar, branch lane, and Inspector | narrative-ready | CSS and control semantics required | no browser receipt claimed yet |

## State-to-screen impact

| State or surface | Required contract | Status |
| --- | --- | --- |
| launch/attach | visible `Ignite Alchemy` identity, env badge, and subject connection posture | narrative-ready |
| story run lane | Alchemy-owned Story controls and page progression | narrative-ready |
| branch boundary | exactly two branch choices in the tool lane at page 4 | narrative-ready |
| docked Inspector | sibling split pane that never covers the subject preview | narrative-ready |
| Machine tab | real statechart lens or exact `No XState lens` fallback | narrative-ready |
| disconnected / restarting / HMR | explicit host-state visuals | narrative-ready |
| headless/CI parity | same controller semantics without Alchemy rendering | narrative-ready |
| production absence | explicit build/security acceptance wording | narrative-ready |

## Readiness summary

Narrative readiness is a truthful pass for the dev/test tool-shell direction.
Rendered/browser acceptance remains pending, and no production-host claim is
made in this turn.

Deferred downstream implementation tasks:

- `task-1784602868853` for branch-capable Story controls and headless parity
- `task-1784602883094` for Machine/XState rendering and retry-edge proof
- `task-1784602901002` for host shell, split Inspector, and subject-build
  production exclusion
- `task-1784602939863` for replay/receipt provenance durability
- `task-1784602955608` for later packaging/distribution decisions
