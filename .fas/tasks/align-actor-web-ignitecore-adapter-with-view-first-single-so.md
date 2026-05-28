# Align Actor-Web igniteCore adapter with view-first single-so

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Implement the library-side Ignite contract proven by Freedom Air: Actor-Web igniteCore examples and types should prefer view, not states, and common app code should pass one source handle that carries read model and command capability instead of requiring app-level commandSource. Preserve commandSource only as an advanced/back-compat escape hatch if needed, and update docs/tests to show source + view + commands as the primary API.

## Acceptance criteria
- Actor-Web igniteCore public examples use view + commands and do not teach states or commandSource as the normal path.
- A single Actor-Web source handle can satisfy both projection reads and command actor wiring for igniteCore.
- Type tests cover inference for source, view context, actor.send commands, and the back-compat path if retained.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/igniteCore/actor-web.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts

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
