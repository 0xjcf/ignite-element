# Collapse theme-scoped style patches into symmetric design to

## Source
Created with `fas create-task` on 2026-06-03.

## Problem
Second Layer-1 (design-system) increment, AFTER the geometry-token task. theme.css still carries ~47 [data-theme="dark"]/[light] component override rules — theme-conditional PATCHES rather than theme-agnostic rules reading symmetric tokens. The largest is the dark-only Pagefind search-modal block (#starlight__search ...): light mode has no equivalent and falls back to Starlight defaults, so the modal is not symmetrically themed. Others: sidebar current-page color, the inline .search-input field, and link hover using a raw hex (#c4f4ff). Goal: give these components symmetric light+dark TOKEN values (reusing --sl-color-*/--control-* and adding tokens only where needed) and rewrite the rules theme-agnostic, so the [data-theme] override count drops toward near-zero and only genuinely theme-specific declarations remain (color-scheme, the dark gradient background). Reference tool is Mobbin by ARCHETYPE (search/command-palette overlay + doc-page) during implementation; BfM is intentionally NOT used (Layer-2 tool). The contrast guardrail from the trio is the regression net; extend its selectors/pages to cover the search modal in both themes if feasible.

## Acceptance criteria
- The Pagefind search modal renders correctly in BOTH themes — its dark-only block is replaced by theme-agnostic rules driven from symmetric tokens (light no longer relies on un-themed Starlight defaults)
- The count of [data-theme] component override rules in theme.css drops substantially from ~47; remaining ones are only declarations that are genuinely theme-specific (e.g. color-scheme, dark background gradient), not value-swappable styling
- Raw hex applied directly inside component rules (e.g. link hover #c4f4ff) is replaced with tokens
- Geometry/spacing continues to come from the tokens introduced in the prior task (no reintroduced literals); this task does not re-patch
- Mobbin reference by archetype recorded in implementation notes; BfM intentionally excluded
- Both themes pass WCAG AA (docs contrast guardrail green, extended to the search modal where feasible) and the docs build stays green with no visual regressions
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
