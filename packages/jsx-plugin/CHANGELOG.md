# @ignite-element/jsx-plugin

## 3.0.0-beta.19

### Minor Changes

- 3aad6ea: A `.cjs` `require(helper)` that can load the author-style mark is a build error under Vite, esbuild, webpack, and Rspack. The plugin trusts only realpaths inside the resolved Ignite package roots. There is no public mark API. An ordinary dependency `require(name)` is not a build error. Same-named `const` bindings in different functions stay separate, and a JSX loader still applies when a dynamic import is scanned. A finite chain of ordinary `require` or `import` edges is not a build error, and neither is `require("./package.json")` when a script string mentions `require`.

  A file with more than one `@jsxImportSource` comment fails the build, so the plugin and the bundler cannot disagree. One Ignite pragma still marks static `<style>` text. A React file is not marked.

  Supported bundlers are Vite, esbuild, Rollup, Rolldown, webpack, and Rspack. JSX in `.js`, `.mjs`, or `.cjs` is parsed when that extension's loader is JSX: Vite and esbuild `jsx` or `tsx`, or a webpack or Rspack `babel-loader` rule. `.ts`, `.mts`, and `.cts` stay TypeScript, so angle-bracket assertions still parse.

- 4d19194: Breaking, inside 3.0.0. This is not a 4.0. `trustedStyle`, `safeUrl`, and `safeSpread` are not public exports of `ignite-element/jsx` or `@ignite-element/renderer/jsx`. This beta has not been published with those names.

  If you imported them:

  - Delete the imports.
  - Put loader CSS in a static `<style>` child, a same-file const, or `import sheet from "./sheet.css?raw"`.
  - Put a color, length, or keyword that comes from props in a CSS custom property. Keep `url()` in the static sheet.
  - Do not spread an untrusted object into JSX when that object can carry a handler, `text`, or `relList`. The renderer drops `text`, `relList`, and string handlers. A function on a direct prop still runs, including when that prop arrived by spread.
  - Add `@ignite-element/jsx-plugin` once, in the bundler config. The package is native ESM-only: it has no `require` condition and no CommonJS build. Component files stay plain JSX. Vite is `igniteJsx()` from `@ignite-element/jsx-plugin/vite`. The same factory has Rollup, webpack, Rspack, esbuild, and Rolldown entry points. `./babel` and `./typescript` are not standalone and are not enough on their own. On their own they fail the build: the private import they emit does not resolve, and the failure says they are not enough on their own. They do not load the author mark by themselves. A bundler plugin is what marks `<style>` and wires the mark. With that plugin, the import those two entries emit is adopted. A file whose `@jsxImportSource` is not `ignite-element/jsx` is left unchanged. Decorators that this repo already enables with `experimentalDecorators` parse. A `.js`, `.mjs`, or `.cjs` file is parsed as JSX when that extension's bundler loader is `jsx` or `tsx`.

  `javascript:` and the other rejected URL schemes are still dropped by the internal allowlist. Untrusted `style={}` still drops `url()`, `@import`, and the scriptable tokens. A global `defineIgniteConfig({ styles })` link is unchanged and is not how a component keeps a `url()`.

  Runtime selection also respects emitted runtime imports, Vite/esbuild's `jsxImportSource`, and the nearest `tsconfig.json` or `jsconfig.json`, including inherited configuration. Unannotated React/Preact files remain strings. Other toolchains can pass `igniteJsx({ jsxImportSource: "ignite-element/jsx" })` as a fallback; per-file pragmas take precedence. The bundler adopts preserved JSX and ESM automatic-runtime Babel/TypeScript output, including `jsxDEV` and `.tsx` to `.js` emission, only for static style children. Bundler-specific declarations load only the selected bundler's types. Beta staging and packed consumers share the same five-package inventory and validate the exact JSX plugin tarball too.

  The Babel and TypeScript compiler entries pass their runtime selection into marking before emitting JSX calls. They preserve React/Preact and default-runtime stylesheet strings, including files without a pragma. Valid compiler marks in application `dist/` output are adopted; dynamic or misplaced marks still fail validation. Validated static constants and raw-CSS aliases survive compiler downleveling without trusting application `let`/`var` values. Plain and prefixed style tags share validation through compiler-output adoption. Preceding prop spreads preserve static author CSS in modern and supported downleveled output; later children overrides remain rejected.

  JSX omits a `script` whose local name is `script`, including a prefix such as `x:script` and SVG `script`, when it has text or element children or any own spelling of `src`, `href`, or `xlink:href`. The key's presence is enough: `false`, `null`, `undefined`, `""`, and `0` omit the element. A `link` whose `rel` contains `stylesheet`, `preload`, `modulepreload`, or `import` is omitted. `text` and `relList` are ignored on every element. A string `onclick` is not applied. A direct `onClick` function still runs, and so does a function inside a spread.

  Without the plugin, a `<style>` load is dropped. Development warns that the plugin may be off. Production drops it silently. A marked sheet keeps `url()`, `@import`, `image-set(`, and a backslash, and still drops `expression(`, `behavior`, `-moz-binding`, and a `</style` breakout. A second copy of the author-style module fails closed. Do not import a helper to bless CSS. `ignite-element/jsx/author-style` is not a public export, and the plugin rejects a hand-written import of that target. Only a `const` or a `*.css?raw` import that is never reassigned is marked. A `let`, a `var`, and a `const` alias of either stay data. Mixing marked and unmarked children in one `<style>` drops the author `url()`.

  Brace-valued CSS custom properties retain their declaration separators, so `.x{--theme:{};color:red}` keeps its color. Nested token blocks stay within the checked declaration; removing a blocked declaration preserves neighboring declarations and sibling rules. The same separator handling applies to style attributes.

