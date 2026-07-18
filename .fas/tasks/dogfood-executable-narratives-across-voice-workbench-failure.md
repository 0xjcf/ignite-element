# Dogfood executable narratives across Voice Workbench failure and recovery paths

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Use the new multi-step igniteTest narrative helper in Voice Workbench to turn the approved behavior handoff into executable user, system, and projection narratives. Cover preparation failure and retry, microphone permission denial with text recovery, turn cancellation, timeout and retry, stale correlated receipts, artifact revision conflicts, and speech-unavailable recovery. Each narrative must preserve actor and adapter authority, drive typed intents through Ignite, keep external outcomes in consumer-owned fixtures, assert semantic projection checkpoints, and emit portable Story evidence suitable for review and coverage reporting.

## Automation admission
- Expected operator value: Improves operator leverage around "Dogfood executable narratives across Voice Workbench failure and recovery paths" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- Voice Workbench defines named executable narratives for preparation failure and retry, permission denial and text recovery, cancellation, timeout and retry, stale correlated receipts, artifact revision conflicts, and speech-unavailable recovery.
- Every narrative identifies its initial situation, typed user or system intents, externally driven facts, named semantic checkpoints, forbidden outcomes, recovery affordance, and final outcome.
- Narratives exercise the approved parent and child state-machine contracts without bypassing guards, correlation, authorization, reducers, or host adapter boundaries.
- Ignite commands remain intent inputs, actor and adapter receipts remain facts, and narrative code does not create a second behavior authority or graph model.
- Each narrative returns portable Story evidence and contributes to a coverage matrix mapping narrative, commands, actor paths, receipts, view facts, and verified channels.
- Headless narrative evidence is proven before rendered DOM and accessibility assertions; browser, terminal, and speech checks remain separate channel receipts over the same semantic outcomes.
- The dogfood records concrete helper friction, missing diagnostics, or evidence-envelope needs for the downstream ergonomics audit rather than expanding the public API in this task.
- Focused Voice Workbench graph, headless, runtime, projection, parity, accessibility, cleanup, and type checks pass.
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
- .mock-studio/voice-text-workbench/mock-studio-handoff.md

## Scope Amendments
- None.

## Implementation plan
- Read the approved Gate 0 handoff and boundary-characterization receipts, then define the bounded narrative catalog and coverage matrix.
- Write failing narrative tests for each required failure and recovery path using fresh isolated runtimes and consumer-owned host fixtures.
- Implement only example and fixture changes needed to express the narratives; do not widen Ignite public APIs in this dogfood task.
- Capture Story snapshots, named checkpoint diagnostics, channel evidence, and friction notes for the downstream ergonomics audit.
- Update Voice Workbench documentation with the executable narrative catalog and evidence commands.

## Verification plan
- Run the Voice Workbench focused test, typecheck, build, headless proof, graph, parity, and accessibility lanes used by the affected narratives.
- Run package testing tests only when dogfood requires fixture-level changes outside the example.
- Run fas validate-task and fast verification during implementation.
- Run full verification and committed review before closeout.

## Risks
- Do not disguise host permission, provider, timeout, or receipt facts as Ignite commands.
- Do not assert user-visible UI for internal reliability states unless a semantic projection intentionally exposes them.
- Do not let narrative fixtures bypass correlation, stale-receipt, retry, or authorization behavior.
- Keep coverage evidence additive to XState graph tests and existing Story traces rather than replacing them.

## Dependencies
- Depends on task-1783810065213 for the narrative helper and task-1784298626529 for approved executable Voice Workbench behavior boundaries.
- Blocks task-1783610933373 so the ergonomics audit evaluates real narrative dogfood rather than the earlier workbench baseline.

## Open questions
- Whether named checkpoint receipts belong only in diagnostics and the coverage matrix or justify a future public narrative-receipt envelope; record evidence without deciding here.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
