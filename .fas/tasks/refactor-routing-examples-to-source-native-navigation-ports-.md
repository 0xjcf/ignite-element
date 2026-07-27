# Refactor routing examples to source-native navigation ports and XState provisioning

## Source

Created with `fas create-task` on 2026-07-24.

## Problem
Replace the older machine-driven host-projection routing plan with exact source-only provisioning. Define a framework-neutral NavigationPort with browser and deterministic memory adapters; bind location observation and accepted navigation writes through named XState actors, actions, or callback actors using machine.provide; create and start the shared router actor through an example-owned createRouterSource factory; and pass that exact actor directly to igniteCore. Remove History writes from Ignite effects. Tie browser-listener cleanup to actor.stop through XState native lifecycle and preserve deep-link, guard, canonicalization, parent-child ownership, emitted facts, and headless behavior.


## Acceptance criteria
- Router machines import no window, history, location, Ignite, or browser adapter modules and declare named capability implementation slots.
- Browser and memory navigation implement the same port, and every environmental listener cleanup is exercised through routerSource.stop or the equivalent native actor lifecycle.
- Accepted user navigation writes only after machine decision; external navigation feeds explicit events; rejection, canonical replace, and duplicate-write semantics are tested.
- Ignite router components contain projection, commands, rendering, and optional outward facts only; they perform no History writes in effects.
- Shared router actors are application-owned exact XState sources passed directly to igniteCore; no Feature wrapper, createFeature helper, or Ignite lifecycle container is introduced.
- Isolated provided-machine tests retain Ignite-owned adapter lifecycle semantics while application-owned live actors retain native XState ownership.
- SPA and nested-child routing docs teach createRouterSource as example-owned source composition, not a public Ignite router abstraction.
- Headless tests use deterministic ports with the same router source factory and no DOM globals.
- TDD and DDD guardrails remain satisfied and the task stays in the live dependency graph.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Define an example-local `NavigationPort` with current-location reads, navigation observation, accepted push or replace writes, and an unsubscribe contract. Implement it with browser History and a deterministic in-memory adapter.
- Declare named XState implementation slots for external-location observation and accepted navigation writes, then bind them with `machine.provide(...)` before actor creation. The machine stays browser- and Ignite-agnostic.
- Expose an example-owned `createRouterSource({ navigation })` composition
  function that returns the exact started actor. Model navigation observation as
  an invoked or spawned callback actor whose returned cleanup runs when the
  router actor stops.
- Pass `routerSource` directly to `igniteCore` and use `routerSource.stop()` as
  the application-owned native lifecycle boundary for HMR, tests,
  microfrontends, and other bounded owners.
- Remove History calls from Ignite effects. Router elements project route state, send navigation intent through commands, and optionally publish outward facts after accepted transitions.

## Alternatives considered

- Preserve effect-driven History writes: rejected because it splits navigation authority between source state and projection callbacks and makes listener cleanup dependent on element lifecycle.
- Write History directly from commands: rejected because commands run before the state machine has accepted, rejected, redirected, or canonicalized the navigation request.
- Add an Ignite router, driver, or environment API: rejected because routing composition is already expressible through XState provisioning and application-owned source lifecycle.
- Add a generic `{ source, dispose }` wrapper: rejected because XState already
  provides actor identity, invoked-resource cleanup, and `stop`; Ignite should
  receive that actor directly.
- Put shared router ownership in `igniteShell.onConnect`: rejected because element connection is shorter-lived than a shared application source and nested consumers must not stop a router they did not create.

## Affected files

- examples/apps/spa-router/src
- examples/apps/spa-router/README.md
- examples/apps/nested-child-router/src
- examples/apps/nested-child-router/README.md
- docs/site/src/content/docs/guides/routing.mdx

## Scope Amendments

- None.

## Implementation plan
- Characterize deep-link, navigate, popstate, rejection, canonical replace, duplicate-write, emitted-fact, actor-stop, and listener-cleanup behavior in both router examples.
- Define NavigationPort plus browser and memory adapters, declare XState-provided observation and navigation-write implementations, and return the exact started actor from an example-owned createRouterSource factory.
- Remove History work from Ignite effects, pass routerSource directly to igniteCore, migrate both examples and routing guidance, and preserve parent-child actor ownership.

## Verification plan
- Run focused router machine, headless, browser-history, actor-stop, and cleanup tests.
- Run example typecheck and build lanes plus docs code-example verification.
- Run architecture checks, fas validate-task, and full verification for the cross-example lifecycle change.

## Risks
- Writing History before accepted machine state would restore split authority.
- Browser push and external navigation semantics can create feedback loops if the port contract is incorrect.
- A callback actor not owned by the router source could leak its browser listener after actor.stop.
- Stopping a shared actor from element disconnect would violate application ownership.

## Dependencies
- Depends on task-1784909239951 corrected source-only architecture standard.
- Supersedes task-1784253036241 because source-native provisioning replaces host-owned History effects.
- Blocks task-1784909335843 exact-source conformance.

## Open questions
- Use a provided action only for synchronous fire-and-forget History writes; route result-bearing or cancellable navigation through an invoked or spawned actor with explicit facts.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
