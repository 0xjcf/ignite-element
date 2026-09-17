# ignite-element + Vue (framework interop)

A Vue 3 demo that consumes an ignite custom element through the **standard
custom-element surface** — no wrapper. It is deliberately minimal (one element,
not a full app) and pairs with the [host app integration
guide](https://0xjcf.github.io/ignite-element/handbook/views/).

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
- **Lit renderer.** Importing `@ignite-element/renderer/lit` registers the
  renderer for the element's `html\`\`` view.

## The Vue friction (not papered over)

| Friction | What it is |
| --- | --- |
| `compilerOptions.isCustomElement` | The one required setup: tell Vue's compiler the hyphenated tag is a custom element (Vite config) or Vue warns and skips it. |
| Event-name casing | `addEventListener('toggled', …)` is always correct. Vue's `@toggled` works for an all-lowercase event, but a camelCase event (e.g. `countChanged`) needs `@count-changed` or an explicit listener. |
| Untyped commands | The raw element has no typed command surface, so `toggleRef.value?.toggle()` needs a cast. See the [current interop contract](https://0xjcf.github.io/ignite-element/handbook/views/#browser-custom-element-interoperability). |
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
cd examples/frameworks/vue
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite config aliases `ignite-element` and the `@ignite-element/*` workspace
packages to local **source**, so the demo always runs against current code.
`xstate` is pinned to the workspace version (`5.32.1`) to avoid a dual-copy skew.

## Standard custom-element interoperability

This example uses the registered element's attributes, DOM events and commands.
See the [current interop contract](https://0xjcf.github.io/ignite-element/handbook/views/#browser-custom-element-interoperability)
for platform boundaries and the separate React web wrapper. A dedicated Ignite
Vue binding is not implemented.
