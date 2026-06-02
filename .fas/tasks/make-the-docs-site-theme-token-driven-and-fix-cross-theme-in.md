# Make the docs site theme token-driven and fix cross-theme in

## Source
Created with `fas create-task` on 2026-06-02.

## Problem
The docs Starlight theme (docs/site/src/styles/theme.css) patches dark mode per-component with hardcoded hex instead of driving from tokens, so any control not explicitly patched falls through to wrong defaults. This already made the version picker invisible in dark mode (fixed in commit f2f61cb). The full --sl-color-* token set is not redefined coherently per theme (e.g. --sl-color-accent-contrast is a dark value in both themes), and hardcoded hex duplicates token values and drifts. Refactor to a coherent token-driven system so components inherit correct contrast automatically in both themes.

## Acceptance criteria
- The full Starlight --sl-color-* token set is defined coherently for :root (dark) and [data-theme=light] so no component depends on an un-themed default
- Semantic control tokens (control bg/text/border/focus-ring) exist and are applied uniformly to header selects and search
- Hardcoded hex that duplicates token values is replaced with var(--sl-color-*)
- Dead/duplicate CSS is removed: the two @media (min-width:72rem) right-sidebar blocks are consolidated and border-radius:8% is corrected to 8px
- Contrast is at least WCAG AA across header, sidebar, TOC, asides, code, and links in both themes with no visual regressions
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/styles/theme.css
- docs/site/astro.config.mjs

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
