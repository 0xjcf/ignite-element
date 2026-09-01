# SPA Router + Ignite Element (v3) Example

A tiny single-page app whose router is an application-owned XState source passed
directly into Ignite Element. The URL is still state and navigation is still a
command, but the browser boundary now lives in a local `NavigationPort` backed
by the browser Navigation API instead of History writes in an Ignite effect.

## Quick Start

```bash
pnpm --filter spa-router-example dev
pnpm --filter spa-router-example build
```

This example requires browser Navigation API support (Baseline 2026). No
History API fallback is provided.

## What it demonstrates

- Navigation as explicit source intent, not DOM or effect work.
- A pure route matcher and router machine with auth-guard redirects.
- An example-local `NavigationPort` with browser and deterministic memory
  adapters.
- Source-owned observation cleanup through `routerSource.stop()`.
- Headless tests that exercise the same `createRouterSource(...)` factory with
  no DOM globals.

## Project layout

| File | Role |
| --- | --- |
| `src/routes.ts` | Route table data (`/users/:id`, `requiresAuth`). |
| `src/matchRoute.ts` | Pure path-to-route matcher. |
| `src/routerMachine.ts` | Pure XState routing core. |
| `src/navigation.ts` | Example-local `NavigationPort`, browser adapter, and deterministic memory adapter. |
| `src/routerSource.ts` | Example-owned source composition: observation plus accepted Navigation API commits. |
| `src/routerStore.ts` | App-lifetime `routerSource` created from `window.navigation`. |
| `src/router.tsx` | Outlet element. It projects route state and sends intent only. |
| `src/pages.tsx` | Page elements against the shared `routerSource`. |

## How it works

### The machine stays pure

`routerMachine` only resolves requested or observed paths:

```ts
export const resolveNavigation = (toPath: string, authed: boolean): Resolved => {
  const match = matchRoute(toPath);
  if (requiresAuth(match.name) && !authed) {
    return { ...matchRoute(LOGIN_PATH), redirected: true };
  }
  return { path: match.path, route: match.name, params: match.params, redirected: false };
};
```

### The source owns browser coordination

`createRouterSource(...)` binds the machine to a tiny `NavigationPort`:

```ts
const routerSource = createRouterSource({
  navigation: createBrowserNavigation(window.navigation),
});
```

The browser adapter observes same-origin Navigation API events, filters
download/hash/cross-origin cases, suppresses self-originated commits, and
commits accepted paths with `push` or `replace` only after the machine decides
where navigation lands.

### Ignite only projects and sends intent

```tsx
const outlet = igniteCore({
  source: routerSource,
  commands: ({ actor }) => ({
    navigate: (to: string) => actor.send({ type: "NAVIGATE_REQUESTED", to }),
  }),
});
```

No router component reads `window`, calls History, or performs navigation work
inside `commands` or `effects`.

## Headless testing

The headless tests use the same source factory with a deterministic memory port:

```ts
const router = igniteCore({
  source: createRouterSource({ navigation: createMemoryNavigation("/") }),
  states: (snapshot) => ({ id: snapshot.context.params.id ?? null }),
});
```

See `src/routerSource.test.ts`, `src/router.headless.test.ts`, and
`src/routerMachine.test.ts`.

## Styling

Each component injects `styles.css?raw` into its own shadow root. The example
still uses the config-free styling path: no `ignite.config.ts`, no router
plugin, and no framework-specific router abstraction.

## More

See the [routing guide](https://ignite-element.dev/ignite-element/guides/routing/)
for the narrative walkthrough, and
[`examples/apps/nested-child-router`](../nested-child-router/README.md) for the
parent/child outlet composition variant.
