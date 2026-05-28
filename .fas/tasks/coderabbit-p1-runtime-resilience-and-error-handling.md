# CodeRabbit P1 runtime resilience and error handling

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit runtime resilience findings: schema toJSON recursion guard, queued effects error handling, and command execution handling for synchronous throws and rejected promises.

## Automation admission
- Expected operator value: Improves operator leverage around "CodeRabbit P1 runtime resilience and error handling" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- Schema serialization detects self-returning toJSON values without infinite recursion.
- Queued effect callback errors are reported through the runtime error path or an intentional fallback.
- Agent command execution handles sync throws and async rejections consistently while retaining listener cleanup.
- Focused tests prove error and cleanup behavior; repo verification passes.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/runtime/schema.ts
- packages/ignite-element/src/runtime/effects.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-05-28
- Added paths: packages/ignite-element/src/tests/IgniteCore.test.ts

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
