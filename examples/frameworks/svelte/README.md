# ignite-element + Svelte (framework interop)

A Svelte 5 demo that consumes an ignite custom element through the **standard
custom-element surface** — no wrapper, and (unlike Vue) **no compiler
config at all**. It is deliberately minimal (one element, not a full app) and
pairs with the [host app integration
guide](../../../../../../docs/site/src/content/docs/guides/host-app-integration.mdx).

To widen coverage across the framework demos, this element uses a **Redux Toolkit**
slice (React and Vue use xstate) with a **lit-html** view. Svelte never sees the
adapter or the renderer — it consumes the same browser contract either way.

## What it shows

- **Props in.** Single-arg `setX` commands map to observed attributes
  (`setLabel` → `label`, `setStep` → `step`). `{label}` flows a reactive string;
  `step={step}` flows a reactive number.
- **Numeric coercion (the honest friction).** Attributes are strings — the DOM
  hands `step` to the element as `"5"`, so `setStep` wraps it in `Number()`.
  Without that, `value += step` would concatenate. Svelte sets the attribute
  cleanly; the coercion lives in the element where it belongs.
- **Commands via `bind:this`.** `increment()` / `decrement()` / `reset()` are
  element methods, reached through a bound reference.
- **Events out, declaratively.** The element's `changed` event is a DOM
  `CustomEvent`; `onchanged={…}` listens for it with no `addEventListener` —
  the path React (before 19) and Vue both fall back to.
- **Config-free lit + Redux.** The `html\`\`` view renders with lit purely because
  `@ignite-element/renderer/lit` is imported (auto-detected, no `ignite.config.ts`),
  and the Redux slice drives it through the standard adapter.

## The Svelte friction (not papered over)

| Friction | What it is |
| --- | --- |
| Untyped commands | The raw element has no typed command surface, so `toggleRef.increment()` needs a cast. This is exactly the seam React's `igniteReact` smooths over — a Svelte helper could too (a follow-up; see below). |
| String-attribute coercion | Attributes are strings. `label` (a string) flows cleanly; a numeric prop like `step` arrives as `"5"` and the element coerces with `Number()`. This is the DOM custom-element contract, not an ignite quirk. |

What is **not** friction here, and is worth calling out:

- **Zero compiler config.** Svelte renders `<ignite-stepper>` as-is. Vue needs
  `compilerOptions.isCustomElement`.
- **Declarative events.** `onchanged` (Svelte 5's event attribute) needs no
  manual listener — the lowest-ceremony custom-event story of the framework demos.

## Files

| File | Role |
| --- | --- |
| `src/stepper.ignite.ts` | The framework-neutral ignite element (Redux slice, lit-html view, auto-detected). |
| `src/App.svelte` | The Svelte consumer: pure standard custom-element usage, no config. |
| `src/main.ts` | Registers the element, then mounts the app. |
| `vite.config.ts` | `@sveltejs/vite-plugin-svelte` (no custom-element option); source aliases to local Ignite packages. |

## Run

```bash
cd src/examples/frameworks/svelte
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite config aliases `ignite-element` and the `@ignite-element/*` workspace
packages to local **source**, so the demo always runs against current code.
`@reduxjs/toolkit` and `redux` are pinned to the workspace versions (`2.12.0` /
`5.0.1`) to avoid a dual-copy skew.

## Why standard APIs (no wrapper)

React earned a dedicated `igniteReact` helper because its custom-element friction
is the worst (props-as-attributes, no declarative `CustomEvent` listeners before
React 19). Svelte's friction is the mildest of all — no compiler config and
declarative event listening — so this demo stays on the standard surface to show
how little plain interop costs. A schema-driven `igniteSvelte` is a possible
follow-up — the same `getSchema()` that drives `igniteReact` would drive it — but
it is intentionally out of scope here.
