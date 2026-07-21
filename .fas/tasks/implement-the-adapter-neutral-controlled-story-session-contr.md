# Implement the Ignite Alchemy adapter-neutral controlled Story session controller

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Implement the production Ignite Alchemy controller around approved shared Story callbacks and the existing igniteTest component story executor. Gate before each Given, Intent, Behavior, and Checkpoint page; release exactly one page per Step; and project transient reviewer facts without creating another receipt or runtime authority. Model explicit session lifecycle states, use generation tokens to suppress stale async updates, coordinate abortable fixture disposal before replacement, and implement Back only as dispose, rebuild, and controlled replay. Return the ordinary final IgniteStorySnapshot only after Story completion and remain useful without XState.


## Acceptance criteria
- Run executes every remaining page through the existing igniteTest Story callback and returns the ordinary IgniteStorySnapshot receipt.
- The controller gates before each page, and Step releases exactly one Given, Intent, Behavior, or Checkpoint page before pausing ahead of the next page.
- Session state explicitly distinguishes idle, running, paused, replaying, disposing, completed, failed, and cancelled; control availability is derived from that state.
- Completed page outcomes expose phase, status, assertions, current snapshot, semantic view, command availability, and timing as transient reviewer telemetry, never as an intermediate IgniteStorySnapshot.
- Cancel rejects or releases the gated callback safely and disposes the fixture, Story subscriptions, timers, pending behaviors, and adapter resources exactly once.
- Restart always constructs a fresh fixture and begins again at the opening page with no retained runtime state.
- Cancel, Restart, Back, and Story replacement advance a generation token so late promises, observations, and subscriptions from an obsolete session cannot update the active session.
- A replacement fixture is not constructed until prior gates, behaviors, actor work, subscriptions, timers, ports, and disposal have settled or aborted.
- Back disposes the current fixture, rebuilds, and replays deterministically to the selected prior page; no snapshot mutation, event injection, or history rewind shortcut is used.
- Semantic replay equivalence ignores wall-clock duration and compares stable Story receipts, page outcomes, views, availability, and controlled-clock evidence.
- The controller works with an adapter-neutral IgniteAgentRuntime and produces a useful session without an XState lens.
- No public Ignite API, package entrypoint, recorder, or trace type is added.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Implement a small example-local session state machine and gate protocol around a decorated Story context, while the existing igniteTest story call remains the only executor and receipt producer.
- Publish immutable transient session facts after each completed page and use a monotonic generation to reject stale async updates.
- Centralize idempotent abort and disposal, then implement Restart and Back as new-session construction after teardown; Back automatically replays completed pages and pauses before the requested boundary.

## Alternatives considered
- Rejected modifying igniteTest, adding a second Story runner, or snapshotting partial receipts.
- Rejected in-place rewind, actor state mutation, private event injection, retained fixtures, and concurrent replacement sessions.
- Rejected importing XState into the base controller; optional observations join downstream.

## Affected files
- examples/agents/voice-workbench/src/story-workbench/controller.ts
- examples/agents/voice-workbench/src/story-workbench/controller.test.ts
- examples/agents/voice-workbench/src/story-workbench/types.ts

## Scope Amendments
- None.

## Implementation plan
- Define lifecycle states, control availability, generation rules, transient page facts, and a gate-before-page protocol around the existing Story context methods.
- Implement Run and Step with exactly-once page release and transient reviewer state.
- Implement Cancel and Restart with abortable exactly-once teardown, stale-update suppression, and fresh fixture creation only after disposal.
- Implement Back exclusively as dispose, rebuild, and deterministic replay to the requested page.
- Add adapter-neutral tests with and without optional observation data.

## Verification plan
- Prove Run, single-step gating, double-step prevention, cancel, restart, backward replay, failure cleanup, and ordinary completion in focused tests.
- Compare stable receipts and semantic outcomes across repeated controlled replays while excluding wall-clock timing.
- Run Voice Workbench tests and typecheck, fas validate-task, and the final full lane.

## Risks
- Paused callbacks or external behaviors can deadlock cancellation unless gates and fixture aborts are coordinated.
- Late page completions or observations can corrupt a new run unless every publication is generation-scoped.
- Back replay can duplicate effects if fixture disposal or controlled-port reset is incomplete.
- Controller state could become an accidental second runtime or trace if it persists more than reviewer-session facts.

## Dependencies
- Depends directly on shared Story and fixture task-1784602854408.
- Depends directly on approved implementation handoff task-1784655432373.
- Blocks application task-1784602901002 together with the optional XState lens.

## Open questions
- The handoff may refine presentation names for lifecycle states, but the controller contract and serialized reviewer facts remain literal and adapter-neutral.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
