# Restructure voice-workbench lifecycle ownership and separate presentation state

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Replace the provider/turn parallel cross-product with the approved compound machine: Preparing and Unavailable are top-level lifecycle states, while Idle and Responding exist only inside Available. Preserve the pure conversation reducer as aggregate authority. Move draft, mobile-panel, artifact-view, runtime-preview, speech-preference and read-model receipt recording out of the authoritative session lifecycle graph through the smallest compatible presentation boundary. Keep this slice behavior-compatible apart from eliminating forbidden raw snapshots; the next task owns full async terminal/cancellation/timeout protocols.

## Acceptance criteria
- The executable XState shape matches the approved compound session diagram and the raw snapshot cannot represent preparing/responding or unavailable/responding.
- A MODEL_FAILED event from Available.Responding exits the Available compound state, prevents subsequent artifact/complete commands from being admitted, and records an explicit non-success outcome without fabricating response completion.
- The graph invariant suite from task-1784171355639 removes the temporary known-violation baseline and asserts zero forbidden reachable combinations.
- Conversation/artifact data continues to change only through reduceConversationSession or an equivalently pure reducer with optimistic revision and validation behavior preserved.
- Presentation-only selections and read-model receipts no longer dominate the authoritative lifecycle graph or compete with the session machine as lifecycle truth; the chosen ownership boundary is documented and tested.
- Raw machine snapshots remain available independently from prepared Ignite views, and view status cannot mask a forbidden raw state.
- The projection command schema distinguishes user/model intent from private adapter and read-model channels without adding getBlueprint(), public inspect(), or another public schema.
- Existing headless, browser, model-loop, domain, and example fast tests pass with focused new regression coverage.
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
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/main.test.tsx

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
- Epic: `epic-voice-workbench-statechart-conformance` (`lifecycle-ownership`).
- Depends on: `task-1784171355639`.
- Blocks: `task-1784171467799`.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
