# [decouple] (optional, drift-proofing) Import actor-web neutral source types once @actor-web/runtime is published

## Source
Created with `fas create-task` on 2026-06-09.

## Problem
OPTIONAL drift-proofing — NOT required for the decoupling (which is complete: core standalone + guard test core-decoupling.test.ts green; actor-web shipped neutral Actor* types and deleted its ignite bridge). Current resolution = option 1 (keep the zero-dep structural hand-copy in @ignite-element/adapters/src/adapters/ActorWebAdapter.ts). This task is the option-2 alternative, deferred. PRECONDITION: @actor-web/runtime published to npm (currently unpublished, v0.1.0 local; npm view => E404). WHEN PUBLISHED: add @actor-web/runtime as an OPTIONAL peerDependency of @ignite-element/adapters (+ devDep for type resolution) and import its neutral types (ActorReadModelSource/ActorCommandSource/ActorSource/ActorSourceSnapshot from its integration/actor-source) to retire the hand-copy. RECONCILE: actor-web's ActorSourceSnapshot (extends ActorSnapshot) lacks ignite's matches?/can?/hasTag?/status?/value? helpers — ignite must extend the imported type, not lose them. Edge: ignite-adapters -> @actor-web/runtime ONLY; core-decoupling.test.ts must stay green. NOT in the beta.4 release chain.

## Automation admission
- Expected operator value: Improves operator leverage around "[decouple] (optional, drift-proofing) Import actor-web neutral source types once @actor-web/runtime is published" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- @actor-web/runtime is an OPTIONAL peerDep of @ignite-element/adapters only
- hand-copy retired in favor of imported neutral types, with matches/can/hasTag preserved
- core-decoupling guard stays green
- no ignite-core/element -> actor-web edge
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
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts
- packages/ignite-adapters/tsconfig.typecheck.json
- pnpm-lock.yaml
- .changeset/actor-web-canonical-types-compat.md

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-10
- Added paths: packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts, packages/ignite-adapters/tsconfig.typecheck.json, pnpm-lock.yaml, .changeset/actor-web-canonical-types-compat.md

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
