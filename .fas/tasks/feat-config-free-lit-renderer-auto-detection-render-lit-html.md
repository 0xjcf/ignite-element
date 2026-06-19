# feat: config-free lit renderer auto-detection — render lit-html (html``) views without ignite.config.ts by detecting a l

## Source
Created with `fas create-task` on 2026-06-19.

## Problem
feat: config-free lit renderer auto-detection — render lit-html (html``) views without ignite.config.ts by detecting a lit TemplateResult and routing to the lit strategy; fixes the blank mobx example. Design: docs/renderer-selection.md

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-renderer/src/renderers/AutoDetectRenderStrategy.ts
- packages/ignite-renderer/src/index.ts
- packages/ignite-element/src/renderers/resolveConfiguredRenderStrategy.ts
- packages/ignite-element/src/tests/renderers/resolveConfiguredRenderStrategy.test.ts
- packages/ignite-element/src/tests/renderers/autoDetectRenderStrategy.test.ts
- docs/renderer-selection.md
- .changeset/lit-renderer-autodetect.md

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
