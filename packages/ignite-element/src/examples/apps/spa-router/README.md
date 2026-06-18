# SPA Router + Ignite Element (v3) Example

A tiny single-page app whose **router is an Ignite Element component**. It shows
the core idea end to end: **the URL is just state, and navigating is just a
command.** No router library — the route table is plain data, the current route
is an XState machine, and History I/O lives in a thin shell.

## Quick Start

```bash
pnpm --filter spa-router-example dev      # vite dev server on http://localhost:8083
pnpm --filter spa-router-example build    # production build
```

From the repo root you can also run the example's tests (they execute in the
package's vitest run):

```bash
pnpm --filter ignite-element test -- src/examples/apps/spa-router
```

## What it demonstrates

- **History routing** with the browser History API (back/forward included).
- **Dynamic params** — `/users/:id` captured into route state.
- **Auth guard / redirect** — `/dashboard` bounces to `/login` until you log in.
- **Active-link styling** driven by route state, not the DOM.
- **A pure routing core** you can test **without a browser** (see below).

## Project layout

| File | Role |
| --- | --- |
| `src/routes.ts` | The route table — plain data (`/users/:id`, `requiresAuth`). |
| `src/matchRoute.ts` | Pure path→route+params matcher. No History, no DOM. |
| `src/routerMachine.ts` | The functional core: an XState machine holding route state + guard logic. Never touches `window`. |
| `src/history.ts` | The imperative **shell** — the only module that reads/writes `window.history`/`location`. |
| `src/routerStore.ts` | Wires the machine to the browser: one shared actor + `popstate` listener. |
| `src/router.tsx` | The **outlet** element (`<app-router>`): renders the nav and swaps in the active page; owns the single History *write*. |
| `src/pages.tsx` | Each route's page, registered as its own custom element against the shared router state. |
| `styles.css` | Plain CSS, injected into Shadow DOM via `?raw` (see *Styling*). |

## How it works

### The URL is state; navigation is a command

`routerMachine` is a deterministic function of "where do you want to go?" — it
matches the path and applies the auth guard, all without any I/O:

```ts
export const resolveNavigation = (toPath: string, authed: boolean): Resolved => {
  const match = matchRoute(toPath);
  if (requiresAuth(match.name) && !authed) {
    return { ...matchRoute(LOGIN_PATH), redirected: true }; // guard → /login
  }
  return { path: match.path, route: match.name, params: match.params, redirected: false };
};
```

Components express intent with a command; they never poke the URL directly:

```tsx
<a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}>{label}</a>
```

### Core vs. shell (the History boundary)

The machine stays pure. The browser is the outside world, so all History I/O is
isolated in `history.ts` and committed by a single **effect** on the outlet —
and only for `navigate` (not `popstate`, where the browser already moved the
URL), which keeps back/forward from stacking duplicate entries:

```tsx
effects: ({ snapshot, prevSnapshot }) => {
  if (snapshot.context.source === "navigate" &&
      snapshot.context.path !== prevSnapshot.context.path) {
    pushPath(snapshot.context.path);   // the only History write
  }
},
```

### Headless testing — route without a browser

Because the core is pure and the runtime is headless, you can drive navigation
and assert on projected route state with no DOM and no jsdom history shims:

```ts
const router = igniteCore({ source: routerMachine, view: ({ context }) => ({ ... }) });
await router.execute("navigate", "/users/7");
expect(router.getView().id).toBe("7");
```

See `src/router.headless.test.ts`, `src/routerMachine.test.ts`, and
`src/matchRoute.test.ts`.

## A shared-source lifecycle note (`cleanup: false`)

Every page element and the outlet read the **same** `routerActor` (an
app-lifetime singleton owned by `routerStore`). By default Ignite stops a
shared adapter when the last instance of an element disconnects — and since the
outlet swaps pages, that would tear down the router the incoming page still
needs. Passing `cleanup: false` keeps the shared adapter alive; the shell owns
the actor's lifetime instead. Reach for this whenever many elements project one
long-lived source.

## Styling (config-free, Shadow DOM)

Ignite renders each component into its own Shadow DOM, so a global stylesheet
linked from `index.html` can't reach component internals. This example uses the
minimalist v3 path — **no `ignite.config.ts`, no build plugin**:

- `index.html` links `styles.css` for the document `body` and the `:root`
  custom properties (custom properties *inherit through* the shadow boundary).
- `router.tsx` / `pages.tsx` import the sheet with `?raw` and inject
  `<style>{styles}</style>` into each shadow root for the class rules (class
  selectors do *not* cross the boundary).

One gotcha worth knowing: descendant selectors don't cross shadow roots, so a
page rendered as its own element needs a flat selector (`.page`, not
`.content .page` — `.content` is in the outlet's shadow, `.page` in the page's).
For one-off component CSS, a `?raw` import scoped to that single component is
the right tool.

## Next steps / extensions

- **Nested routes / outlets** — give a page its own child `<app-router>`-style outlet.
- **Lazy routes** — `import()` a page module inside `renderPage` and render a fallback while it loads.
- **Query params** — `matchRoute` already strips `?query`; thread it into context if you need it.
- **Scroll/focus restoration** — move focus to the page's `<h1>` on navigation for screen-reader users.

## More

See the [routing guide](https://ignite-element.dev/ignite-element/guides/routing/)
in the docs for a narrative walkthrough.
