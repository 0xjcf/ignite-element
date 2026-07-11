# Honor Ignite JSX keys and preserve retained interface nodes during reconciliation

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Implement key-aware Ignite JSX normalization and reconciliation so retained interface nodes preserve identity across insertions, removals, and reorders. Integrate the retained-node lifecycle contract from the preceding task, preserve focus, selection, canvas/WebGL context identity, and editor-style imperative state, and define deterministic duplicate-key and mixed keyed/unkeyed behavior. Keep positional reconciliation as the compatible unkeyed path and retain explicit fallback diagnostics.

## Acceptance criteria

- JSX keys survive normalization and drive child identity without leaking as DOM attributes.
- Keyed insert, remove, and reorder operations reuse the correct DOM nodes and invoke retained-node cleanup only for genuinely removed or replaced nodes.
- Focus, input selection, canvas context identity, and event handler updates survive representative keyed reorders.
- Duplicate keys and mixed keyed/unkeyed children follow a documented deterministic policy with development diagnostics and safe fallback behavior.
- Behavior, regression, type, and benchmark-oriented tests cover keyed and unkeyed paths without regressing existing diff semantics.
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

- packages/ignite-renderer/src/renderers/jsx/types.ts
- packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts
- packages/ignite-renderer/src/renderers/jsx/renderer.ts
- packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- packages/ignite-element/src/tests/renderers/diffing.behavior.test.ts
- packages/ignite-element/src/tests/renderers/renderer.behavior.test.ts

## Scope Amendments

- None.

## Implementation plan

- Write failing keyed insert, remove, reorder, duplicate-key, mixed-key, focus, selection, event-handler, and retained-context tests.
- Carry keys into normalized nodes and implement deterministic keyed child matching while preserving the existing unkeyed positional path.
- Integrate retained-node cleanup with genuine removal and replacement only, plus explicit fallback diagnostics.
- Benchmark representative lists and retained surfaces, document semantics, add changesets, and complete full verification.

## Verification plan

- Run focused renderer behavior and diffing tests for keyed and unkeyed paths.
- Run typecheck and package build to validate JSX key typing and public declarations.
- Run fas validate-task, full FAS verification, and committed review.

## Risks

- Incorrect identity matching can attach state or handlers to the wrong node.
- Fallback replacement can silently destroy canvas/editor state.
- Duplicate or mixed keys need deterministic handling to avoid nonlocal reconciliation bugs.

## Dependencies

- Depends on retained-node lifecycle task-1783719649309.
- Blocks commit-scheduling task-1783719681572.

## Open questions

- Resolve duplicate-key and mixed keyed/unkeyed policy from the accepted architecture rather than inventing it during implementation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
