# igniteTools showcase Phase B — headless smart-home agent example (pure Node, no jsdom) stressing the full agent API to catch gaps

## Source
Created with `fas create-task` on 2026-06-26.

## Problem
Build examples/agents/smart-home: a canonical smart-home ignite component (virtual devices: lights, thermostat, locks, blinds, scenes) driven by an igniteTools loop with a pluggable model (a scripted key-free mock plus a real @anthropic-ai/sdk model). Replaces and retires the earlier counter example (examples/agents/anthropic-tool-use). Runs in PURE NODE with zero jsdom — this is the end-to-end proof of Phase A's DOM-free runtime. Render the home state and the agent act-observe-act trace in the terminal. GAP-CATCHING is the primary goal, not just a demo: exercise enum, scalar, object, array, and no-arg command inputs through the anthropic adapter (broad manifest/schema coverage); add async scenes that transition over ticks to probe the act+ack vs event/view-stream observation contract (this directly feeds the deferred observe()/settle decisions); design at least one command whose availability depends on state (e.g. cannot run the away scene while a door is unlocked) to surface the unimplemented canExecute gating gap; cover error/invalid-input paths. Record every gap found in examples/agents/smart-home/GAPS.md (and promote durable ones to memory). Depends on Phase A (the headless runtime must be DOM-free first).

## Acceptance criteria
- a smart-home ignite component with at least 5 commands spanning scalar, enum, object, and no-arg inputs, plus domain events and a device-grid view
- an igniteTools loop with a scripted key-free model and a real @anthropic-ai/sdk model (pluggable seam)
- runs in pure Node with zero jsdom — proving Phase A end to end
- a runnable, asserted scripted test of the full loop (round-trip + scalar unwrap + error path)
- a terminal render of the home state and the agent trace
- a GAPS.md capturing every agent-API gap found (canExecute/gating, observation/ack timing, schema coverage, errors)
- the counter example (examples/agents/anthropic-tool-use) retired
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
- .changeset/ignitetools-view-in-observation.md
- .github/workflows/ci.yml
- package.json
- docs/ignite-tools.md
- packages/ignite-element/src/tests/tools.anthropic.test.ts
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/types/tools.types.test.ts
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/tools/types.ts
- examples/agents/smart-home/package.json
- examples/agents/smart-home/tsconfig.json
- examples/agents/smart-home/vite.config.ts
- examples/agents/smart-home/README.md
- examples/agents/smart-home/GAPS.md
- examples/agents/smart-home/src/home.ts
- examples/agents/smart-home/src/agentLoop.ts
- examples/agents/smart-home/src/model.ts
- examples/agents/smart-home/src/render.ts
- examples/agents/smart-home/src/mock.ts
- examples/agents/smart-home/src/anthropic.ts
- examples/agents/smart-home/src/agentLoop.test.ts

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
