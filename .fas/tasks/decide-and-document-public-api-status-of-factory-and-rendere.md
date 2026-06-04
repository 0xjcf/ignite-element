# Decide and document public API status of factory and rendere

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Several exports are public but undocumented: createComponentFactory, createProjectionFactory, igniteElementFactory (low-level factories), and the @ignite-element/renderer primitives registerRenderStrategy, resolveRenderStrategy, getGlobalStyles/setGlobalStyles, injectStyles, getIgniteConfig. v3 already narrowed the public surface (removed config/* and renderers/* subpaths), so it is unclear whether these are intentionally advanced-public (should be documented) or leftover that should be marked @internal or removed from the public entry. Decide per export and make the surface intentional. Do NOT break the documented stable surface (igniteCore, the adapter subpaths, defineIgniteConfig, JSX).

## Acceptance criteria
- A decision is recorded (in .fas/memory/decisions.md or an ADR) classifying each listed export as advanced-public (document it) or internal (mark @internal and/or remove from the public entry)
- Advanced-public exports get at least minimal reference docs; internal ones are annotated or de-exported without breaking the stable documented surface
- Typecheck, tests, and behavior boundaries stay green; no change to igniteCore/adapter-subpath/defineIgniteConfig/JSX public API
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/index.ts
- packages/ignite-renderer/src/index.ts

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
