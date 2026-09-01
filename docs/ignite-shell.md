# Design: `igniteShell` — a sourceless composition root

## Status

Proposed (design only — not implemented). **Additive** (one scoped behavior
change to igniteCore teardown — see Decision 1). Motivated by a verified gap hit
by a downstream consumer (`../fas-studio`). Tracked under
`docs/v3-api-consistency.md`.

## Context

`igniteCore` is source-centric: every adapter config (`xstate` / `redux` /
`mobx` / `actor-web`) structurally requires a bound `source`, and the low-level
`createComponentFactory` / `createProjectionFactory` are `@internal`. There is no
way to author a **static, sourceless custom element** — one that just composes
children declaratively and runs a lifecycle/teardown hook.

The teardown surface is also source-coupled: a cleanup function can only be
returned from an `effects` callback (run on disconnect via `facadeCleanupSymbol`),
which needs a `source`. There is no standalone lifecycle hook
(`onConnect`/`onDisconnect`) in the config.

So composition roots drop to a hand-rolled native `HTMLElement` +
`innerHTML` + a manual `disconnectedCallback`. Concrete case — `fas-studio`'s
`fas-shell.tsx` (its own comment records the gap):

```tsx
// TODAY — the escape hatch this primitive removes
class FasShell extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>…</style>
      <header class="hdr">…</header>
      <div class="row"><pipeline-sidebar></pipeline-sidebar>…</div>
      <margin-panel></margin-panel>`;          // innerHTML — banned in their igniteCore paths
  }
  disconnectedCallback() { disposeRuntime(); }  // fires on DOM *moves* too — a footgun
}
```

This forfeits ignite-JSX, re-introduces `innerHTML`, and the naive
`disconnectedCallback` disposal is unsafe across DOM moves.

## Decision

Introduce **`igniteShell`** — a lean registrar for sourceless composition roots,
sitting on the same element/render/lifecycle substrate as `igniteCore` but with
**no adapter, no snapshot, no projection**.

```ts
interface IgniteShellHost {
  readonly element: HTMLElement;
  readonly shadowRoot: ShadowRoot;
}
type IgniteShellTeardown = () => void;

interface IgniteShellConfig {
  /**
   * Runs once after mount. The home for app-level setup (e.g. disposeRuntime).
   * Return a teardown — it runs on a *true* disconnect (deferred; cancelled if
   * the element reconnects in the same tick — see Decision 1).
   */
  onConnect?: (host: IgniteShellHost) => void | IgniteShellTeardown;
}

/** Mirrors igniteCore's registrar shape. `render` is pure ignite-JSX, no ctx. */
function igniteShell(config?: IgniteShellConfig):
  (tagName: string, render: () => JSX.Element) => void;
```

`fas-shell`, rewritten — no native subclass, no `innerHTML`:

```tsx
import { igniteShell } from "ignite-element";
import { disposeRuntime } from "../app-state";
import css from "./fas-shell.css?inline";

const registerFasShell = igniteShell({ onConnect: () => disposeRuntime });

