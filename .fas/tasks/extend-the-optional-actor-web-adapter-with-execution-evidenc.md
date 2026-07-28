# Extend the optional Actor-Web adapter with execution-evidence projection

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Implement the accepted versioned consumer contract in ignite-adapters while preserving the exact caller-owned Actor-Web source and native lifecycle. Project authenticated admission outcomes, execution receipts, checkpoint/rehydration state, transport/replay status, and reconciliation facts through optional structural capabilities; never infer success from send(), authorize a command, persist a session, or make Actor-Web a required runtime dependency.

## Acceptance criteria
- The adapter consumes the accepted versioned Actor-Web evidence contract through optional structural types without leaking the optional peer into shipped declarations.
- Admission accepted/rejected facts, execution success/timeout/retry/cancellation/authorization-failure/partial-failure receipts, and checkpoint/rehydration/reconciliation state remain correlated and provenance-bearing.
- Unknown versions, malformed evidence, stale revisions, sequence regressions, redacted principal data, and disconnected or unavailable evidence become explicit diagnostic projection facts.
- The existing snapshot, emitted-event, transport-status, shared-source ownership, isolated-source cleanup, and loose foreign-source compatibility contracts remain intact.
- Ignite command availability remains descriptive; execute-time policy and authorization stay entirely in Actor-Web and consumer-owned behavior.
- send() failure is not logged as the only observable outcome and optimistic projection cannot be mistaken for an authoritative execution receipt.
- Focused runtime, type-compatibility, lifecycle, replay-dedupe, and errors-as-data tests cover every new production path.
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
- packages/ignite-adapters/src/actor-web.ts
- packages/ignite-adapters/src/index.ts
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts
- packages/ignite-element/src/tests/adapters/ActorWebAdapter.test.ts

## Scope Amendments
- None.

## Implementation plan
- Add optional structural evidence source types that preserve the current loose peer boundary and exact source identity.
- Translate accepted admission receipt checkpoint replay and reconciliation envelopes into stable projection facts with errors-as-data dispositions.
- Integrate evidence subscription dedupe lifecycle and cleanup without changing shared-source ownership or isolated-source disposal.
- Add focused runtime type lifecycle failure and compatibility tests before any broader example changes.

## Verification plan
- Run the Actor-Web adapter runtime and canonical compatibility type tests.
- Exercise malformed unsupported stale duplicated disconnected and cleanup fixtures.
- Run package typecheck fas validate-task and fast verification incrementally then full verification at closeout.

## Risks
- A convenience mapping could accidentally authorize commands infer send success or persist session state inside Ignite.
- Optional peer types must not leak into shipped declarations and foreign barebones sources must remain compatible.
- Sequence dedupe must not hide conflicting receipts freshness gaps or reconciliation corrections.

## Dependencies
- Queue dependency: task-1785254928652 accepts the versioned consumer contract and source-of-truth matrix.
- Queue dependency: task-1784909335843 finalizes exact-source provisioning and native lifecycle conformance.
- External implementation gate: consume the accepted versioned Actor-Web fixture rather than a sibling checkout or unpublished inferred API.

## Open questions
- Whether Actor-Web exposes execution evidence through the source snapshot emitted events or a dedicated optional evidence subscription remains an architecture-task decision; prefer the smallest structural seam proven by the upstream fixture.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
