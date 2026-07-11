# Build a retained real-time canvas stress example and conformance suite

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Build a self-contained Ignite example that stress-tests the retained-surface, keyed reconciliation, lifecycle, and commit-scheduling contracts using a real-time canvas backed by deterministic authoritative snapshots. Keep the simulation clock and state authority separate from display interpolation. Demonstrate high-DPI responsive sizing, ResizeObserver cleanup, requestAnimationFrame interpolation, scoped keyboard and pointer input, blur/visibility recovery, telemetry for source versus render cadence, and semantic DOM controls/status alongside the canvas. The example must exercise generic Ignite APIs rather than introduce a canvas package or game-specific core behavior.

## Acceptance criteria

- The example renders a responsive device-pixel-ratio-aware canvas without recreating its context during ordinary state changes or keyed layout reorders.
- Authoritative fixed-step snapshots remain separate from requestAnimationFrame interpolation, and telemetry reports source cadence, commit cadence, coalesced commits, and retained-node lifecycle.
- Input is focus-scoped, prevents unintended page interaction where appropriate, clears held state on blur/visibility loss, and exposes keyboard-accessible DOM controls and status.
- ResizeObserver, animation-frame, input, and retained-resource cleanup are proven across disconnect, reconnect, and same-tick moves.
- Unit, renderer, browser, accessibility, and example runtime-test lanes are self-contained and included in test:examples/test:full coverage.
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

- examples/apps/retained-canvas
- scripts/test-examples.mjs
- package.json
- packages/ignite-element/src/testing.ts
- docs/retained-complex-interfaces.md

## Scope Amendments

- None.

## Implementation plan

- Create a self-contained example package with deterministic fixed-step source snapshots and a separate requestAnimationFrame presentation loop.
- Use only the shipped retained-node, keyed reconciliation, lifecycle, and commit-scheduling APIs; add DPR sizing, ResizeObserver, scoped input, recovery, telemetry, and semantic DOM companions.
- Add unit, renderer, browser, accessibility, move/reconnect, and example-lane tests with no live provider or network dependency.
- Wire the example into test:examples and test:full, document the pattern, and complete full verification.

## Verification plan

- Run the example unit/runtime tests with fake clocks, resize, visibility, and animation frames.
- Run browser assertions for retained context identity, focus, input, accessibility, and cleanup.
- Run test:examples with coverage ownership, test:full, fas validate-task, and the full FAS verification lane.

## Risks

- A game-specific example can accidentally turn into framework API precedent.
- Real timers and browser size state can make CI flaky unless deterministically injected.
- Canvas-only visuals can hide accessibility and input regressions without semantic DOM companions.

## Dependencies

- Depends on commit-scheduling task-1783719681572.
- Blocks Actor-Web Mesh Pong downstream validation task-1783719721452.

## Open questions

- Choose the smallest domain needed to stress the generic contract; it must not become a second Mesh Pong implementation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