registerFasShell("fas-shell", () => (
  <>
    <style>{css}</style>
    <header class="hdr">…</header>
    <div class="row">
      <pipeline-sidebar />
      <compare-view />
      <fas-inspector />
    </div>
    <margin-panel />
    <decisions-drawer />
  </>
));
```

### Why a new primitive, not optional `source` on `igniteCore`

`igniteCore`'s contract *is* a projection pipeline —
`source → adapter → native snapshot → derived states → renderer view`, with `commands`
dispatching to the source, `effects` reacting to transitions, and the agent
runtime (`getSnapshot`/`getStates`/`execute`/`on`/`record`/`getSchema`) all keyed
off the snapshot. Make `source` optional and every other field plus every runtime
method becomes meaningless in the sourceless case, and the types must gate
`states`/`commands`/`effects` on source-presence across all five adapter config
unions. That is not a smaller API — it is `igniteCore` with most of its contract
amputated through optionality, and it destroys the property that
`igniteCore({…})` always means "a reactive projection of a source." Two small,
internally-coherent contracts beat one with a mode switch. They share the
substrate (custom-element base, shadow root, ignite-JSX strategy, idempotent
`define`, move-safe teardown); `igniteShell` simply omits the reactive core.

Mnemonic: **`igniteCore` has the reactive core (a source); `igniteShell` is the
outer shell (none).** The name overlaps the architectural "imperative shell," but
a composition-root-with-lifecycle genuinely *is* imperative-shell work, so it is
apt — docs disambiguate in one line.

### The boundary (keeps it from rotting into a dumping ground)

An `igniteShell` has **no source, no derived `states`, no `commands`, no `events`, no agent
surface, and no attribute reactivity.** `render` is pure and takes no arguments,
so it renders **once**. The moment you need any of those, you have state → use
`igniteCore`. Agents walking the component tree see shell elements as opaque
containers (nothing to introspect) — correct by construction.

## Decision 1 — Move-safe teardown is shared lifecycle infra (fixes igniteCore too)

A DOM **move** (reorder / relocate / tab swap) fires `disconnectedCallback()`
then `connectedCallback()` synchronously. Today igniteCore tears down
immediately, so an **isolated** adapter is stopped and recreated on a move —
losing state:

```ts
// IgniteElement.disconnectedCallback — TODAY
disconnectedCallback() {
  this._isActive = false;
  this._unsubscribe?.();
  if (this._adapter && this._adapter.scope !== StateScope.Shared) {
    this._adapter.stop();        // also fires on a MOVE → isolated state destroyed
    this._adapter = undefined;
  }
}
```

Decision: extract a **shared move-safe lifecycle** into the element substrate that
both `igniteCore` and `igniteShell` use — defer teardown to a microtask and cancel
it if the element reconnects in the same tick:

```ts
// shared base — AFTER
disconnectedCallback() {
  this._isActive = false;
  this._unsubscribe?.();
  this._teardownScheduled = true;
  queueMicrotask(() => {
    if (this.isConnected || !this._teardownScheduled) return; // reconnected ⇒ it was a move
    this._adapter?.stop();           // genuine removal only
    this._adapter = undefined;
    this._runUserTeardown?.();        // igniteShell's onConnect-teardown rides here
  });
}
connectedCallback() {
  if (this._teardownScheduled) {      // survived a move
    this._teardownScheduled = false;
    // reuse the surviving adapter — do NOT recreate; just resume subscriptions
  }
  // ...
}
```

Implications:

- **Fixes a latent igniteCore bug:** isolated adapters now survive DOM moves
  (shared adapters already did, via the `!== Shared` guard + `cleanup` default).
- **Behavior change to igniteCore** → ships with its own changeset and a focused
  test (move an isolated element, assert state preserved). Confirm no consumer
  relied on stop-on-move (none expected).
- **`connectedCallback` must reuse a surviving adapter** rather than recreate it
  when a scheduled teardown was cancelled — the load-bearing subtlety.
- One mechanism across both primitives — never "shell is move-safe, core isn't."

## Decision 2 — Rootless render: reusable capability, internal wiring

The JSX strategy mounts into a created `<ignite-jsx-root>` wrapper
(`IgniteJsxRenderStrategy`). For a layout host that means `:host{display:grid}`
governs only the single wrapper, not the real children — the reason a shell
can't be `igniteCore` today:

```
TODAY                                   ROOTLESS (igniteShell)
<fas-shell> #shadow-root                <fas-shell> #shadow-root
  <ignite-jsx-root>      ← wrapper         <style>:host{display:grid}…</style>
    <header>…</header>                     <header>…</header>     ← :host grid
    <div class="row">…</div>               <div class="row">…</div>  governs THESE
                                           <margin-panel></margin-panel>
