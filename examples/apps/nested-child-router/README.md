# Nested child router (worked app)

A small Ignite Element app that splits routing into a parent outlet and child
outlets. It builds on the SPA router example, but focuses on composition: the
top-level router decides whether the user is in Home, Docs, Settings, or 404,
while child outlets own their scoped tabs.

## What it demonstrates

- **Parent route plus child route projection.** The machine projects both
  `parent` and `child` route state from one path.
- **Scoped child commands.** Docs tabs dispatch `OPEN_DOC_SECTION`; settings
  tabs dispatch `OPEN_SETTINGS_PANEL`.
- **Multiple elements, one source.** `<nested-router-app>`,
  `<docs-child-outlet>`, and `<settings-child-outlet>` all read one shared
  actor. Ignite keeps that consumer-owned actor alive for the core lifetime.
- **Headless coverage.** The same router core is driven with `execute` and
  asserted with `getView` / `execute().events`.

## Project layout

| File | Role |
| --- | --- |
| `src/routerMachine.ts` | Pure route resolution plus the XState machine. |
| `src/routerStore.ts` | App-lifetime shared actor. |
| `src/router.tsx` | Parent outlet and child outlet custom elements. |
| `src/routerMachine.test.ts` | Functional-core route tests. |
| `src/router.headless.test.ts` | Ignite headless runtime tests. |

## Run

```bash
cd examples/apps/nested-child-router
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite config aliases `ignite-element` and the scoped workspace packages to
local source so the example runs against the current checkout.
