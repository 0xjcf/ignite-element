# BREAKING (v3 cutover): canonical flat tagged event { type, ...fields } across emit/observe/expectEvent per docs/event-sh

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Implement docs/event-shape.md. emit unifies on the single-object member form { type, ...fields } (drop positional emit(type,payload)); observe pipeline (on / execute().events / record) delivers the flat member and DROPS the { type, payload } envelope + doubled type; getSchema event descriptors become the flat member shape; expectEvent takes the member object; EmitFromEvents typing infers fields from the Events map. BREAKING — the observe shape is the agent contract. MUST land in the SAME pre-stable beta as the view-context and expectState-rename tasks, with ONE coordinated goodway migration note. Refine the adapter subscribeEvents bridge + exact scope at planning. Decision locked 2026-06-18. Design: docs/event-shape.md.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-element/src/RenderArgs.ts
- packages/ignite-element/src/runtime/effects.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/runtime/schema.ts
- packages/ignite-element/src/testing.ts
- .changeset/event-shape.md

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
