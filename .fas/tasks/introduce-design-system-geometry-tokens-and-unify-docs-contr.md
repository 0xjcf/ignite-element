# Introduce design-system geometry tokens and unify docs contr

## Source
Created with `fas create-task` on 2026-06-03.

## Problem
Task 1 unified the COLOR layer of docs/site/src/styles/theme.css (--sl-color-* + semantic --control-* tokens, both themes, enforced by the new contrast guardrail), but the design system is only partly unified. Audit evidence: 0 spacing/size/radius scale tokens exist, geometry falls through to per-component defaults, and there are 5 scattered border-radius literals (0.4rem/8/10/12px). This is why the header controls are visually uneven — measured: search trigger 40px tall vs version/theme selects 45px; version-select padding 10/24/10/20 vs theme-select 10/32/10/26 (two different source components); native-select arrow crowding patched ad-hoc with min-width:6.5rem on the version picker. This is Layer-1 (design-system) work per the layered audit methodology: extend the token system with a GEOMETRY layer and make the shared controls inherit it, the same way color was unified. Reference tool is Mobbin queried BY ARCHETYPE (control cluster + doc-page header) during implementation to ground sizing/padding/radius decisions; BfM is intentionally NOT used (it is the Layer-2 UX-flow tool, weak on pure CSS/spacing). Out of scope here and tracked as a dependent follow-on: collapsing the remaining 47 [data-theme] component patches (search modal, sidebar current-page, link hover) into symmetric light/dark tokens.

## Acceptance criteria
- A geometry token layer is defined in theme.css: control height (--control-height), padding (--control-pad-x/--control-pad-y), inter-control gap (--control-gap), and a radius scale (--radius-sm/-md/-lg) that replaces the scattered 0.4rem/8/10/12px literals
- The shared header controls (version select, theme select, search trigger) inherit ONE height, one horizontal padding rhythm, and consistent native-select arrow spacing from those tokens; ad-hoc per-component patches (min-width:6.5rem, margin-left:0.25rem) are removed or re-expressed via tokens
- Geometry values are grounded in a Mobbin reference query by archetype (control cluster + doc-page), recorded in implementation notes; BfM is intentionally not used and that is stated
- No raw spacing/radius literals remain inside the control rules — they read from the new tokens
- Both themes keep WCAG AA contrast (the docs contrast guardrail passes) and docs build stays green, with no visual regressions beyond the intended spacing fix
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/styles/theme.css

## Scope Amendments
- None.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- None known at task creation.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
