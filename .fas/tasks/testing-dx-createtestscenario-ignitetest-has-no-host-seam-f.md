# Testing DX: createTestScenario/igniteTest has no host seam for host-reading commands/effects

## Source
Created with `fas create-task` on 2026-06-16.

## Problem
The lightweight headless test harness (test/createTestScenario from ignite-element/xstate testing) provides no way to supply a host, so commands/effects that read host (e.g. host.dataset.*) cannot be exercised via the scenario harness — only via the heavier accessibilityBridge (which needs a renderer). Add an optional host (or DOM seam) e.g. createTestScenario(component, { host }) so host-reading command/effect logic is unit-testable headlessly. Surfaced in the-good-way goodway: a startModule command read host.dataset.moduleId; worked around by sourcing the id from the machine snapshot (actor.state.context) instead, but a host seam would let consumers test host-dependent seams directly.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
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
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts

## Scope Amendments
- Type: scope-refresh-promotion
- Added at: 2026-07-05
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/actor-web.ts, packages/ignite-element/src/index.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/testing.ts, packages/ignite-element/src/IgniteElementFactory.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts, packages/ignite-element/src/xstate.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/actor-web.ts, packages/ignite-element/src/index.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/testing.ts, packages/ignite-element/src/IgniteElementFactory.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts, packages/ignite-element/src/xstate.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

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
