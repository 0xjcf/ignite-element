# Document complex-interface authoring, performance, accessibility, and ownership boundaries

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Publish the stable authoring guidance for retained Ignite interfaces after implementation and downstream validation. Document when to use ordinary Ignite JSX, retained-node commits, keyed reconciliation, commit scheduling, igniteShell, Lit, or a separate native custom element. Cover canvas/WebGL/editor/map/video patterns, high-DPI sizing, resize and animation lifecycle, input scoping, accessibility companions, telemetry, testing, and the Actor-Web ownership split. Keep examples self-contained, use the final shipped API only, and avoid presenting Canvas or Mesh Pong as special framework modes.

## Acceptance criteria

- Public docs explain the retained-surface lifecycle and scheduler APIs with tested, typechecked examples that match the shipped entrypoints.
- Guidance distinguishes source truth, view projection, renderer commits, effects, resource cleanup, and Actor-Web runtime ownership.
- The canvas guide covers device pixel ratio, ResizeObserver, requestAnimationFrame interpolation, focus-scoped input, blur recovery, reduced motion where applicable, and semantic DOM alternatives/status.
- A decision guide covers Ignite JSX versus Lit versus igniteShell versus a separate native element for complex interfaces.
- The Actor-Web Mesh Pong adoption section links the downstream validation brief and never claims Ignite owns transport, simulation, match lifecycle, or advisory policy.
- Docs build, markdown lint, code-example typecheck, accessibility checks, and package export verification pass.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- docs/retained-complex-interfaces.md
- docs/site/src/content/docs/concepts/rendering.mdx
- docs/site/src/content/docs/guides
- README.md
- docs/shared-architecture-model.md

## Scope Amendments

- None.

## Implementation plan

- Read the shipped APIs, retained-canvas example, and pinned Mesh Pong validation artifact before writing guidance.
- Document the mental model, API reference links, lifecycle and scheduling semantics, decision guide, accessibility/performance checklist, and testing pattern using only verified final syntax.
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

- Depends on Actor-Web Mesh Pong validation task-1783719721452.
- Final task in epic-ignite-retained-complex-interfaces.
- Blocks v3 main-merge task-1781292613064 so retained complex-interface support lands before stable.

## Open questions

- None; unresolved API or ownership questions must return to the owning implementation or validation task instead of being decided in documentation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