```

Principle: the wrapper is a **reconciliation root** for reactive re-render
diffing. `igniteShell` renders **once** and never diffs, so it can mount its
fragment directly into the shadow root. Reactive `igniteCore` keeps the wrapper;
reactive `:host` layout governance remains a separate, harder problem and is
**out of scope** here.

Decision: implement the rootless capability **inside the renderer**, reusing the
same JSX→DOM conversion (skipping only the wrapper + diffing), but wire it
**only through `igniteShell`** — no public `mount` mode on the strategy yet.

```ts
// internal — reuses the SAME JSX→DOM core, one-shot, no wrapper
export function mountIgniteJsxOnce(container: ParentNode, node: JSX.Element): void {
  mountIgniteJsx(container, node);
}
// igniteShell element
connectedCallback() {
  const root = this.attachShadow({ mode: "open" });
  mountIgniteJsxOnce(root, render());
}
```

Implications:

- **No new public renderer surface** to stabilize pre-1.0; promoting it to a
  documented `mount: "fragment"` strategy option later is a clean, non-breaking
  step if a static `igniteCore` view ever needs it.
- Does **not** touch the reactive reconciliation path — no risk to igniteCore
  rendering.
- **Hard requirement:** `mountIgniteJsxOnce` must call the same JSX→DOM core as
  the reactive strategy, so shell JSX semantics (event binding, SVG, fragments)
  are identical to core — one dialect, not two.
- Verify `mountIgniteJsx` works targeting the shadow root directly (event
  delegation, replacement) without the `[data-ignite-jsx-root]` mount node.

## Impact

- **Additive primitive** — new `igniteShell` export; no change to `igniteCore`'s
  config or contract.
- **One behavior change** — igniteCore isolated adapters become move-safe
  (Decision 1); changeset + test required.
- **Agent surface unchanged** — shells are not introspectable by design.
- **Downstream** — `fas-studio`'s `fas-shell` (and any other hand-rolled native
  composition root) migrates to declarative ignite-JSX + one `onConnect`
  teardown; `innerHTML` and the native subclass go away.

## Alternatives considered

- **Optional `source` on `igniteCore`** — rejected: amputates the projection
  contract through optionality, type-gates four adapter unions, and makes
  `igniteCore({…})` mode-dependent (the inconsistency this epic removes).
- **`onDisconnect` callback alongside `onConnect`-returns-teardown** — rejected:
  two ways to do one thing. `onConnect → teardown` is the single idiom.
- **`styles?` config field** — rejected: igniteCore has no such field; keep the
  config-free `<style>{css}</style>`-in-render convention identical.
- **`reconnect: "persist" | "remount"`** — rejected for v1: shells render once;
  a knob with no second case is premature.
- **Public renderer `mount` mode now** — deferred: commits to a renderer API
  surface before a second consumer needs it (Decision 2).
- **igniteShell-local duplicate mount path** — rejected: forks JSX semantics.

## Open questions / next steps

- Confirm the igniteCore isolated-adapter move-bug with a focused failing test
  before implementing Decision 1 (drives the shared move-safe lifecycle).
- Extract the element/render/lifecycle substrate so `igniteCore` and
  `igniteShell` are thin registrars over one factory (`createComponentFactory`).
- Implement `mountIgniteJsxOnce` in ignite-renderer (Decision 2); verify rootless
  mount against the JSX→DOM core.
- Add the `igniteShell` registrar + public export; tests (renders rootless;
  `onConnect` teardown fires only on true disconnect; no teardown on move).
- Changeset (additive primitive + the igniteCore move-safety behavior change).
- Docs: a short guide + the boundary note; disambiguate the "shell" naming.
- Sequencing: additive — ships independently of the breaking cutover.

## Related

- `docs/v3-api-consistency.md` (index), `docs/effects-change-detection.md`
- Motivation: `../fas-studio/src/elements/fas-shell/fas-shell.tsx`
- Memory: `expose-source-native-api`, `v3-examples-track`
