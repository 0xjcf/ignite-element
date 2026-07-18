# Converge routing examples on machine-driven host projections

## Source

Created with `fas create-task` on 2026-07-16.

## Problem

Bring the spa-router and nested-child-router examples into the same authority boundary proven by the voice-workbench audit. Machine state is the sole workflow and navigation authority. projectRoute(snapshot) and projectView(snapshot) are sibling pure projections; neither performs History or browser work. The browser host is the imperative shell: bootstrap the URL into the machine before outbound synchronization, push only accepted user navigation, send popstate as intent without immediately writing History, and use replace for canonical fallback. Never write History before actor acceptance. Do not add an Ignite router API or shared core API unless repeated dogfood friction proves a need. Keep the optional XState graph-testing bridge separate. Document the source-of-truth matrix and lifecycle/event contract.

## Acceptance criteria

- Each routing example exposes a pure route projection from the authoritative machine snapshot, sibling to its presentation view, with no History or browser side effects.
- Initial deep links enter the machine before outbound synchronization; invalid or noncanonical URLs converge through one documented replace path.
- User navigation pushes only after machine acceptance; popstate sends intent without an immediate History write; rejected navigation produces no History mutation.
- Tests cover deep-link bootstrap, back and forward navigation, rejected navigation, canonical fallback, duplicate-write prevention, and listener cleanup.
- The machine remains the only navigation authority: no duplicate child actors, host-side workflow branching, or feedback loops, and the source-of-truth matrix is documented.
- No shared Ignite routing API is added unless the examples demonstrate concrete repeated friction and the API is separately reviewed.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Define the route lifecycle, event contract, raw snapshot shape, route projection, presentation projection, and host-effect boundary before editing either example.
- Keep the router machine authoritative. Expose pure `projectRoute(snapshot)` and `projectView(snapshot)` siblings, then let the browser host synchronize accepted route facts through the History API.
- Characterize the current deep-link, user-navigation, `popstate`, rejection, canonicalization, and cleanup paths before restructuring them.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- examples/apps/spa-router/src/routerMachine.ts
- examples/apps/spa-router/src/history.ts
- examples/apps/spa-router/src/routerStore.ts
- examples/apps/spa-router/src/router.tsx
- examples/apps/spa-router/src/routerMachine.test.ts
- examples/apps/spa-router/src/router.headless.test.ts
- examples/apps/spa-router/README.md
- examples/apps/nested-child-router/src/routerMachine.ts
- examples/apps/nested-child-router/src/routerStore.ts
- examples/apps/nested-child-router/src/router.tsx
- examples/apps/nested-child-router/src/routerMachine.test.ts
- examples/apps/nested-child-router/src/router.headless.test.ts
- examples/apps/nested-child-router/README.md
- docs/site/src/content/docs/guides/routing.mdx

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

- Depends on completed lifecycle-authority task `task-1784171467799`.
- Assigned to epic `epic-v3-additive-api-and-examples` with role `routing-conformance`.
- The optional Ignite XState graph-testing bridge remains independently tracked as `task-1784171502136`; it is not part of this routing task.

## Open questions

- None captured at task creation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
