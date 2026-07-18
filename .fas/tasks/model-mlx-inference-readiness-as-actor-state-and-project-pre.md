# Complete the dynamic MLX tool-feedback loop and retain artifact revision history in the voice workbench

## Source
Created with `fas create-task` on 2026-07-13.

## Problem
The workbench currently proves model reachability and actor authorization, but it does not yet run a real capability-scoped tool-feedback loop. Tool manifests can become stale within a turn, mutation results are not returned to the model before completion, schema-valid but domain-invalid semantic nodes collapse into a generic rejection, and current artifact documents overwrite earlier revisions. Complete the example so an MLX model can choose currently authorized Ignite commands from getSchema(), observe structured tool and actor outcomes, self-correct accepted or rejected artifact proposals, and finish only after auditing the accepted actor state. Preserve immutable artifact snapshots for future undo and redo without adding undo or redo commands or UI in this slice.


## Acceptance criteria
- Each model round derives a fresh igniteTools(component) manifest from current actor state and exposes only currently authorized commands
- Mutation calls return structured tool and actor outcomes to the next model round, including validation and conflict rejection reasons
- The model receives the original prompt plus current accepted artifact context and can create or revise semantic nodes dynamically without prompt-specific mappings
- A mutation cannot complete in the same unobserved model round; the bounded loop gives the model an audit and correction round before completeResponse
- Create and revise transitions append immutable artifact revision snapshots while the current documents projection remains latest-only
- Model context excludes private revision history and includes only the current accepted artifact projection
- Focused tests prove dynamic capability refresh, rejected-proposal feedback, accepted-artifact self-correction, revision retention, and bounded completion
- The one-command MLX and browser launcher still works and a live prompt can produce a structured checklist artifact
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- examples/agents/voice-workbench/scripts/dev-with-mlx.mjs
- examples/agents/voice-workbench/scripts/dev-with-mlx.test.mjs
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/src/parity.tsx
- examples/agents/voice-workbench/src/parity.test.tsx
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/agent-loop.test.ts
- examples/agents/voice-workbench/src/projections.test.ts
- examples/agents/voice-workbench/src/voice.ts
- examples/agents/voice-workbench/src/voice.test.ts
- examples/agents/voice-workbench/src/domain.ts
- examples/agents/voice-workbench/src/domain.test.ts
- examples/agents/voice-workbench/src/agent-loop.ts

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-07-13
- Added paths: examples/agents/voice-workbench/scripts/dev-with-mlx.mjs, examples/agents/voice-workbench/scripts/dev-with-mlx.test.mjs, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/src/styles.ts, examples/agents/voice-workbench/src/parity.tsx, examples/agents/voice-workbench/src/parity.test.tsx, examples/agents/voice-workbench/README.md

- Type: consumer-test-coverage
- Added at: 2026-07-13
- Trigger: Parallel provider lifecycle changes the singleton component initial state used by existing first-party consumers.
- Reason: Seed model availability explicitly in every headless consumer instead of adding a test-only readiness bypass.
- Added paths: examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/projections.test.ts
- Evidence source: repo-search
- Evidence: repo-search | examples/agents/voice-workbench/src | rg found agent-loop.test.ts and projections.test.ts importing the shared session singleton and executing submitPrompt.
- Accuracy signal: direct-import-and-command-use

- Type: implementation-discovered
- Added at: 2026-07-13
- Trigger: review-feedback
- Reason: Removed the remaining browser-constructor injection while simplifying the Ignite actor command boundary.
- Added paths: examples/agents/voice-workbench/src/voice.ts, examples/agents/voice-workbench/src/voice.test.ts
- Evidence source: focused implementation review
- Evidence: focused implementation review | voice adapter now reads browser capability at its imperative boundary; tests stub browser globals
- Accuracy signal: Both paths are dirty and covered by the focused example test lane.

- Type: scope-refresh
- Added at: 2026-07-13
- Trigger: Live pure-core workbench validation
- Reason: The model boundary revealed that optional model titles must be normalized in the actor-owned domain before projections consume accepted artifacts.
- Added paths: examples/agents/voice-workbench/src/domain.ts, examples/agents/voice-workbench/src/domain.test.ts
- Evidence source: live-workbench
- Evidence: live-workbench | examples/agents/voice-workbench/src/domain.test.ts
- Accuracy signal: Reproduced by the live MLX tool call and guarded by the domain test.

- Type: scope-refresh
- Added at: 2026-07-13
- Trigger: Pure functional core review
- Reason: The model-turn generator replaces component injection in the browser orchestration boundary and is required by the approved actor-owned design.
- Added paths: examples/agents/voice-workbench/src/agent-loop.ts
- Evidence source: implementation-review
- Evidence: implementation-review | examples/agents/voice-workbench/src/agent-loop.ts
- Accuracy signal: No component or source imports remain in the model-turn core.

- Type: implementation-expansion
- Added at: 2026-07-13
- Trigger: Live checklist prompt exposed missing model tool-feedback and revision-history contracts
- Reason: The readiness UI is complete, but the example cannot prove dynamic IgniteTools projection until the model observes actor outcomes and can revise accepted state; retained snapshots are the minimal prerequisite for future undo and redo.
- Added paths: examples/agents/voice-workbench/src/domain.ts, examples/agents/voice-workbench/src/domain.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/agent-loop.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/README.md
- Evidence source: live-browser-and-headless-reproduction
- Evidence: live-browser-and-headless-reproduction | examples/agents/voice-workbench/src/main.tsx | A schema-valid checklist proposal was rejected by domain validation, while a live model prompt produced an accepted text node instead of the requested checklist.
- Accuracy signal: confirmed
- Follow-up needed: Design explicit undo and redo commands only after retained history is dogfooded.

## Implementation plan
- Add red tests for retained revision snapshots and a bounded multi-round model protocol
- Implement append-only artifact history in the pure domain reducer without widening the public command API
- Replace the one-shot model protocol with structured round observations and fresh capability manifests
- Update the MLX request contract and prompt so the model audits accepted actor state before completing
- Integrate the loop directly in the thin browser entrypoint using actor-owned igniteCore commands
- Update example documentation and verify headless, browser, and live MLX behavior

## Verification plan
- Run focused domain, session, agent-loop, model, and main entrypoint tests after each slice
- Run the example typecheck and test lane
- Run fas validate-task and fas verify --full
- Launch the one-command example and verify a checklist creation followed by a revision against the live MLX model

## Risks
- A small local model may need explicit structured feedback to self-correct without deterministic prompt mappings
- Actual OpenAI-compatible MLX tool-call message support may constrain how prior tool results are represented
- Revision history must remain actor-private so it does not bloat model context or accidentally become a new public API

## Dependencies
- None known at task creation.

## Open questions
- Undo and redo command semantics, branching, and UI remain a follow-up; this task only preserves immutable snapshots
- Future undo should likely create a new forward revision from a historical snapshot instead of mutating or deleting history

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
