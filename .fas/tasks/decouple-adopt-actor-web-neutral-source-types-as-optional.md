# [decouple] Adopt actor-web NEUTRAL source types as optional 

## Source
Created with `fas create-task` on 2026-06-09.

## Problem
Epic: actor-web-decoupling (Seam A). DEFERRED — gated on actor-web shipping its neutral Actor* source types (ActorReadModelSource/ActorCommandSource/ActorSource) and deleting integration/ignite-element-bridge.ts. This REPLACES the wrong-direction I1 ('import canonical Ignite* types into ignite'). Correct direction: @ignite-element/adapters OPTIONALLY adds actor-web as an optional peerDependency and imports its NEUTRAL source types to retire the structural hand-copy in src/adapters/ActorWebAdapter.ts — ONLY in @ignite-element/adapters, never @ignite-element/core or the element package (the decoupling guard in core-decoupling.test.ts must stay green). Edge: ignite-adapters -> actor-web. Alternative (also acceptable): keep the zero-dep structural hand-copy and skip the import entirely. Decide drift-risk vs zero-dep at implementation time. PRECONDITION: actor-web neutral types published.

## Acceptance criteria
- ignite-core + element remain free of external actor-web (guard test green)
- if adopted, @actor-web/* is an OPTIONAL peerDep of @ignite-element/adapters only
- no ignite-core -> actor-web edge
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
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/package.json

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
