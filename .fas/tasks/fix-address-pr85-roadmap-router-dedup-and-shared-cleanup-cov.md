# fix: address PR85 roadmap, router dedup, and shared cleanup coverage findings

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
CodeRabbit flagged three remaining PR85 closeout issues:

- `docs/v3-stable-roadmap.md` still lists the completed effects object-form task
  in the active suggested order.
- `examples/apps/nested-child-router/src/routerStore.ts` deduplicates browser
  history by comparing the current path with query string against a normalized
  destination path without query string.
- The shared-scope `cleanup:true` runtime path needs direct factory coverage for
  `component.getSnapshot()` / `execute()` without `withRuntimeHost` or override.
  This exposed that one-shot direct runtime calls must not leave shared-runtime
  bookkeeping active after the call completes.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The roadmap active order only lists remaining work.
- Nested-router history dedup normalizes the current pathname before comparing.
- Direct `getSnapshot()` / `execute()` calls do not prevent shared DOM teardown
  from releasing shared resources after the last disconnect.

## Proposed solution
- Remove the completed effects item from the active roadmap sequence.
- Normalize the current browser path with `resolveNestedRoute` before deciding
  whether to push or replace history.
- Add a shared `cleanup:true` regression test around direct runtime calls and
  reset one-shot shared-runtime bookkeeping after direct calls complete.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/v3-stable-roadmap.md
- examples/apps/nested-child-router/src/routerStore.ts
- examples/apps/nested-child-router/src/routerMachine.test.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/tests/IgniteElementFactory.test.ts

## Scope Amendments
- Promoted `packages/ignite-element/src/IgniteElementFactory.ts` after the direct
  shared-runtime regression showed the missing coverage exposes a real runtime
  cleanup bug.
- Promoted `packages/ignite-element/src/runtime/agent.ts` so one-shot agent
  runtime calls can release shared-runtime access without changing long-lived
  subscription semantics.

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
