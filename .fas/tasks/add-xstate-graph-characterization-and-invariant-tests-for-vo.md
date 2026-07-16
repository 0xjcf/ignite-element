# Add XState graph characterization and invariant tests for voice-workbench

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Use the canonical contracts and fresh actor factory from task-1784171303126. Add direct tests with the XState 5 xstate/graph entrypoint before production restructuring. Characterize the current six reachable provider/turn values and the two known forbidden responding combinations, encode reusable invariant predicates and named event paths, and keep the task green with an explicit reviewed known-violation baseline that the next structural task must reduce to zero. Bound traversal so growing context cannot create an unbounded graph.

## Acceptance criteria
- Tests import getShortestPaths, getSimplePaths, getPathsFromEvents and/or createTestModel from xstate/graph; they do not add deprecated @xstate/graph or a custom traversal engine.
- Payload-bearing events, state serialization, traversal limits, and exclusions are explicit and deterministic.
- The suite proves all expected current state values are reachable, detects exactly the reviewed forbidden preparing/responding and unavailable/responding combinations, and fails on unreviewed graph drift.
- Named paths cover provider ready, provider failure, retry, prompt admission, artifact mutation, accepted completion, and current failure recovery.
- The invariant harness operates on raw XState snapshots rather than the derived Ignite status view.
- The known-violation baseline is clearly marked temporary and names task 3 as the owner that must flip the forbidden count to zero; no skipped, todo, or intentionally failing test is left behind.
- No new Ignite public API, schema field, recorder, or matcher is added.
- Focused graph tests and the voice-workbench fast verification lane pass.
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
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/session.ts

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
- Epic: `epic-voice-workbench-statechart-conformance` (`graph-characterization`).
- Depends on: `task-1784171303126`.
- Blocks: `task-1784171435029`.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
