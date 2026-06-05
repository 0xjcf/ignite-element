# v3 docs polish: design-system styling pass (tokens + shared chrome)

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 1 (parallel, page-agnostic) of the v3 docs polish epic. Improve the SHARED design system ONCE — not per page: tokens, code blocks, asides/callouts, tables, links/buttons, lifecycle-diagram styling, dark mode. Reference Mobbin BY ARCHETYPE (doc page, API ref, guide-with-code, landing). Do NOT couple styling to individual pages/flows (memory docs-design-audit-approach; the version-picker dark-mode bug was a shared-chrome failure). Honor the contrast guardrail (docs/site/scripts/check-contrast.mjs) — both themes pass AA. Edit theme tokens + Starlight component overrides only; no content edits. Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- Shared design-system improvements applied at the token/component layer (theme.css + Starlight overrides), audited ONCE globally — not per page or per flow
- Both light and dark themes pass the AA contrast guardrail (docs/site/scripts/check-contrast.mjs) and npm run docs:build stays green
- No documentation CONTENT changes in this task — styling/tokens only
- Code blocks, asides, tables, links, and the lifecycle diagram render consistently across the ~5 page archetypes
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
- `docs/site/astro.config.mjs` was listed as a hint but needed no change: `customCss` already wires `theme.css`, and this pass is token/component-layer only. All improvements (table chrome + lifecycle-diagram figure chrome, with themed `--table-*` / `--diagram-*` tokens) landed in `theme.css`. No documentation content was edited. Both themes still pass the AA contrast guardrail and the control-geometry guardrail (32 contrast checks + 9 controls green).

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
