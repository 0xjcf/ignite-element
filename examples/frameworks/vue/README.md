# ignite-element + Vue (framework interop)

A Vue 3 demo that consumes an ignite custom element through the **standard
custom-element surface** — no wrapper. It is deliberately minimal (one element,
not a full app) and pairs with the [host app integration
guide](../../../../../../docs/site/src/content/docs/guides/host-app-integration.mdx).

The element here is authored with **lit-html** (the React demo uses Ignite JSX) to
exercise both renderers across the framework examples. Vue never sees how the
view is authored — it consumes the same browser contract either way.

## What it shows

- **Props in.** The single-arg `setLabel` command maps to a `label` string
  attribute; `:label="label"` flows a reactive Vue value into it.
- **Events out.** The element's `toggled` event is a DOM `CustomEvent`; Vue
  mirrors it into local state via `addEventListener` in `onMounted`.
- **Commands via a ref.** `toggle()` is an element method, reached through a
  template ref.
- **Config-free lit.** The element's `html\`\`` view renders with lit purely
  because `@ignite-element/renderer/lit` is imported — auto-detected, no
  `ignite.config.ts`.

## The Vue friction (not papered over)

| Friction | What it is |
| --- | --- |
| `compilerOptions.isCustomElement` | The one required setup: tell Vue's compiler the hyphenated tag is a custom element (Vite config) or Vue warns and skips it. |
| Event-name casing | `addEventListener('toggled', …)` is always correct. Vue's `@toggled` works for an all-lowercase event, but a camelCase event (e.g. `countChanged`) needs `@count-changed` or an explicit listener. |
| Untyped commands | The raw element has no typed command surface, so `toggleRef.value?.toggle()` needs a cast. This is exactly the seam React's `igniteReact` smooths over — a Vue helper could too (a follow-up; see below). |
| Attribute coercion | Attributes are strings. `:label` (a string) flows cleanly; non-string data would need explicit DOM-property binding rather than an attribute. |

## Files

| File | Role |
| --- | --- |
| `src/toggle.ignite.ts` | The framework-neutral ignite element (lit-html view, auto-detected). |
| `src/App.vue` | The Vue consumer: `isCustomElement` aside, pure standard custom-element usage. |
| `src/main.ts` | Registers the element, then mounts the app. |
| `vite.config.ts` | `@vitejs/plugin-vue` with `isCustomElement`; source aliases to local Ignite packages. |

## Run

```bash
cd src/examples/frameworks/vue
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite config aliases `ignite-element` and the `@ignite-element/*` workspace
packages to local **source**, so the demo always runs against current code.
`xstate` is pinned to the workspace version (`5.32.1`) to avoid a dual-copy skew.

## Why standard APIs (no wrapper)

React earned a dedicated `igniteReact` helper because its custom-element friction
is the worst (props-as-attributes, no declarative `CustomEvent` listeners before
React 19). Vue's friction is milder, so this demo stays on the standard surface
to show what plain interop costs. A schema-driven `igniteVue` is a possible
follow-up — the same `getSchema()` that drives `igniteReact` would drive it — but
it is intentionally out of scope here.
