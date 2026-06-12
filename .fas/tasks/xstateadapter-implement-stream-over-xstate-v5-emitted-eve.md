# XStateAdapter: implement stream() over XState v5 emitted eve

## Source
Created with `fas create-task` on 2026-06-12.

## Problem
Pre-stable-v3 audit finding F5. The optional stream() emitted-event seam (contract: packages/ignite-core/src/IgniteAdapter.ts:19, decision 2026-06-09) has exactly one consumer (ActorWebAdapter). XState v5 actors emit domain events natively (emit(...) / actor.on(type, handler)), making XStateAdapter the natural second consumer — and the flagship adapter the docs lead with. Implement stream() in packages/ignite-adapters/src/adapters/XStateAdapter.ts wrapping the actor's emitted-event subscription, thread the Emitted type param from the machine's emitted union so on()/execute().events are typed, and mirror the ActorWebAdapter test surface (emits via on/execute/record; transient capture during the execute() command window). Zero runtime changes expected outside the adapter (the runtime bridge is seam-generic). Additive, non-breaking: ship as the first post-stable minor with a minor changeset. Update the emitted-events docs (guides/agent-runtime-v3, api/headless-runtime, the-ignite-model) to show the xstate path alongside actor-web.

## Acceptance criteria
- stream() implemented in XStateAdapter wrapping XState v5 emitted events
- on()/execute().events/record() surface xstate emits, typed from the machine's emitted union
- test lane mirrors adapter-stream-seam/runtime-stream-bridge coverage for xstate
- docs show the xstate emitted-events path
- minor changeset authored
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
- Scope unknown.

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
