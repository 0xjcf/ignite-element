# Unify Actor-Web source contract: import canonical types from

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike addendum: .fas/state/spikes/agent-runtime-api-review.md (I1, C8/C9). Add @actor-core/runtime as an OPTIONAL peer dependency of @ignite-element/adapters (mirrors the existing optional peerDeps on xstate/redux/mobx). In the actor-web adapter entrypoint, import IgniteReadModelSource/IgniteCommandSource/IgniteActorSourceSnapshot (type-only) from @actor-core/runtime and DELETE the hand-redeclared ActorWebReadModelSource/ActorWebCommandSource/ActorWebSourceSnapshot in packages/ignite-adapters/src/adapters/ActorWebAdapter.ts — re-export the canonical types under the existing ActorWeb* names (thin alias/extension) for back-compat. Reconcile the snapshot helper fields (matches?/can?/hasTag?) against the canonical type (depends on actor-web A1 publishing C9). Changeset (minor). Direction = adapter depends on the lib it adapts; type-only; isolated to the actor-web entrypoint.

## Automation admission
- Expected operator value: Improves operator leverage around "Unify Actor-Web source contract: import canonical types from @actor-core/runtime, delete hand-copy" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- @actor-core/runtime is an optional peerDep of @ignite-element/adapters
- ignite imports the canonical contract; no hand-redeclared ActorWeb*Source remains (aliases ok)
- matches/can/hasTag resolved via the canonical snapshot type
- typecheck+tests pass against the published @actor-core/runtime
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
- packages/ignite-adapters/package.json
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/src/actor-web.ts
- packages/ignite-element/src/igniteCore/actor-web.ts

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
