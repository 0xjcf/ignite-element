# CodeRabbit P1 renderer public subpath boundary cleanup

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit renderer boundary findings by replacing deep relative re-exports from ignite-element into ignite-renderer internals with stable package subpath exports, adding renderer package exports if needed.

## Acceptance criteria
- ignite-element JSX runtime re-exports use package subpaths, not ignite-renderer source-relative paths.
- There is one canonical JSX renderer public export surface without redundant deep internals.
- ignite-renderer exports any required subpaths intentionally with matching types.
- Typecheck and package export tests or entrypoint tests cover the boundary.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/renderers/jsx/jsx-runtime.ts
- packages/ignite-element/src/renderers/jsx/index.ts
- packages/ignite-element/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- packages/ignite-renderer/src/renderers/ignite-jsx.ts
- packages/ignite-element/src/tests/entrypoints.test.ts
- packages/ignite-element/src/renderers/jsx/jsx-dev-runtime.ts
- packages/ignite-element/src/renderers/jsx/types.ts
- packages/ignite-element/vitest.config.ts

## Scope Amendments
- Type: implementation
- Added at: 2026-05-28
- Trigger: Acceptance requires entrypoint coverage for renderer package subpath boundaries.
- Reason: Promote renderer JSX public barrel and entrypoint test because the implementation must preserve old deep-barrel behavior through stable package subpaths.
- Added paths: packages/ignite-renderer/src/renderers/ignite-jsx.ts, packages/ignite-element/src/tests/entrypoints.test.ts
- Evidence source: task-packet
- Evidence: task-packet | .fas/state/task-packet.json | packages/ignite-element/src/tests/entrypoints.test.ts was a low-confidence candidate and renderer package source is required to define the canonical public JSX subpath.
- Accuracy signal: current-source-inspection
- Follow-up needed: none

- Type: implementation
- Added at: 2026-05-28
- Trigger: Current-source inspection found adjacent JSX shims with existing stable package subpaths.
- Reason: jsx-dev-runtime and types can be moved off ignite-renderer/src without adding new public internals.
- Added paths: packages/ignite-element/src/renderers/jsx/jsx-dev-runtime.ts, packages/ignite-element/src/renderers/jsx/types.ts
- Evidence source: source-inspection
- Evidence: source-inspection | packages/ignite-element/src/renderers/jsx | jsx-dev-runtime maps to ignite-renderer/jsx-dev-runtime; types maps to the canonical ignite-renderer/jsx surface.
- Accuracy signal: current-source-inspection
- Follow-up needed: Leave renderer.ts and noDiffDenylist.ts as internal test shims until a dedicated task decides whether to expose lower-level renderer internals.

- Type: scope-refresh-promotion
- Added at: 2026-05-28
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: verification-fix
- Added at: 2026-05-28
- Trigger: Full verification failed resolving ignite-renderer/jsx/index from entrypoint coverage.
- Reason: The test alias table must resolve specific renderer package subpaths before the broader ignite-renderer/jsx alias.
- Added paths: packages/ignite-element/vitest.config.ts
- Evidence source: full-verify
- Evidence: full-verify | .fas/state/verification/latest.log | Vite could not resolve ignite-renderer/jsx/index because the broader alias matched first.
- Accuracy signal: failing-full-verify
- Follow-up needed: none

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
