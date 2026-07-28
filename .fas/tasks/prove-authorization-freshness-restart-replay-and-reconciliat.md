# Prove authorization freshness, restart, replay, and reconciliation conformance

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Add fixture-backed conformance that proves Ignite remains an honest projection when Actor-Web authority changes between discovery and execution, when sessions restart or rehydrate, and when transport replay or reconciliation produces delayed, duplicated, conflicting, or partial evidence. Test the neutral contract independently from a live sibling checkout and keep irreversible effects owned by the Actor-Web fixture runtime.

## Acceptance criteria
- A projected available capability that becomes stale before execution is rejected by the authoritative actor and Ignite projects the rejection without claiming success.
- Schema-admitted data that is not domain-accepted or execution-authorized remains visibly distinct in snapshots, views, events, Story evidence, and diagnostics.
- Fixtures cover success, timeout, retry, cancellation, authorization failure, stale artifact or plan revision, partial failure, disconnected evidence, and later reconciliation.
- Checkpoint and rehydration tests preserve correlation, attempt, sequence, revision, and receipt identity across restart without replaying an irreversible effect twice.
- Replay and reconciliation tests tolerate duplicate transport delivery while surfacing sequence regressions, conflicting receipts, unknown causality, and freshness gaps honestly.
- Actor-Web execution receipts and Ignite Story traces remain separate artifacts joined by explicit keys; neither is synthesized from the other.
- Conformance fixtures are versioned, JSON-safe, provider-neutral, and runnable without a live Actor-Web service or sibling repository.
- Focused headless, adapter, type, replay, lifecycle, and failure-path tests pass with no new public Ignite API.
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
- packages/ignite-element/src/tests/adapters/ActorWebAdapter.test.ts
- packages/ignite-adapters/src/__tests__
- test/fixtures/actor-web-evidence
- docs/actor-web-evidence-governed-projections.md

## Scope Amendments
- None.

## Implementation plan
- Build provider-neutral versioned fixtures for admission execution checkpoint restart replay and reconciliation outcomes.
- Write failing conformance tests for stale availability authorization failure revision conflict duplicate delivery sequence regression and irreversible-effect replay safety.
- Exercise the optional adapter and headless Story surfaces while preserving separate upstream receipt and Ignite trace artifacts.
- Publish fixture semantics and coverage dispositions for downstream Voice Workbench dogfood.

## Verification plan
- Run the focused adapter headless replay lifecycle and type lanes against every versioned fixture.
- Prove fixtures run with no live Actor-Web service sibling checkout network or clock dependence.
- Run fas validate-task fast verification and the full repository gate before closeout.

## Risks
- Fixtures that implement business logic would become a second Actor-Web runtime; keep them bounded evidence producers only.
- Replay dedupe can conceal conflicts unless sequence regression and incompatible receipt cases remain visible.
- Do not promote test-only receipt vocabulary to public Ignite API without dogfood evidence.

## Dependencies
- Queue dependency: task-1785254961929 implements the accepted optional adapter projection.
- The task consumes versioned fixtures accepted by the architecture contract and blocks Voice Workbench dogfood task-1785255004194.

## Open questions
- None blocking; the planner must record any upstream fixture fields that remain unavailable and fail closed instead of inventing values.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
