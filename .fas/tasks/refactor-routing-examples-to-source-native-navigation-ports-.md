# Refactor routing examples to source-native navigation ports and XState provisioning

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Replace the routing examples' split History API coordination with an
application-owned XState source backed by the browser Navigation API. Keep the
machine independent of DOM globals and Ignite, but avoid a generic router or
capability framework: use one example-local thin navigation boundary, a modern
browser implementation, and a deterministic memory implementation. Bind
external navigation observation and accepted navigation commits through the
router source's native XState lifecycle, pass the exact started actor directly
to `igniteCore`, and remove History writes from Ignite effects and commands.
Preserve deep links, guards, canonicalization, parent-child ownership, emitted
facts, headless behavior, and cleanup through `routerSource.stop()`.

## Purpose and migration model

The task proves the callback and source-ownership architecture in the two
routing examples without creating a public Ignite router abstraction.

Today the SPA router accepts intent in XState but performs the browser write
later from an Ignite effect:

```ts
const defineRouter = igniteCore({
  source: routerActor,
  commands: ({ actor }) => ({
    navigate: (to: string) => actor.send({ type: "NAVIGATE", to }),
  }),
  effects: ({ snapshot, prevSnapshot }) => {
    if (
      snapshot.context.source === "navigate" &&
      snapshot.context.path !== prevSnapshot.context.path
    ) {
      pushPath(snapshot.context.path);
    }
  },
});
```

The nested example has the inverse problem: its command helper writes History
before the machine accepts, rejects, redirects, or canonicalizes the request.

```ts
navigate(to: string) {
  updateBrowserPath(target, to);
  actor.send({ type: "NAVIGATE", to });
}
```

After this task, commands send intent only. The application-owned router source
resolves the route, commits the accepted destination through a thin Navigation
API adapter, and owns observation cleanup through XState:

```ts
const routerSource = createRouterSource({
  navigation: createBrowserNavigation(window.navigation),
});

const defineRouter = igniteCore({
  source: routerSource,
  view: ({ snapshot }) => ({
    route: snapshot.context.route,
    path: snapshot.context.path,
  }),
  commands: ({ actor }) => ({
    navigate: (to: string) =>
      actor.send({ type: "NAVIGATE_REQUESTED", to }),
  }),
});
```

The example-local boundary stays deliberately small:

```ts
interface NavigationPort {
  currentPath(): string;
  observe(listener: (path: string) => void): () => void;
  commit(path: string, history: "push" | "replace"): Promise<void>;
}
```

The browser implementation uses `window.navigation`, `navigate` interception,
and `navigation.navigate(...)`. The memory implementation supplies the same
behavior without DOM globals. The browser adapter tags source-originated
commits so its own `navigate` event does not feed back into the machine.

## Acceptance criteria

- Router machines import no `window`, `navigation`, History API, Ignite, or
  browser-adapter modules and declare only the minimal named implementation
  slots needed by the example-owned source factory.
- The browser adapter uses the Navigation API rather than
  `history.pushState`, `history.replaceState`, or `popstate`; it filters
  non-interceptable, cross-origin, hash-only, and download navigations
  appropriately.
- The examples explicitly document that the browser adapter requires Navigation
  API support (Baseline 2026); no History API fallback is introduced.
- A minimal example-local `NavigationPort` and deterministic memory
  implementation preserve headless execution without DOM shims or global
  augmentation. Any temporary Navigation API structural types remain local to
  the example until TypeScript ships the DOM declarations used here.
- Every environmental listener cleanup is exercised through
  `routerSource.stop()` and the native XState lifecycle.
- Accepted user navigation commits only after machine decision; external
  navigation feeds explicit source events; rejection, canonical replace,
  duplicate-write, self-originated-event suppression, and navigation failure
  semantics are tested.
- Ignite router components contain projection, commands, rendering, and
  optional outward facts only; they perform no browser navigation work in
  commands or effects.
