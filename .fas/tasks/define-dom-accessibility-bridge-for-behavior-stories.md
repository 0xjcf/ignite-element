# define DOM accessibility bridge for behavior stories

## Source
Created with `fas create-task` on 2026-05-26.

## Problem
Follow-up from inspector runtime investigation. Behavior-first runtime APIs and story lifecycle evidence exist, but docs/site agent-runtime-v3 still lists a DOM bridge gap: connect workflow expectations to rendered controls and accessible names after headless behavior is proven. Design a small mapping layer that keeps behavior tests headless by default and uses DOM/accessibility only for projection proof.

## Acceptance criteria
- A small public helper or documented pattern maps story/view expectations to rendered controls and accessible names without replacing headless behavior assertions.
- The bridge keeps DOM lifecycle evidence separate from behavior trace entries.
- Focused DOM/runtime tests and docs cover the bridge with an Ignite JSX example.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts

## Scope Amendments
- 2026-05-28 public-surface follow-up: added `packages/ignite-element/src/index.ts`, `packages/ignite-element/src/xstate.ts`, `packages/ignite-element/src/redux.ts`, `packages/ignite-element/src/mobx.ts`, `packages/ignite-element/src/actor-web.ts`, and `packages/ignite-element/src/tests/types/igniteCore.types.test.ts` after review found that the documented `ignite-element/xstate` bridge helper was implemented but its new testing types were not re-exported or type-tested through supported package entrypoints.

- Type: scope-refresh-promotion
- Added at: 2026-05-28
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/actor-web.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/actor-web.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: review-driven-public-surface
- Added at: 2026-05-28
- Trigger: reviewer-public-surface-gap
- Reason: Expose DOM bridge testing types through public entrypoints and type-test the documented xstate import path.
- Added paths: packages/ignite-element/src/index.ts, packages/ignite-element/src/xstate.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Evidence source: reviewer concern
- Evidence: reviewer concern | .fas/tasks/define-dom-accessibility-bridge-for-behavior-stories.md | Added root/xstate/redux/mobx entrypoint exports plus public type assertions.
- Accuracy signal: pnpm --filter ignite-element typecheck passed before generated scope refresh.

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
