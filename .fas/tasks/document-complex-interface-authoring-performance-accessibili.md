# Document complex-interface authoring, performance, accessibility, and ownership boundaries

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Publish stable authoring guidance for retained Ignite interfaces after implementation, dogfood, downstream validation, and the explicit scheduling verdict. Document when to use ordinary Ignite JSX, generic ref/commit retained resources, keyed reconciliation, consumer-owned requestAnimationFrame or microtask scheduling, igniteShell, Lit, or a separate native custom element. Cover canvas/WebGL/editor/map/video patterns, high-DPI sizing, resize and animation lifecycle, input scoping, accessibility companions, telemetry, testing, and the Actor-Web ownership split. Cross-link the exact-source provisioning standard and make clear that ref and commit own only node-bound presentation resources: they never construct, wrap, start, stop, or dispose the source. Use only the final shipped API and do not present Canvas or Mesh Pong as special framework modes.


## Acceptance criteria
- Public docs explain the retained ref/commit lifecycle with tested, typechecked examples matching the shipped callable component registration API.
- Guidance distinguishes exact native source truth and lifecycle, view projection, renderer commit, outward effects, node-bound resource cleanup, consumer-owned scheduling, and Actor-Web runtime ownership.
- The guide cross-links the source-only provisioning standard and explicitly forbids ref or commit from constructing, wrapping, starting, stopping, or disposing a source.
- The docs record the task-1783719681572 scheduling verdict and add no framework scheduler surface unless a separate evidence-backed implementation task has shipped it.
- The canvas guide covers DPR, ResizeObserver, requestAnimationFrame interpolation, focus-scoped input, blur recovery, reduced motion where applicable, and semantic DOM alternatives/status.
- A decision guide covers Ignite JSX versus Lit versus igniteShell versus a separate native element for complex interfaces.
- The Actor-Web Mesh Pong adoption section links the downstream validation brief and never claims Ignite owns transport, simulation, match lifecycle, or advisory policy.
- Docs build, markdown lint, code-example typecheck, accessibility checks, and package export verification pass.
- The work is tracked in .fas/TASKS.md and has a clear implementation and verification plan.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Make `docs/retained-complex-interfaces.md` the normative retained-presentation guide and cross-link `docs/source-native-provisioning.md` for capability ports, exact native source construction, and source lifecycle ownership.
- Teach `ref` as stable node acquisition plus true-disconnect cleanup and `commit` as post-reconciliation synchronization from the latest projected data. Show Canvas, Cytoscape, editor, map, and video resources as consumer-owned instances rather than source wrappers or Ignite-managed runtimes.
- Include an ownership table covering source lifecycle, Ignite observation lifecycle, retained node lifecycle, draw or scheduling cadence, accessibility projection, and Actor-Web runtime or transport authority.
- Reuse only verified examples from the retained-canvas and Mesh Pong evidence tasks, and link rather than duplicate the callback, source-provisioning, and Actor-Web guides.

## Alternatives considered

- Put Canvas or Cytoscape work in Ignite effects: rejected because effects publish outward facts and have no stable node identity or teardown lifecycle.
- Let `ref` or `commit` own source startup and shutdown: rejected because presentation attachment can change independently from application source ownership.
- Add scheduler or renderer-specific configuration to `igniteCore`: rejected unless the separate scheduling evidence task proves a missing framework responsibility.
- Merge source provisioning and retained-interface guidance into one guide: rejected because environmental behavior and node-bound presentation have independent lifecycles and different owners.

## Affected files

- docs/retained-complex-interfaces.md
- docs/site/src/content/docs/concepts/rendering.mdx
- docs/site/src/content/docs/guides
- README.md
- docs/shared-architecture-model.md

## Scope Amendments

- None.

## Implementation plan
- Read the shipped APIs, retained-canvas example, pinned Mesh Pong validation artifact, and scheduling verdict before writing guidance.
- Document the mental model, API reference links, lifecycle/commit semantics, consumer-owned scheduling pattern, decision guide, accessibility/performance checklist, and testing pattern using only verified syntax.
- Update the architecture model and relevant rendering guides without duplicating or contradicting stable API pages.
- Run all docs, example, accessibility, and export verification lanes and fix only in-scope documentation issues.

## Verification plan

- Run markdown lint, docs code-example typecheck, and docs build.
- Run accessibility checks and the retained-canvas example tests referenced by the guide.
- Run package export verification, fas validate-task, and the appropriate full verification lane for tracked docs changes.

## Risks

- Docs can freeze pre-implementation names or stale intermediate semantics.
- Canvas guidance can overfit one example and obscure generic retained interfaces.
- Ownership wording can imply Ignite controls Actor-Web transport or simulation if not checked against the validation artifact.

## Dependencies
- Depends on scheduling-verdict task-1783719681572 after canvas and Mesh Pong dogfood.
- Final task in epic-ignite-retained-complex-interfaces.
- Blocks v3 main-merge task-1781292613064 so retained complex-interface support lands before stable.

## Open questions
- None; unresolved API or ownership questions must return to the owning implementation, validation, or evidence task instead of being decided in documentation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
