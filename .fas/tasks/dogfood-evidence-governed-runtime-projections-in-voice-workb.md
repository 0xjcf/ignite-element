# Dogfood evidence-governed runtime projections in Voice Workbench

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Dogfood the accepted Actor-Web execution-evidence projection through the framework-neutral Voice Workbench command/read-model port after hexagonal host convergence. Show a model proposal moving through descriptive capability discovery, authoritative actor admission, external effect receipts, durable session recovery, and truthful Ignite projection without making the component, Story recorder, or model loop an execution authority. Produce the upstream evidence needed before Ignite Alchemy closes its broader dogfood gaps.

## Automation admission
- Expected operator value: Improves operator leverage around "Dogfood evidence-governed runtime projections in Voice Workbench" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- Browser, terminal, and headless hosts observe equivalent accepted and rejected actor facts while preserving host-specific effects and without requiring Ignite for execution.
- The workbench visibly distinguishes schema-admitted, domain-accepted, execution-authorized, effect-pending, succeeded, failed, retrying, cancelled, rehydrating, reconciling, and stale states where they are user-relevant.
- A capability projected as available can be rejected after principal, approval, policy, or revision freshness changes; recovery follows actor facts rather than optimistic UI state.
- Timeout, retry, cancellation, partial failure, restart, replay, and reconciliation preserve source-owned correlation and receipt identity and do not duplicate irreversible outputs.
- Ignite Story snapshots retain projection and narrative evidence while linking, not copying, Actor-Web execution receipts.
- The dogfood emits a versioned, redacted, JSON-safe ecosystem evidence fixture consumable by FAS optional adapters without importing FAS at runtime.
- Accessibility, focus, keyboard, responsive, no-DOM headless, cleanup, graph, replay, and source-ownership checks cover the newly projected states.
- Any missing public Ignite capability is recorded as evidence for the verdict task rather than added during dogfood.
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
- examples/agents/voice-workbench/src
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/test/fixtures
- docs/actor-web-evidence-governed-projections.md

## Scope Amendments
- None.

## Implementation plan
- Bind the accepted evidence projection through the framework-neutral actor command/read-model port after Voice Workbench host convergence.
- Add deterministic actor and effect fixtures for stale authorization timeout retry cancellation restart replay partial failure and reconciliation.
- Project only user-relevant semantic states across headless terminal and browser consumers and preserve Story versus Actor-Web receipt provenance.
- Emit the redacted versioned ecosystem fixture and record any public-surface friction for the verdict task.

## Verification plan
- Run Voice Workbench graph headless runtime projection terminal browser parity accessibility cleanup replay and type lanes.
- Verify the same accepted and rejected actor facts across hosts and no duplicated irreversible output after restart or replay.
- Run fas validate-task fast verification during implementation and full verification plus independent review before closeout.

## Risks
- Do not let JSX Story recording model code or capability manifests become execution or authorization authority.
- Avoid surfacing internal reliability states as user-facing UI unless the semantic read model intentionally exposes them.
- Redact principal and provider data while preserving correlation provenance and freshness evidence needed by FAS.

## Dependencies
- Queue dependency: task-1785254980835 proves neutral authorization restart replay and reconciliation conformance.
- Queue dependency: task-1784298700854 closes the framework-neutral Voice Workbench host boundary.
- Blocks task-1784602955608 so Ignite Alchemy consumes proven shared runtime-evidence behavior rather than duplicating it.

## Open questions
- Which evidence states are user-visible versus diagnostics-only must be decided from the accepted Voice Workbench semantic view and Mock Studio handoff during planning.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
