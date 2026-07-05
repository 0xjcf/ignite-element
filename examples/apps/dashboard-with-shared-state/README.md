# Dashboard with shared state (worked app)

A multi-widget operations dashboard where independent custom elements project
the same shared actor. Filters, KPI cards, and the alert feed do not pass props
through a framework tree; they coordinate through one consumer-owned source.

## What it demonstrates

- **One app-lifetime source.** `dashboardStore.ts` starts a single XState actor.
- **Many Ignite elements.** `<dashboard-filters>`, `<metric-summary>`, and
  `<alert-feed>` are registered separately against that same source.
- **Shared-state commands.** Changing the selected team in the filters updates
  the metric summary projection. Dismissing an alert updates the feed and emits
  an `alertDismissed` event.
- **Headless coordination tests.** Two headless runtimes can bind to one actor;
  a command from one runtime is immediately visible in the other runtime's view.

## Project layout

| File | Role |
| --- | --- |
| `src/dashboardModel.ts` | Pure dashboard data selectors plus XState machine. |
| `src/dashboardStore.ts` | Shared actor owned by the app shell. |
| `src/dashboard.tsx` | Independent widgets registered with `igniteCore`. |
| `src/dashboardModel.test.ts` | Functional-core selector and machine checks. |
| `src/dashboard.headless.test.ts` | Cross-widget headless shared-state tests. |

## Run

```bash
cd examples/apps/dashboard-with-shared-state
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite aliases point at local source, matching the other top-level examples.
