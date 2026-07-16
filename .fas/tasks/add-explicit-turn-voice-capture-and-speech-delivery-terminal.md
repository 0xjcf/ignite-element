# Add explicit turn, voice-capture, and speech-delivery terminal lifecycles

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Complete the lifecycle architecture after provider/turn restructuring. Make the outer model/capability round loop an invoked child actor or machine that owns request, evaluation, authorization, capability execution, round count, cancellation, timeout, exhaustion, and exactly one terminal result while retaining modelTurn() as pure one-round policy. Formalize browser voice capture and speech delivery as child lifecycles with imperative ports and serializable facts. Replace shell-owned watcher orchestration and synthetic COMPLETE_RESPONSE failure recovery with explicit typed events.

## Acceptance criteria
- The parent session handles distinct TURN_COMPLETED, TURN_FAILED, CANCELLED, TIMEOUT, and ROUND_LIMIT_REACHED outcomes; a failed/cancelled/timed-out turn returns to the appropriate idle/unavailable state without emitting response-completed.
- The model-turn child owns the six-round limit, model requests, domain authorization, capability execution, feedback/history, cancellation, timeout, stale-result rejection, and exactly-once terminal emission while reusing pure modelTurn policy.
- Voice capture has one executable statechart/transition table covering support check, idle, listening, interim transcript, final transcript, consume, cancel, permission denial, failure, end, reset, retry, and dispose behavior.
- Speech delivery distinguishes pending, muted, queued, delivered, unavailable, failed, cancelled, and transport-neutral acknowledgement; speechSynthesis.speak() alone never records delivered/played.
- Browser APIs, model HTTP, capability providers, clocks, and abort controllers remain ports in the imperative shell; expected failures cross actor boundaries as typed facts instead of throws.
- Each async request carries an attempt/turn identity so stale callbacks cannot mutate a newer lifecycle; cancellation and disposal are idempotent.
- Public Ignite commands represent user or authorized domain intent; adapter completions and internal read-model receipts use private actor event/port channels.
- Graph/model tests prove every terminal and recovery path, forbidden command admission, retry bounds, and agreement between raw snapshots and derived views; focused and full example verification pass.
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
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/voice.ts
- examples/agents/voice-workbench/src/domain.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/voice.test.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
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
- Epic: `epic-voice-workbench-statechart-conformance` (`terminal-lifecycles`).
- Depends on: `task-1784171435029`.
- Blocks: `task-1784171502136`.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