- Shared router actors are application-owned exact XState sources passed directly to igniteCore; no Feature wrapper, createFeature helper, or Ignite lifecycle container is introduced.
- Isolated provided-machine tests retain Ignite-owned adapter lifecycle semantics while application-owned live actors retain native XState ownership.
- SPA and nested-child routing docs teach createRouterSource as example-owned source composition, not a public Ignite router abstraction.
- Headless tests use deterministic ports with the same router source factory and no DOM globals.
- TDD and DDD guardrails remain satisfied and the task stays in the live dependency graph.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Define only the example-local `NavigationPort` operations the examples use:
  current path, navigation observation with cleanup, and accepted push or
  replace commit. Implement it with the browser Navigation API and a
  deterministic in-memory adapter.
- Keep Navigation API compatibility typing local and structural. Do not add a
  repository-wide DOM augmentation or expose the browser API through Ignite.
- Declare one named XState observation actor and one accepted-navigation commit
  implementation, then bind them with `machine.provide(...)` before actor
  creation. Route commit rejection into an explicit machine fact rather than
  leaking an unhandled promise. The machine stays browser- and Ignite-agnostic.
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
- Import `window.navigation` directly into the router machine: rejected because
  it couples the functional core to DOM infrastructure and forces headless tests
  to polyfill the browser.
- Build a generic navigation capability framework: rejected because these
  examples need only current path, observation, accepted commit, and a memory
  implementation.
- Add a History API fallback: rejected for this example because the Navigation
  API is Baseline 2026 and the fallback would double the lifecycle code while
  obscuring the source-ownership lesson. The documented browser requirement
  remains explicit.
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

1. Add failing characterization tests for deep links, accepted navigation,
   external Navigation API events, guard rejection, canonical replace,
   duplicate suppression, source-originated event suppression, commit failure,
   emitted facts, actor stop, and listener cleanup. Preserve equivalent
   deterministic coverage in both examples.
2. Add the minimal Navigation API structural types, thin browser adapter, and
   memory adapter. Bind one observation actor and accepted-commit implementation
   through `machine.provide(...)`, converting commit rejection into an explicit
   source fact.
3. Return the exact started actor from an example-owned
   `createRouterSource({ navigation })`, pass it directly to `igniteCore`, and
   ensure `routerSource.stop()` removes the Navigation API listener.
4. Remove History API helpers and all browser writes from Ignite commands and
   effects. Migrate both READMEs and the routing guide to teach the modern
   browser requirement, application ownership, and deterministic headless path.

## Verification plan

- Run focused router machine, headless, Navigation API interception,
  accepted-commit, failure, actor-stop, and cleanup tests.
- Run example typecheck and build lanes plus docs code-example verification.
- Run architecture checks, fas validate-task, and full verification for the cross-example lifecycle change.

## Risks

- Calling `navigation.navigate(...)` before accepted machine state would restore split authority.
- Source-originated commits also dispatch `navigate`; incorrect tagging or
  filtering could create a feedback loop.
- Navigation transition promise rejection could become unhandled unless the
  adapter and provided source convert it into an explicit fact.
- A callback actor not owned by the router source could leak its Navigation API listener after actor.stop.
- Stopping a shared actor from element disconnect would violate application ownership.
- Consumers on browsers older than the documented Baseline 2026 requirement
  need a separate adapter; this example intentionally supplies no fallback.

## Dependencies

- Depends on task-1784909239951 corrected source-only architecture standard.
- Supersedes task-1784253036241 because source-native provisioning replaces host-owned History effects.
- Blocks task-1784909335843 exact-source conformance.

## Open questions

- During architecture planning, choose the smallest XState-native commit seam
  that consumes `navigation.navigate(...).committed` or `.finished` without
  leaking rejection. Prefer one provided implementation; introduce a dedicated
  commit actor only if cancellation or result ordering requires it.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
