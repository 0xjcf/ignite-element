# Systematize control geometry across all interactive controls and enforce it

## Source
Created with `fas create-task` on 2026-06-03.

## Problem
The geometry-token task unified spacing for HEADER controls only; buttons still drift. Evidence: hero action buttons are 51px tall with 20px padding (ad-hoc, not token-driven), and the 'minimal' hero variant ('Build your first component') has 0px horizontal padding — text runs to the border (a real bug). Only border-radius is consistent everywhere, precisely because it was tokenized; height/padding drift wherever they were not. This is the Layer-1 lesson again: stop patching per control, make the tokens the contract. Establish a control-geometry SCALE (intentional sizes — compact header chrome ~40px vs prominent hero CTAs ~48-51px — plus shared --control-pad-x/-y) and apply it to ALL interactive controls: header selects/search/toggle, hero action buttons (.hero .actions a), and content buttons/aside links. Enforce structurally (controls read tokens so new controls inherit correct geometry) AND with an automated geometry guardrail (sibling to the contrast guardrail in check-contrast.mjs — it already renders every control; assert controls use the radius scale and have non-zero horizontal padding, which would have caught the 0px button), wired into the same docs CI. Reference: Mobbin by ARCHETYPE (button + control-cluster patterns). BfM intentionally NOT used (Layer-2 tool). Recommended to run before the theme-patch-collapse task since both touch theme.css; do one at a time.

## Acceptance criteria
- A control-geometry scale exists in theme.css expressing intentional sizes (compact header chrome vs prominent hero CTAs) plus shared --control-pad-x/-y and the --radius-* scale
- All interactive controls read the geometry tokens — header selects/search/toggle, hero action buttons (.hero .actions a), and content/aside buttons — instead of ad-hoc per-component padding/height
- The 0px-horizontal-padding 'minimal' hero button is fixed to non-zero token padding so text is not flush against the border
- An automated geometry guardrail asserts controls use the radius scale and have non-zero horizontal padding (extends or sits beside check-contrast.mjs) and is wired into the docs CI; it fails on un-tokenized or zero-padding controls
- Geometry values grounded in a Mobbin reference pass by archetype (button + control cluster), recorded in implementation notes; BfM intentionally excluded
- Both themes pass WCAG AA (contrast guardrail green) and build stays green; hero CTAs stay intentionally prominent and header chrome compact, with no unintended visual regressions
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/styles/theme.css
- docs/site/scripts/check-contrast.mjs
- docs/site/README.md
- .github/workflows/docs-contrast.yml

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-03
- Added paths: docs/site/README.md, .github/workflows/docs-contrast.yml

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
