# Design retained-surface lifecycle and projection-commit contract for complex interfaces

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Define the Ignite-owned architecture for retained imperative presentation surfaces such as canvas, WebGL, editors, maps, video, and high-frequency dashboards. Compare callback refs, renderer commit directives, lifecycle resources, and first-party projection-target approaches against the current igniteCore and Ignite JSX contracts. Preserve source/view/commands/events/effects semantics, keep effects consequence-oriented, keep Actor-Web authoritative for runtime and simulation, and avoid a canvas-specific core API or a generic multi-source state owner.

## Acceptance criteria

- An accepted design records the public and private API shape, ownership boundaries, compatibility strategy, and rejected alternatives.
- A conformance matrix covers initial mount, repeated commits, node replacement, keyed reorder, same-tick DOM moves, true disconnect, reconnect, callback errors, async cleanup, and SSR/headless absence of DOM globals.
- The design specifies how commit scheduling preserves latest-snapshot rendering, command/event delivery, effect ordering, and deterministic testing.
- The design explicitly keeps game loops, physics, Actor-Web transport startup, multi-actor lifecycle truth, and advisory policies outside Ignite.
- The plan defines package-level rollout, changeset strategy, verification lanes, and downstream Mesh Pong validation without source edits in actor-web.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- docs/retained-complex-interfaces.md
- packages/ignite-renderer/src/renderers/jsx
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/igniteCore

## Scope Amendments

- None.

## Implementation plan

- Read the final v3 source/view/commands/effects, renderer, move-safe lifecycle, projection-target, and accessibility contracts after the stable cut.
- Compare callback refs, commit directives, component lifecycle resources, renderer hooks, and projection targets against the same conformance matrix.
- Choose the smallest additive generic contract, record rejected alternatives and non-goals, then split the approved rollout across the existing epic tasks.
- Run the architecture check and refresh affected paths before handing the task to implementation.

## Verification plan

- Run fas validate-task for task/brief/queue consistency.
- Run the architect check against the accepted design and package boundaries.
- Validate all referenced APIs and examples against the post-stable source tree; no production-code verification claim is required for this design-only task.

## Risks

- A canvas-specific helper would narrow the abstraction and fail editors, maps, WebGL, and video.
- Treating rendering as an effect could break initial commit and effect-ordering semantics.
- A public scheduler or lifecycle API chosen before the post-stable contract settles could create avoidable compatibility debt.

## Dependencies

- No upstream queue dependency: this is the critical independent next slice and may start as soon as the current processing task releases the single-task runtime slot.
- Blocks retained-node lifecycle task-1783719649309; the remaining epic tasks preserve the explicit sequential dependency graph.
- Does not depend on or block stable v3 release tasks.
- Actor-Web Mesh Pong is read-only downstream evidence, not an Ignite implementation dependency.

## Open questions

- The exact retained-node API name and whether scheduling belongs on component registration or renderer configuration are decisions for this architecture task.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
