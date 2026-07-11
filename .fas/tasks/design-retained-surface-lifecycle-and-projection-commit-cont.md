# Define retained-surface ref and commit contract for complex interfaces

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Define the Ignite-owned architecture for retained imperative presentation surfaces such as canvas, WebGL, editors, maps, video, and high-frequency dashboards using the existing two-stage igniteCore API. The target JSX shape is component("name", projection => <canvas ref={acquireResource} commit={(canvas) => draw(canvas, projection)} />): ref acquires the stable node and may return cleanup; commit is a reserved renderer directive that runs after reconciliation and ref acquisition without becoming a DOM property or attribute. Preserve source/view/commands/events/effects semantics, keep Actor-Web authoritative for runtime and simulation, and explicitly keep commit scheduling out of igniteCore until downstream dogfood demonstrates a framework-owned need.


## Acceptance criteria
- The accepted design uses the current igniteCore({ source, view, commands, events, effects }) return value and component("name", renderer) registration shape, with the existing non-JSX projection-target overload kept separate.
- Ignite JSX reserves typed ref and commit directives; ref may return cleanup, commit receives the retained node while its callback closes over the current projection, and neither directive leaks to the DOM.
- The lifecycle contract defines ordering and exactly-once behavior for initial mount, repeated commits, ref identity changes, keyed moves, replacement, true disconnect, reconnect, callback errors, async cleanup, and SSR/headless execution.
- The design adds no commitScheduling option or other scheduler surface to igniteCore; consumers own requestAnimationFrame or microtask coalescing inside their retained resource until evidence supports a registration-level policy.
- The design preserves command and event delivery, effects ordering, deterministic testing, source authority, and Actor-Web ownership while rejecting canvas-specific helpers and DOM-owned simulation state.
- docs/retained-complex-interfaces.md records the accepted API, ownership matrix, compatibility strategy, rejected alternatives, downstream rollout, and scheduler evidence gate using source-verified examples.
- The work is tracked in .fas/TASKS.md and the downstream queue graph is reconciled to collect dogfood evidence before any scheduling API decision.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Preserve the current two-stage API and add only renderer-owned JSX directives:

  ```tsx
  const component = igniteCore({ source, view, commands, events, effects });

  component("pong-game", ({ frame }) => (
    <canvas
      ref={retainCourt}
      commit={(canvas) => drawPong(canvas, frame)}
    />
  ));
  ```

- `ref` owns acquisition and may return cleanup. `commit` receives the retained node after reconciliation and ref acquisition; projection values stay ordinary lexical inputs to the callback.
- Keep scheduling consumer-owned inside the retained resource. The downstream scheduling-evidence task may record a no-API verdict or create a separate registration-level implementation brief after dogfood; it may not add `commitScheduling` to `igniteCore` by assumption.
- Produce and accept `docs/retained-complex-interfaces.md` as the architecture artifact for this slice. Treat runtime and renderer source as read-only evidence; production implementation remains in downstream tasks.

## Alternatives considered

- `igniteCommit`: rejected because a framework-prefixed directive adds ceremony where the renderer can safely reserve `commit` and prevent DOM forwarding.
- `commitScheduling` on `igniteCore`: rejected because it expands the core configuration and freezes ordering semantics before local and downstream dogfood establish a need.
- Drawing in `effects`: rejected because presentation is not a consequence and must occur for the initial projection as well as source transitions.
- A canvas-specific API or retained DOM projection target: rejected because the lifecycle applies equally to WebGL, editors, maps, video, and other imperative surfaces.

## Affected files

- docs/retained-complex-interfaces.md

## Reference files

- packages/ignite-renderer/src/renderers/jsx
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/igniteCore
- packages/ignite-element/src/runtime/projectionTargets.ts
- packages/ignite-element/src/internal/projectionBinding.ts

## Scope Amendments

- None.

## Implementation plan
- Re-read the current igniteCore callable registration, JSX renderer normalization/commit path, projection-target overload, lifecycle, and story-testing contracts.
- Revise docs/retained-complex-interfaces.md around the existing component("name", renderer) API, generic ref plus commit directives, consumer-owned scheduling, and explicit non-goals/rejected alternatives.
- Define the conformance matrix, package rollout, changeset boundary, verification lanes, and downstream Mesh Pong ownership split without changing production source in this architecture slice.
- Reconcile the retained-interface epic so lifecycle and keys precede canvas dogfood, Mesh Pong validates the consumer contract, and only then does an evidence task decide whether framework scheduling is warranted.

## Verification plan
- Run fas validate-task for task, brief, current-task, and queue consistency.
- Validate every cited API and example against the current v3 beta source tree and type surfaces.
- Run the architecture check against the accepted ref/commit lifecycle, consumer-owned scheduling boundary, and Actor-Web ownership split.
- Confirm source files remain reference-only and production implementation stays in downstream tasks.

## Risks
- A commit directive can become an accidental second effects system unless it is constrained to post-reconciliation presentation.
- Ref cleanup and keyed moves can destroy retained resources unless move versus true-disconnect semantics are explicit.
- Adding scheduler configuration before dogfood would expand igniteCore and freeze ordering semantics without evidence.
- A canvas-specific abstraction would fail editors, maps, WebGL, video, and other retained interfaces.

## Dependencies
- No upstream queue dependency; this remains the active critical architecture slice.
- Blocks retained-node lifecycle and commit implementation task-1783719649309.
- The retained epic completes through final documentation task-1783719740973, which continues to block stable main merge task-1781292613064.
- Actor-Web Mesh Pong remains read-only downstream evidence, not an Ignite implementation dependency.

## Open questions
- None for this architecture slice; framework-owned scheduling is intentionally deferred to the post-dogfood evidence task.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
