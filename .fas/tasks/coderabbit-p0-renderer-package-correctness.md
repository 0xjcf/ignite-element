# CodeRabbit P0 renderer package correctness

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit renderer package findings: tsconfig base resolution if still valid, JSX duplicate Fragment export, DOM polyfill attachShadow behavior, lit-html UMD global, and fallback warning logic.

## Acceptance criteria
- Renderer tsconfig extends an existing shared config or the finding is documented as already invalid.
- JSX renderer exports avoid duplicate Fragment export warnings.
- DOM polyfill supports the shadow-root methods used by style injection.
- Renderer UMD globals and fallback warnings match runtime behavior.
- Focused tests cover corrected behavior and repo verification passes.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-renderer/src/renderers/jsx/index.ts
- packages/ignite-renderer/src/internal/setupDomPolyfill.ts
- packages/ignite-renderer/vite.config.ts
- packages/ignite-renderer/src/renderers/registry.ts
- packages/ignite-element/src/internal/setupDomPolyfill.ts
- packages/ignite-element/src/tests/internal/setupDomPolyfill.test.ts
- packages/ignite-element/src/tests/renderers/resolveConfiguredRenderStrategy.test.ts
- packages/ignite-element/src/tests/renderers/jsxRuntime.test.ts

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-05-28
- Added paths: packages/ignite-element/src/internal/setupDomPolyfill.ts, packages/ignite-element/src/tests/internal/setupDomPolyfill.test.ts, packages/ignite-element/src/tests/renderers/resolveConfiguredRenderStrategy.test.ts, packages/ignite-element/src/tests/renderers/jsxRuntime.test.ts
- Type: verified-no-change
- Added at: 2026-05-28
- Evidence: packages/ignite-renderer/tsconfig.json already extends ../../configs/tsconfig/lib.dom.json, and configs/tsconfig/lib.dom.json exists.

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
