# tighten test harnesses and example metadata from CodeRabbit review

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group CodeRabbit test/example hygiene findings that should follow runtime/config blockers: remove global console warn/error mocks from vitest setup and localize suppression, make renderer test imports resolve consistently, add reset support for vite plugin harness state and use it in beforeEach, move temp-project cleanup to afterEach, correct the Vitest globals comment, remove or fix misleading MobX example main metadata, and load isolated MobX CSS once instead of injecting duplicate links per instance. Source: CodeRabbit ignite-element domain review run against origin/main after commit 3a082b3.

## Acceptance criteria

- Tests surface unexpected console warnings/errors by default while intentionally noisy tests suppress output locally and restore spies.
- Test harness mutable state and temporary directories are reset even when tests fail.
- Example package metadata and CSS loading reflect the actual Vite-served examples.
- Run pnpm run lint, pnpm run typecheck, pnpm test, and fas verify --full.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- packages/ignite-element/vitest.setup.ts
- packages/ignite-element/vitest.node.config.ts
- packages/ignite-element/src/tests/config.test.ts
- packages/ignite-element/src/tests/helpers/vitePluginHarness.ts
- packages/ignite-element/src/tests/plugins/igniteConfigPlugins.test.ts
- packages/ignite-element/src/examples/mobx/package.json
- packages/ignite-element/src/examples/mobx/mobxExample.ts

## Scope Amendments

- 2026-05-27: `packages/ignite-element/src/tests/config.test.ts` was promoted into scope because removing global console spies exposed an intentionally noisy config warning test that now needs local suppression and assertion.
- 2026-05-27: `packages/ignite-element/src/tests/renderers/igniteJsxRenderStrategy.test.ts` was inspected for import cleanup, but no net edit was kept because switching to the local re-export broke the existing `vi.spyOn` module identity used to assert fallback logging.
- 2026-05-27: `packages/ignite-element/src/examples/mobx/another-counter-mobx.css` remains the style source, but did not need direct changes; duplicate style loading is fixed in `mobxExample.ts` by importing the CSS text once via Vite `?raw`.

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
