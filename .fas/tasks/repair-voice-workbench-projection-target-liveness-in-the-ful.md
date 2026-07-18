# Repair Voice Workbench projection-target liveness in the full verification lane

## Source
Created with `fas create-task` on 2026-07-18.

## Problem
The root-owned full verification for boundary characterization exposed an untouched Voice Workbench projection test that does not complete within either the default 5-second timeout or an isolated 15-second timeout. Diagnose the real liveness/cleanup cause in the direct projection-target path; do not paper over it with a larger timeout. Restore deterministic completion and process cleanup so the isolated projection test and the full verification lane both pass. Keep this repair separate from the executable state-machine characterization commit.

## Acceptance criteria
- The isolated projections.test.ts receipt completes deterministically without increasing the timeout
- The test proves direct document and acknowledged-speech projection behavior and disposes every owned session/actor on success and failure
- The complete Voice Workbench suite passes without lingering workers or handles
- One fresh repo full-verification receipt is green and can close both this repair and task-1784298626529
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
- examples/agents/voice-workbench/src/projections.test.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/tests/projection-runtime.test.ts

## Reference files
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: root-cause-promotion
- Added at: 2026-07-18T15:20:00Z
- Trigger: Timed checkpoints localized the 6.2-second delay to the Ignite projection binder queue after all Voice Workbench commands completed in under 20ms.
- Reason: The binder serializes every historical snapshot inspection instead of coalescing superseded pending work. A test-only workaround would preserve the production liveness defect and violate the no-timeout-inflation criterion.
- Added paths: packages/ignite-element/src/IgniteElementFactory.ts, packages/ignite-element/src/tests/projection-runtime.test.ts
- Evidence source: isolated Vitest reproduction and source inspection
- Evidence: isolated Vitest reproduction and source inspection | examples/agents/voice-workbench/src/projections.test.ts | Default-timeout run reached turn completion at 18ms but speech acknowledgment at 6228ms; packages/ignite-element/src/IgniteElementFactory.ts owns the projection commit queue.
- Accuracy signal: A direct package-level burst test must fail before the fix and pass after coalescing, while existing ordering, at-most-once, and disposal tests remain green.
- Follow-up needed: Keep the public API and projection authority model unchanged; only queue scheduling semantics may change.

- Type: diagnostic-scope-demotion
- Added at: 2026-07-18T15:35:00Z
- Trigger: Timed checkpoints proved the Voice Workbench commands and state machines completed before the delayed projection acknowledgement.
- Reason: The session and component modules were inspected during diagnosis but need no implementation change after the defect was localized to Ignite's projection-target binder.
- Removed paths: examples/agents/voice-workbench/src/workbench-component.ts, examples/agents/voice-workbench/src/session.ts
- Evidence source: isolated default-timeout projection test
- Evidence: isolated default-timeout projection test | examples/agents/voice-workbench/src/projections.test.ts | All commands completed before the projection binder drained its historical snapshot queue.
- Accuracy signal: Implementation scope contains only the binder, its deterministic regression test, and the Voice Workbench lifecycle acceptance test.
- Follow-up needed: Keep the inspected Voice Workbench production modules unchanged.

- Type: reference-evidence-alignment
- Added at: 2026-07-18T15:35:00Z
- Trigger: FAS live ChangeSet classified pre-existing ignored curated-memory projections as untracked reference changes during closeout.
- Reason: Declare the existing local memory projections as reference evidence only so they remain preserved and cannot be mistaken for implementation drift.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: root closeout inspection
- Evidence: root closeout inspection | .fas/state/closeout-readiness/latest.json | Git check-ignore confirms the five paths are ignored local projections.
- Accuracy signal: Plan alignment reports zero unexpected implementation and reference files without staging generated memory.
- Follow-up needed: Do not edit, stage, or publish these memory projections as part of this task.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Blocks `task-1784298626529` closeout so both tasks can share one fresh green
  full-verification receipt.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
