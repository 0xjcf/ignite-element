# Build a retained real-time canvas stress example and conformance suite

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Build a self-contained Ignite example that dogfoods the retained ref/commit, keyed reconciliation, and move-safe lifecycle contracts using a real-time canvas backed by deterministic authoritative snapshots. Keep simulation clock and state authority separate from display interpolation. Demonstrate high-DPI responsive sizing, ResizeObserver cleanup, consumer-owned requestAnimationFrame drawing, scoped keyboard and pointer input, blur/visibility recovery, telemetry for source versus reconciliation versus draw cadence, and semantic DOM controls/status. Use the existing igniteCore callable registration shape and generic JSX ref/commit directives; do not introduce a scheduler config, canvas package, or game-specific core behavior.


## Acceptance criteria
- The example uses component("name", projection => <canvas ref={...} commit={...} />) and renders a responsive DPR-aware canvas without recreating its context during state changes or keyed reorders.
- Authoritative fixed-step snapshots remain separate from consumer-owned requestAnimationFrame interpolation; telemetry distinguishes source, reconciliation, commit, and draw cadence.
- Input is focus-scoped, prevents unintended page interaction where appropriate, clears held state on blur/visibility loss, and exposes keyboard-accessible DOM controls and status.
- ResizeObserver, animation-frame, input, ref cleanup, and retained-resource cleanup are proven across disconnect, reconnect, and same-tick moves.
- The dogfood records whether consumer-owned scheduling is sufficient and supplies measurements to task-1783719681572 without adding a public Ignite scheduler.
- Unit, renderer, browser, accessibility, and example runtime-test lanes are self-contained and included in test:examples/test:full coverage.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: keep simulation deterministic, keep time/DOM/input in the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in .fas/TASKS.md and queued in .fas/queue/tasks.json.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- examples/apps/retained-canvas
- scripts/test-examples.mjs
- package.json
- packages/ignite-element/src/testing.ts
- docs/retained-complex-interfaces.md

## Scope Amendments

- None.

## Implementation plan
- Create a self-contained example package with deterministic fixed-step source snapshots and a consumer-owned requestAnimationFrame presentation resource acquired through ref.
- Use only shipped ref/commit, keyed reconciliation, and lifecycle APIs; add DPR sizing, ResizeObserver, scoped input, recovery, telemetry, and semantic DOM companions.
- Add unit, renderer, browser, accessibility, move/reconnect, and example-lane tests with no live provider or network dependency.
- Wire the example into test:examples and test:full, document measured scheduling behavior, and complete full verification.

## Verification plan

- Run the example unit/runtime tests with fake clocks, resize, visibility, and animation frames.
- Run browser assertions for retained context identity, focus, input, accessibility, and cleanup.
- Run test:examples with coverage ownership, test:full, fas validate-task, and the full FAS verification lane.

## Risks

- A game-specific example can accidentally turn into framework API precedent.
- Real timers and browser size state can make CI flaky unless deterministically injected.
- Canvas-only visuals can hide accessibility and input regressions without semantic DOM companions.

## Dependencies
- Depends on keyed reconciliation task-1783719665018.
- Blocks Actor-Web Mesh Pong downstream validation task-1783719721452.
- Provides local dogfood evidence for scheduling-verdict task-1783719681572.

## Open questions
- Choose the smallest domain needed to stress the generic contract; it must not become a second Mesh Pong implementation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