### Patch Changes

- 3aad6ea: Preserve stable local functions named `require`, valid CommonJS wrapper returns,
  and safe sequence-expression load targets while refusing real private author-mark
  loads, including loads nested before a sequence's final value. Scan executable
  syntax without assuming that `require` or `import` is immediately followed by `(`.
  Use one lexical module-load classifier for recursive scans, compiler rejection
  and resolved-package guards. Literal and template data passed to ordinary local
  functions stay data; reassigned and mutable loader bindings remain guarded.

  For webpack and Rspack, use the running loader's native context to identify the
  actual Babel-loader selection. Path-qualified rules, includes, excludes and
  `oneOf` remain owned by the bundler, and TypeScript assertion syntax stays intact.

  Recognize real CommonJS `module.require` ports and local wrappers forwarding a
  loader argument, while preserving locally shadowed module-shaped data. Unwrap
  angle-bracket TypeScript assertions through the shared expression classifier.
  Inspect the host's final module code after other transforms using the same
  binding-aware loader and target checks, so generated private loads stay refused.
  Original and final application code share the same fail-closed policy for
  unknown loader targets; dependency scans retain their existing relaxation.

  Follow lexical parameter dependencies through composed loader expressions and
  rest arguments, including templates, aliases, calls and member access. Ignore
  discarded sequence values and conditional tests when classifying forwarding.

  Classify optional and sequence callees, lexical loader aliases and explicit
  Function.call/apply load arguments through that same classifier.

  Retain loads through forwarding function initializers even when a later
  reassignment changes their binding; ordinary reassigned data functions stay data.

  Discover possible loader-input flow through const, let and var initializers and
  assignments. Keep this conservative discovery separate from the unchanged-const
  requirement used to prove safe target values.

  Inspect possible first-element writes to apply argument arrays. Keep opaque
  argument-list uncertainty separate from scalar loader-input forwarding, so
  unused argument data does not become a module specifier.

- a5c559b: Declare the renderer as a workspace development dependency of the JSX plugin so
  native Node and source-aliased example builds resolve the renderer from its owner.
  The published runtime dependencies, exports, and author-style provenance guards
  remain unchanged. Add native-process and seeded provenance regressions that do not
  inherit pnpm's hoisted NODE_PATH fallback.
