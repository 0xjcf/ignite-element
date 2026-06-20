# examples/frameworks: Angular interop demo — consume an ignite element (CUSTOM_ELEMENTS_SCHEMA)

> **BACKLOG (owner hold-off, 2026-06-20).** Deferred out of the active examples
> chain. Rationale: hold off on the Angular demo for now and remove the Angular
> claims from the beta docs so there are no false claims; focus on the worked-apps
> examples next. Queue status is `blocked` (parked, not scheduled); this brief is
> preserved for revival. When picked up, re-add the Angular section to
> `docs/site/src/content/docs/guides/host-app-integration.mdx` and the
> four-frameworks framing alongside the demo. Revisit after worked-apps / Phase 1.

## Source
Created with `fas create-task` on 2026-06-19.

## Problem
Build a runnable Angular demo under packages/ignite-element/src/examples/frameworks/angular, mirroring the react/vue/svelte scaffolding (vite + source aliases to local ignite-element and the scoped @ignite-element packages; a lightweight Angular + vite setup, no full Angular CLI; pin xstate to the workspace version). Consume the ignite element via Angular standard custom-element path: add CUSTOM_ELEMENTS_SCHEMA to the standalone component (or module) so Angular allows the unknown tag; bind inputs via attribute/property binding; listen to CustomEvents via (eventname) event binding. Document the real Angular friction honestly (CUSTOM_ELEMENTS_SCHEMA requirement, property vs attribute binding semantics, event and zone behavior) and do not paper over it. Do NOT build an igniteAngular helper or directive yet: per-framework wrappers stay follow-ups. Backs the four-frameworks claim (react README) and host-app-integration. Heaviest scaffolding of the three. Acts as an API gap-finder before the breaking cutover. Capture any API gaps as follow-up task briefs BEFORE any source change. Keep minimal and headless-testable; add the new example tsconfig to the packages/ignite-element package.json typecheck chain; extend (do not duplicate) host-app-integration with an Angular section. Precedent: the react/vue/svelte demos. THIRD of the LOCKED sequence Vue then Svelte then Angular then worked-apps; depends on the Svelte demo.

## Acceptance criteria
- The change is verified and does not introduce regressions.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/examples/frameworks/angular/package.json
- packages/ignite-element/src/examples/frameworks/angular/vite.config.ts
- packages/ignite-element/src/examples/frameworks/angular/tsconfig.json
- packages/ignite-element/src/examples/frameworks/angular/index.html
- packages/ignite-element/src/examples/frameworks/angular/src/main.ts
- packages/ignite-element/src/examples/frameworks/angular/src/app.component.ts
- packages/ignite-element/src/examples/frameworks/angular/src/counter.ignite.ts
- packages/ignite-element/src/examples/frameworks/angular/README.md
- packages/ignite-element/package.json
- docs/site/src/content/docs/guides/host-app-integration.mdx

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
