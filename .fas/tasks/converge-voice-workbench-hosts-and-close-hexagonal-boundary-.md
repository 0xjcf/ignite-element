# Converge Voice Workbench hosts and close hexagonal boundary conformance

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Finish browser, terminal, parity, and headless composition around the framework-neutral actor/application core and replaceable adapters. Remove the reviewed architecture-violation baseline and require zero violations. Refresh the Mock Studio implementation receipt and README architecture map, then prove graph, command, view, fact, failure, cleanup, replay, accessibility, responsive parity, and end-to-end behavior without restoring duplicate authority.

## Acceptance criteria
- Browser and terminal roots own environment configuration and adapter wiring only; headless execution requires neither DOM nor Ignite component authority.
- Every production module satisfies the approved layer manifest with zero reviewed forbidden imports or globals.
- Statechart graph tests still prove all required reachable, terminal, cancellation, timeout, retry, stale-receipt, and recovery paths with zero forbidden states.
- Browser, terminal, parity, and headless consumers observe equivalent accepted actor facts and renderer-neutral views while preserving host-specific effects.
- Mock Studio state-to-screen, accessibility, responsive, replay, error, and recovery receipts are refreshed for affected states, with unchanged visual surfaces explicitly reused rather than needlessly redesigned.
- Focused example verification, architecture checks, full repository verification, independent review, and epic dependency reconciliation pass.
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
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/terminal.ts
- examples/agents/voice-workbench/src/parity.tsx
- examples/agents/voice-workbench/src/headless-proof.ts
- examples/agents/voice-workbench/src/workbench-runtime.ts
- examples/agents/voice-workbench/README.md
- .mock-studio/voice-text-workbench/mock-studio-handoff.md
- .mock-studio/voice-text-workbench/approval.md
- .mock-studio/voice-text-workbench/receipts
- .fas/architecture-rules.json
- .fas-config.json

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
