# Nested child router (worked app)

A small Ignite Element app that splits routing into a parent outlet and child
outlets while still using one application-owned XState router source. It builds
on the SPA router example, but focuses on composition: parent and child outlets
project one shared actor, while scoped commands stay local to each surface.

## What it demonstrates

- Parent and child route projection from one pure route machine.
- Scoped intent commands: `NAVIGATE_REQUESTED`, `OPEN_DOC_SECTION`, and
  `OPEN_SETTINGS_PANEL`.
- An example-local `NavigationPort` with browser and deterministic memory
  implementations.
- Accepted navigation commits that happen after machine resolution, not before.
- Headless tests that exercise the same `createRouterSource(...)` factory.

This example also requires browser Navigation API support (Baseline 2026). No
History API fallback is provided.

## Project layout

| File | Role |
| --- | --- |
| `src/routerMachine.ts` | Pure parent/child route resolution and XState machine. |
| `src/navigation.ts` | Example-local Navigation API and memory adapters. |
| `src/routerSource.ts` | Example-owned source composition and accepted navigation commit seam. |
| `src/routerStore.ts` | App-lifetime `routerSource` created from `window.navigation`. |
| `src/router.tsx` | Parent outlet plus child outlet custom elements. |
| `src/routerSource.test.ts` | Source-owned commit, canonicalization, and cleanup tests. |
| `src/router.headless.test.ts` | Ignite headless runtime tests. |
| `src/routerMachine.test.ts` | Pure routing tests. |

## Run

```bash
pnpm --filter nested-child-router-example dev
pnpm --filter nested-child-router-example build
```

The Vite config aliases `ignite-element` and the scoped workspace packages to
local source so the example always runs against the current checkout.

## Architecture summary

The nested example keeps the same boundary as the SPA example:

- the machine resolves routes and child sections without browser imports
- `createRouterSource(...)` owns observation and accepted commits
- Ignite components project state and send intent only

That means child tabs never write browser state before the machine accepts the
route, and browser listener cleanup stays tied to `routerSource.stop()`.
