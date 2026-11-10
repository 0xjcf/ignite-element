# Changelog

## 3.0.0-beta.19

### Major Changes

- 073fbd1: BREAKING (beta): `igniteTools` fails closed. Commands are denied unless `canExecute` returns `true`. Ungated `read: true` tools stay available only when that command is side-effect-free; `run` still calls `core.execute`. Do not mark a command `read` if executing it changes source state. `observe` and `until` do not execute commands.

  `canExecute` is `(name, input?, context?)`. Listing calls it with the name. A call reads a schema default once. That materialized value is copied into one detached, deeply frozen plain-JSON snapshot and validated. `canExecute` and `execute` share that snapshot. A provided no-arg value, including provider `{}`, is that snapshot. An omitted no-arg call still has no input field. A later read of the same default is not validated and is not routed. The snapshot keeps own enumerable string keys only. Finite numbers are copied, and signed zero is collapsed to `0` on purpose, along with strings, booleans, null, arrays, and plain objects. The copy walks `ownKeys` and one data descriptor per key. Array length comes from that descriptor or the copied indexes, never from reading `length`. A plain object is recognized by prototype shape, so an object from another JavaScript realm is accepted. A proxy is read once into the snapshot; the library does not detect proxies with a Node-only check. Accessors, bigint, symbols, functions, cycles, values past the nesting limit, and any throw while reading an own data descriptor are `InvalidInput` before the predicate runs. A `Date`, `Map`, `Set`, or class instance is `InvalidInput`, including one from another JavaScript realm. An empty instance is not an empty object. Any other non-plain prototype is `InvalidInput` too. The copy is one pass over own data descriptors, then the caller's prototype shape; a non-plain result discards that copy. An inherited `Symbol.toStringTag` getter, a proxy `get` trap, and a constructor getter are not called. A non-finite schema default, including `Infinity`, is rejected. `run` calls `canExecute` once and sets `context.execute` only on that call, after observation setup succeeds and immediately before `execute`. A throw from event lookup or subscription does not set it, and denial still unsubscribes. `resolveCall` does not set it. Return `true` only for an explicit allow. A throw, a thenable, or any other result is `Unavailable`, including a result whose `then` getter throws. Ignite does not store or consume approvals.

  Migration: pass `canExecute` for every command that should run. `canExecute: () => true` allows every command in that schema; that is a migration choice, not the default. For a single-use approval, compare the canonical form of that snapshot with the granted call, and consume the approval id only when `context.execute` is true. Keep a spent id tombstoned so pruning cannot grant it again. A new id can approve that call again. Deny every command that is not explicitly allowed. Do not use a precomputed boolean, a 32-bit hash, or an allow-everything fallback.

  The published `ignite-element/tools` production entry is gated at 5,000 B gzip (level 9).

### Minor Changes

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

- a7a6a0a: Mount imperative hosts from a `use` prop when an element connects, and dispose them on the shared unmount path.

  `describe` is the accessible text for a projection. The element points at it with `aria-describedby`, and the same text is included in document and speech projections. It is derived from the snapshot alone, so a server render can show it without calling `mount`. A client mount queues the latest slice until it resolves, keeps the instance across a keyed move, and leaves the element in charge of its subtree. `use` takes a handle from that core's `hosts`. The runtime value is the host name. Types reject a typo, a bare string, a cast, and a handle from a different host map on assignment and in `jsx()`. On JSX tags, TypeScript cannot reject a handle from another core. The development-build warning catches a name that is not on the element's core. Cores with identical host maps are not distinguished. `LibraryManagedAttributes` leaves application components alone, so a component's own `use` prop still typechecks. Host `use` stays on intrinsic elements. The host-free JSX entry registers `ignite-jsx` only when none is present, so a later import does not replace a host-aware registration, and that entry stays free of the host runtime. A host-aware registration still replaces a host-free one. A core that declares no host map leaves a derived state or command named `hosts` in place. An explicit empty host map still provides `hosts`, including names added to that object later. `HostProps` on an index-signature map is still a branded handle, so a bare string does not typecheck.

- 1144709: BREAKING (beta): passed `checked`, `value`, and `selected` are applied on every render, including an explicit `false`. `defaultChecked`, `defaultValue`, and `defaultSelected` run before those live props. While a connected, focused input or textarea has an active composition, `value` is not written, so an `onInput` re-render does not reset the composition. Composition end, blur, disconnect, or a new focus clears that session. The next render writes the controlled `value`. A select runs its native `value` setter after its options on every controlled render, even when the getter already matches, so extra selections are cleared. Dropping `checked`, `value`, or `selected` leaves the live form state as it was. Development builds warn, for example `` `checked` dropped on a controlled input; pass it every render or use a catalog form component ``. The catalog will own form state through cores later. A file input `value` is never assigned `undefined`.

  Explicit `translate={false}` writes `no`; `spellcheck={false}` and `draggable={false}` write `false`. Nullish or omitted attributes are removed. String-valued `contentEditable` and `autocapitalize` keep their native tokens, and `hidden={false}` remains removal while `hidden="until-found"` remains distinct.

  JSX `innerText`, `textContent`, `outerText`, `innerHTML`, and `outerHTML` are unsupported on intrinsic elements. That is a TypeScript error. Development builds warn that each of those props is ignored and not applied, and production builds omit the warning. The props are never set and never reset. Children stay owned by the diff. They are unsupported in this beta, not deprecated until a later major. Use JSX children for text. A host `mount` may still assign `innerHTML` for trusted markup. `srcdoc` stays ignored and is not applied.

  `href`, `src`, `action`, `formaction`, and `xlink:href` accept only strings whose scheme passes the same executable-URL check projection documents already use. `codebase` uses that check in the renderer only. Projection documents do not treat `codebase` as a URI key. The attribute name is lowercased before that check, so `<object DATA>` and `<object Data>` use the same rule as `data`. `javascript:`, `vbscript:`, and HTML, SVG, or XHTML `data:` URLs are not applied. `script`, `iframe`, `frame`, `object`, `embed`, and `applet` also reject every other `data:` URL, including `data:text/javascript` and an empty `data:`. `codebase` on `object` and `applet` rejects `javascript:`, `vbscript:`, and every `data:` URL. `https:` and relative codebase values still apply. `data:image/*` still applies on `img` and `source`. Other values, including `https:`, `mailto:`, and relative URLs, are. Non-string URL values are not applied. A later blocked URL on a reflected native property, including `iframe` `src`, `object` `data`, and `embed` `src`, is cleared by removing the attribute. A boolean the DOM normalized, other than `checked` and `selected`, is reset to `false` and is not assigned `undefined`. Dropping `checked`, `value`, or `selected` does not assign `false`, `""`, or `undefined`. Reflected native URL properties `src`, `href`, `action`, `formAction`, and object `data` are cleared by removing the attribute. They are not assigned `undefined`. A custom-element property with one of those names, and a custom-element `codebase`, is cleared even when its setter normalized the previous value. A dropped property is chosen only because it was set last render and is absent now. That choice does not compare the stored value with the previous prop. A present `false` on an own custom setter is assigned `false`, including on the first mount. A custom element's own setter is assigned `undefined` only when a previously set property is absent now or changes to `null` or `undefined` (a property that was never set is not called), including when it stored `0`, `false`, `""`, or `NaN`, and including when that setter overrides an inherited name such as `id`. The setter treats `null` and `undefined` as empty before `Number`, `trim`, or `new URL`. On drop, leave `value`, `checked`, and `selected` untouched, reset `scrollTop` and `scrollLeft` to `0`, boolean props to `false`, and reflected attributes by `removeAttribute`. Two spellings of one prop on the same element are an authoring error: TypeScript rejects `acceptCharset` with `accept-charset`, `htmlFor` with `for`, `onClick` with `onclick`, `ariaLabel` with `aria-label`, and `className` with `class` on JSX tags and in `jsx()` calls. Development builds warn otherwise. Production behavior for those attribute spellings is unspecified. URL and `on*` guards still apply to every spelling. Dropping `defaultValue`, `defaultChecked`, or `defaultSelected` on a native element leaves that default as it was. `defaultChecked={false}` and `defaultSelected={false}` are sets. A native attribute or event key that is still present under another casing is not a drop. If the previous render set both spellings of one event and the next keeps one, the other listener is unbound. `htmlFor`, `HtmlFor`, `acceptCharset`, `AcceptCharset`, `className`, and `httpEquiv` remove `for`, `accept-charset`, `class`, and `http-equiv`. An ARIA IDL name such as `ariaLabel` removes `aria-label`. Every other native prop, including those defaults, `volume`, `playbackRate`, and `currentTime`, is left alone and no attribute is written. Dropping a custom element's own setter calls it with `undefined`, including a setter named `defaultValue`, `defaultChecked`, or `defaultSelected`. A present `false` is assigned `false`. Own custom setters stay case-sensitive, so `foo` and `FOO` are different keys. Drops apply before sets, so a setter or attribute written for a present spelling is never erased by the drop of a differently cased old one. The content-prop ban covers intrinsic elements only. `length`, `options`, and `selectedOptions` are never set or reset. A file input `value` is skipped and is never assigned `undefined`. A setter that throws is caught. A property that is not writable and has no setter is skipped. `base` `href` is not applied.

  String event-handler props are not applied in any case, including `ONCLICK`, `OnError`, and `xlink:onclick`. Function handlers still use `addEventListener` and do not create an attribute.

  `animate`, `set`, and `animateMotion` keep a string `attributeName`. That name is lowercased, whitespace and ASCII controls are removed, and any Clark `{namespace}` or namespace prefix is removed. When it is `href`, `from`, `to`, `by`, and `values` are not applied. A non-string `attributeName` is not applied, and those four values are not applied either. An absent or `null` `attributeName` is not an href target, so those values are kept (`animateMotion` uses them as paths); a later `attributeName` of `href` removes them. On update, a `from`, `to`, `by`, `values`, or `attributeName` that is dropped, changed, or blocked for the next props is removed before anything is written, so a blocked value is never present in the DOM at any point of a commit. `meta` refresh keys are normalized before `setAttribute` the same way a SMIL name is: lowercase, ASCII space and controls removed, then the local part after the last `:` or `}`. The only matches are `http-equiv` and `httpEquiv`. A trailing space or NUL in the key is that name, so it does not throw. A non-string is not applied, and a string that is `refresh` after that same stripping is not applied, so an array, a boxed string, a NUL, or a `toString` object cannot navigate. An ordinary attribute such as `data-equiv` is not that key. `content-type`, `Content-Type`, and `default-style` still apply. `srcset` candidate lists and `poster` are not checked. There is no cached built-in element. Own custom setters are found by a walk that stops before `HTMLElement`, so a setter overriding an inherited name such as `id` gets `undefined`. Reflected props use `removeAttribute`, and a loaded image `width` does not become `0`. A file input `value` is still never assigned `undefined`.

  `scrollTop`, `scrollLeft`, `indeterminate`, and `muted` are exact-name property sinks: a differently cased attribute spelling such as `SCROLLTOP` is a separate sink, and dropping the property still resets it without removing that attribute.

  A JSX strategy `detach()` drops a shadow root that was queued before the style injector loaded, and it drops a pending root so reconnecting that host does not style it. `flushPendingStyles()` does not write into a root while that root is disconnected. A root that was connected when it was queued, then disconnected during a move, stays pending and is styled when it reconnects. An Ignite element replays that parked root from `connectedCallback`, including when the host is appended into an already-connected parent shadow root. A shadow root whose host is not an Ignite element is replayed by a later JSX strategy `attach`. The document observer remains only as the fallback for those non-Ignite roots in light DOM. The same reconnect applies when the style injector itself loads during the move. A root that is removed, flushed, reinserted, and flushed again in the same task is styled once, and the reconnect observer disconnects when that last parked root is released. `detach()` also drops that root from the installed injector's `pendingRoots` and `parkedRoots`, including when `WeakRef` is missing, so the strong fallback is released. Roots that have not been connected yet still flush.

  Development builds warn that `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, and `srcdoc` are ignored and not applied. Those five content props are unsupported JSX props in this beta, not deprecated until a later major. They are never set or reset, and children stay owned by the diff. A host `mount` may still assign `innerHTML`; that imperative callback is the escape hatch for trusted markup. Development builds also still log JSX replace fallbacks. Production and default builds omit those warnings and the fallback diagnostics, and they do not reference `process`.

- c09c78e: Reconcile keyed JSX children by moving the existing nodes, and give `ref` the mount contract.

  `key` preserves node identity, focus, and input value across prepend, insert, removal, and reorder. Unkeyed siblings stay positional. Duplicate or mixed keys warn in development and match by position.

  `ref` is called with the element on mount. If the callback returns a function, that disposer runs on removal, host disconnect, and ref swap, and `ref(null)` is not also called. If the callback returns nothing, it is called with `null` in those same cases. Replacing the callback runs the previous cleanup, then calls the next callback with the same element. An unchanged callback does not run again on later renders.

  A host claim owns its subtree and is skipped by the differ. JSX `innerText`, `textContent`, `outerText`, `innerHTML`, and `outerHTML` are unsupported and do not own the subtree. Use JSX children for text, and hosts for trusted rich content.

- a5c559b: Remove the v3 beta projection-target factories and `core(target)` overload from
  all public entrypoints. DOM registration, headless reads/observation/commands,
  React bindings, tools, canvas refs and host lifecycles retain their contracts.

  Migrate application document consumers to `watch` with application-owned
  validation/delivery policy; retain source-owned ports for speech acknowledgement,
  cancellation and replay. Voice-workbench demonstrates this migration without new
  published APIs or private package imports.

  Preserve built host installation explicitly in source side-effect metadata, so
  removing target inspection cannot prune hosts/use or accessible descriptions.

### Patch Changes

- 4cc9287: A failed first `execute` on an independent core no longer leaves its actor, invoked services, or timers running. This covers a preparation failure and an unknown command. A projection that throws a falsy value such as `undefined`, `null`, `0`, `''`, or `false` now rejects `execute` instead of letting the command run. When releasing the quiet observation lease throws, `execute` now keeps the command's own result or rejection and logs the cleanup error with `console.error` instead of rejecting with it.
- e0498f5: Independent cores subscribe on the first `execute`, the same way `get("states")` does. Redux listeners and MobX observations start without a prior read. An existing watch keeps its own snapshot delivery. Untouched cores stay idle, and a user-started shared source is unchanged.
- a5c559b: Separate element reconnection signals from global stylesheet delivery so
  headless consumers can omit the stylesheet driver. Activate delivery when
  styles are selected or the injector is used, retaining explicit flush,
  reconnect, cancellation, and stylesheet validation behavior. Pending element
  roots use weak references where available. Public entrypoints and APIs remain
  unchanged.
- 1db8ce5: Ship development warnings through the `development` export condition.

  The `development` build keeps duplicate-key warnings and warns that `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, and `srcdoc` are ignored and not applied. It also keeps the renderer's internal diff flag and `ignite-element` event-origin diagnostics. It does not check `process`. The `production` and `default` builds compile those warnings out, so a consumer that ignores export conditions gets a bundle with no warning strings and no `process` reference.

  Vite and webpack select the condition from the build mode. `vite build --mode development` still selects the production file, because Vite's build sets `NODE_ENV=production`. Only the dev server, or an explicit `NODE_ENV=development`, picks the development build. Rollup needs `exportConditions: ["development"]` on `@rollup/plugin-node-resolve`. esbuild needs `--conditions=development`.

- 159fbe1: Resolve published declarations under TypeScript `NodeNext` and `node16`.

  Relative imports in the `.d.ts` graph now include the `.js` extension those modes require, so `igniteCore` callback parameters stay typed when `skipLibCheck` is on. Declaration maps shift with those edits, and both `build:types` and `build:js` rewrite the graph. The `types` condition stays first, and consumers that ignore custom export conditions still receive the production build.

- Updated dependencies [a5c559b]
- Updated dependencies [1db8ce5]
- Updated dependencies [4d19194]
- Updated dependencies [159fbe1]
- Updated dependencies [a7a6a0a]
- Updated dependencies [1144709]
- Updated dependencies [c09c78e]
- Updated dependencies [a5c559b]
  - @ignite-element/renderer@3.0.0-beta.19
  - @ignite-element/core@3.0.0-beta.19
  - @ignite-element/adapters@3.0.0-beta.19

## 3.0.0-beta.18

### Major Changes

- 2fed0ed: BREAKING (beta): `core.watch` delivers the current derived states on subscribe, with `previous === undefined`. This matches RxJS `BehaviorSubject` and XState `actor.subscribe`. Pass `{ emitCurrent: false }` to keep transition-only observation. That opt-out skips the initial call but still records the subscribe-time states as an undelivered baseline, so the first transition's `previous` is that baseline. After a value has been delivered, `previous` is the last value delivered to that subscription. Handlers that also call themselves with `get('states')` will double-apply; delete that seed. Ignite still does not add global deep equality. `observe` and `until` follow the same initial delivery, so `until` no longer seeds a second time. Targets 3.0.0-beta.18.

### Patch Changes

- @ignite-element/core@3.0.0-beta.18
- @ignite-element/adapters@3.0.0-beta.18
- @ignite-element/renderer@3.0.0-beta.18

## 3.0.0-beta.17

### Minor Changes

- 4c6447e: BREAKING (beta): `igniteTools` is named-only — `igniteTools({ core, schema, canExecute?, dialect? })`. The positional `igniteTools(core, dialect, opts)` overload is removed. `ToolSchema` is a bare command map (`{ toggleLight: { input, description?, gated? } }`), not `{ commands: { toggleLight: … } }`. Author with `satisfies ToolSchema` or `defineToolSchema`; discovery does not infer them. `canExecute` remains one `(name: string) => boolean` predicate for gated tools and defaults to always-available when omitted. Provider dialects export `textOf` so loops do not copy-paste response parsing. `run` stays act-plus-acknowledgement; async settle uses `observe`. `buildManifest` / `resolveCall` remain exported for advanced/testing only. Smart Home and everyday docs teach the consumer path.
- 9b0b00c: Add `until(match)` on the `igniteTools` bind next to `run` and `observe`. Everyday settle waits on the same observation stream as `observe` and unsubscribes on the first defined match (`undefined` / `false` / nullish keep waiting). `observe` remains for ongoing fan-in. Docs teach `run` + `until` instead of Promise + observe + unsubscribe boilerplate.

### Patch Changes

- @ignite-element/core@3.0.0-beta.17
- @ignite-element/adapters@3.0.0-beta.17
- @ignite-element/renderer@3.0.0-beta.17

## 3.0.0-beta.16

### Minor Changes

- 96f45d4: Return only the command-defined awaited value or void from core.execute and remove
  IgniteAgentExecutionResult. Migrate tools to explicit result/states/declared-event
  observations without native snapshots. Clarify completion and existing source
  ownership; migrate public consumers and docs. This is a breaking beta migration;
  the existing four-package fixed prerelease group determines version effects.

### Patch Changes

- @ignite-element/core@3.0.0-beta.16
- @ignite-element/adapters@3.0.0-beta.16
- @ignite-element/renderer@3.0.0-beta.16

## 3.0.0-beta.15

### Major Changes

- 4971409: BREAKING (beta): Command callbacks receive the resolved command target as `source`, replacing `actor` across all adapters. Replace `commands: ({ actor }) => ...` with `commands: ({ source: actor }) => ...`, or use `source` directly. The old property is removed without a compatibility alias. Source acquisition, command capabilities and native ownership are unchanged.

### Minor Changes

- f09c9d4: Give each React and React Native hook its own runtime for XState machines, Redux slices or fresh-store factories, and MobX fresh-observable factories. Keep synchronous inferred ctx, shared existing-source ownership, and separate explicit headless operations. Independent unmount now releases its owned runtime automatically; core disposal drains every committed runtime. Factories and initialization, including middleware/enhancers, must be safe to repeat and discard without external work or cleanup obligations.

  Retain independent state and active source resources through Activity hiding while view delivery is disconnected. Descendant layout effects and callback refs may issue commands after attachment; actual removal and core replacement release the old runtime.

- 05ee0a8: Remove the beta `cleanup` source-configuration option. Explicit values (including false and undefined) now throw before source acquisition. Shared cores retain application-level observation and activated effects across zero-consumer intervals until terminal disposal. Independent custom-element teardown and borrowed native-source ownership are unchanged.

### Patch Changes

- 89b9d98: Allow MobX and Redux factory sources to omit `adapter` when using their dedicated
  entrypoints. Preserve inferred states and commands, explicit matching adapters,
  and existing source acquisition and cleanup. The public root remains source-free.
- Updated dependencies [4971409]
- Updated dependencies [05ee0a8]
  - @ignite-element/core@3.0.0-beta.15
  - @ignite-element/adapters@3.0.0-beta.15
  - @ignite-element/renderer@3.0.0-beta.15

## 3.0.0-beta.14

### Minor Changes

- 0decc7f: Forward declared native source events through each connected Web Component's
  existing DOM event surface. Keep headless native delivery and flat payloads.
  Evaluate effects once per core/source instance and deliver each notification
  to eligible consumers. Infer native emitted names to reject competing effect
  emissions and incompatible public payload declarations; warn in development
  when both producers are observed at runtime without changing delivery.

  Infer precise Actor-Web native channels even when command and emission types
  overlap. Keep inferred headless events distinct from the explicitly declared
  component event map: undeclared native events do not advertise React callbacks.

  This change targets beta.14. Existing beta.13 artifacts are unchanged. If an effect
  re-emits an event already produced by the source, keep one production rule:
  retain the declaration for public discovery/handlers and remove that effect
  emission. Use a different effect-only name for a state-derived notification.

  Shared effects activate on runtime use or committed subscriptions/connections,
  then retain their baseline through zero-view gaps until core disposal. Isolated
  instances retain separate lifetimes. Migrate per-view callbacks and baselines
  to framework lifecycle facilities. Queued effects are not a framework commit
  barrier; core-owned failures use the console fallback, not a host error hook.

### Patch Changes

- @ignite-element/core@3.0.0-beta.14
- @ignite-element/adapters@3.0.0-beta.14
- @ignite-element/renderer@3.0.0-beta.14

## 3.0.0-beta.13

### Minor Changes

- e71ea90: Prepare shared-source bindings at owner-controlled core construction and permit
  terminal disposal of registered source-backed cores. Keep existing source inputs,
  application-owned source shutdown, isolated acquisition, ordinary commands and
  callable JSX registration. Document the intended readiness/error-timing migration
  and terminal tag lifetime. These behaviors are new relative to beta.12.

### Patch Changes

- @ignite-element/core@3.0.0-beta.13
- @ignite-element/adapters@3.0.0-beta.13
- @ignite-element/renderer@3.0.0-beta.13

## 3.0.0-beta.12

### Major Changes

- 910500a: Import and use source-backed cores in Node without fabricated browser globals.
  DOM registration now requires a browser and reports a synchronous registration
  error when unavailable. Renderer defaults are selected at registration rather
  than construction; explicit strategies bypass default selection.

  Preserve source-free registration and source-owned lifetimes while making
  observation handles idempotent and rolling back partial Actor-Web observations.
  The combined release adds explicit final core disposal and neutral declaration
  boundaries for headless and no-DOM consumers. Core cleanup releases Ignite-owned
  observations; it does not shut down caller-owned sources. React and React Native
  bindings borrow prepared cores, while applications retain preparation and final
  disposal ownership.

- 78b5c6d: Replace root `igniteShell` with source-free `igniteCore()` and remove the four
  shell-specific public types and `onConnect`/returned-teardown capability. This
  is a breaking change without an alias. Declarative consumers change their import
  and named construction; lifecycle consumers must supply application-owned
  presentation integration or a custom-element boundary for initial state, updates,
  cleanup and reconnection. Adapter-specific contracts remain unchanged, and native
  source shutdown remains application-owned.

  Keep root declarations independent of unselected ecosystem peers by importing
  existing adapter-neutral types directly from `@ignite-element/core`. This
  changeset is consumed into the local beta.12 candidate, awaiting publication verification.

- e653e51: Replace source-backed runtime getters with keyed discovery/state reads and derived-state
  watching. Add terminal disposal for unregistered owning cores, preserving caller-owned
  sources and the registered-core barrier. Remove command helpers and inferred metadata;
  ordinary commands retain typing, receiver, arity, return and promise identity. Tools
  use explicit application input definitions and availability predicates.

  Add the neutral prepared-core React/React Native hook at `ignite-element/react`.
  Move the existing custom-element wrapper to `ignite-element/react/web` and DOM-host
  Actor-Web factory construction to `ignite-element/actor-web/web`. Preserve source-native
  observations, per-element provisioning, and optional-peer isolation.

  This changeset is consumed into the local beta.12 candidate, awaiting publication verification. Authentic neutral
  Actor-Web source consumption additionally depends on the separately reviewed upstream
  source-only entrypoint; the already-published runtime package does not contain that fix.

- 21ec746: Retire the public testing DSL, dedicated testing/story types, source-backed
  `record(name)` method, story traces/summaries/lifecycle histories, and accessibility
  bridge. Replace them with ordinary assertions over retained runtime commands,
  events, snapshots and derived states, and DOM queries against real registered
  components. Portable story receipts and complete lifecycle recording are
  intentionally removed without aliases or a replacement recorder. Applications and
  sources retain ownership of asynchronous work and native lifetime.

### Patch Changes

- 998e6fc: # Correct core acquisition and React projections

  Keep borrowed shared adapters reusable after failed core preparation. Release
  provisional per-element web resources when connection setup fails, preserving
  the primary error and allowing reconnection. Preserve sparse arrays and
  enumerable symbol keys in detached framework projections, and forward string
  setter attributes such as `online` without confusing them with event callbacks.

  Close an owned web factory source when initial adapter construction fails,
  preserving the original setup error even if close fails. Headless factory and
  borrowed-source shutdown remains caller-owned.

- Updated dependencies [910500a]
- Updated dependencies [e653e51]
- Updated dependencies [998e6fc]
  - @ignite-element/renderer@3.0.0-beta.12
  - @ignite-element/adapters@3.0.0-beta.12
  - @ignite-element/core@3.0.0-beta.12

## 3.0.0-beta.11

### Major Changes

- 4b9effe: Make the v3 package family native ESM-only.

  Remove the CommonJS `main` and `require` contracts and stop publishing CommonJS
  or default UMD build artifacts. Consumers must use ESM imports. Existing public
  ESM entrypoints and their TypeScript declarations remain supported.

- 1b09e98: Narrow the v3 beta command and effect callback contract before stable release.

  Commands no longer expose a public `host` capability. Public command callbacks
  now receive `{ actor, command }`, so host-derived intent must be provided as
  explicit command input instead of being read from the runtime host.

  Effects no longer expose public `actor` or `host` capabilities and now receive
  only `{ snapshot, prevSnapshot, select, emit }`. Effects are synchronous
  transition-to-outward-fact callbacks: async work, retries, cancellation, and
  feedback into the source must move into source-native actors, actions, store
  methods, middleware, or transports.

  Public effect callbacks must return `undefined`/nothing so `async` functions are
  rejected at compile time. Inline callbacks can usually omit a return, while
  extracted or explicitly typed helpers may need an `undefined` return annotation
  plus an explicit `return undefined`.

  The runtime still keeps internal host ownership for DOM/headless event dispatch
  and error routing, and it now fails closed when untyped JavaScript effects
  return a thenable.

### Minor Changes

- a7486a9: Make `states(snapshot)` the canonical optional v3 projection contract. Config
  `view`, `getView`, and `watchView` are removed; headless schemas, execution
  results, stories, tests, and tools now use states vocabulary. XState entrypoints
  expose native `StateFrom<Machine>` snapshots instead of flattened
  `ExtendedState`, and public component renderers receive derived states and
  semantic commands without raw `state` or `send`.

### Patch Changes

- Updated dependencies [a7486a9]
- Updated dependencies [4b9effe]
- Updated dependencies [1b09e98]
  - @ignite-element/core@3.0.0-beta.11
  - @ignite-element/adapters@3.0.0-beta.11
  - @ignite-element/renderer@3.0.0-beta.11

## 3.0.0-beta.10

### Major Changes

- af43bd3: Finalize the pre-stable testing DSL cutover around object-form `igniteTest({ component, host? })` and Story-first composition.

  - Remove the positional `igniteTest(component, options?)` form in favor of the single object input.
  - Remove `.narrative(...)` and replace it with `.story(...)` as the only managed multi-step testing surface.
  - Make Story assertions adapter-neutral by keeping `snapshot` structural-only and moving arbitrary native snapshot predicates to `when(snapshot)`.
  - Add `story.behavior(name, operation)` so fixture-owned external collaborators record named before/after Story evidence on the existing trace without incrementing `commandCount`.

  Migration is mechanical for beta consumers: wrap the runtime in `{ component }`, rename `.narrative(...)` to `.story(...)`, move any predicate previously stored under `snapshot` to `when`, and wrap external actor/clock/network receipts in `await story.behavior(...)`.

### Patch Changes

- @ignite-element/core@3.0.0-beta.10
- @ignite-element/adapters@3.0.0-beta.10
- @ignite-element/renderer@3.0.0-beta.10

## 3.0.0-beta.9

### Major Changes

- ccdc9e5: Collapse `ActorWebAddress` to plain `string` now that `@actor-web/runtime@0.2.0` publishes the canonical branded string `ActorAddress`.

  The actor-web adapter no longer accepts the legacy object address shape from `@actor-web/runtime@0.1.x`; the optional actor-web peer floor is now `>=0.2.0`.

- cab2357: Breaking v3 beta: replace positional command calls with the `{ command, input? }` envelope across `igniteTest(...).when`, `IgniteAgentRuntime.execute`, and `IgniteStory.execute`, with no compatibility overloads.

  Export the shared mapped-union `IgniteCommandCall` type so command names preserve required, optional, and no-input inference across runtimes and adapters. `igniteTools` now translates provider `{ name, arguments }` calls into the runtime command envelope, accepts omitted input or `{}` for true no-argument commands, and returns `InvalidInput` for unexpected no-argument input.

### Minor Changes

- 8201902: Canonicalize events on the flat tagged `{ type, ...fields }` member shape for v3 beta. Effects now emit with `emit({ type, ...fields })`, and the headless runtime, tools, story summaries, and `expectEvent` assertions now observe the same flat member instead of the previous `{ type, payload }` envelope.
- a72d01d: Add `igniteTest(...).narrative(name, async (narrative) => ...)` as a typed multi-step test helper over the existing Story recorder.

  Narratives keep the current `{ command, input? }` command-call shape, allow assertion-only `given(...)` preconditions, run multiple ordered `intent(...)` steps, expose named expectation-driven checkpoints over the current snapshot/view plus `canExecute(...)` and the last intent's events, and return the existing `IgniteStorySnapshot` receipt shape.

- 8201902: Rename the headless runtime and testing surfaces from state to snapshot for the v3 beta cutover. The test DSL now exposes `expectSnapshot(...)` instead of `expectState(...)`; execution results return `{ snapshot, events }`; schemas return `snapshot`; story summaries return `finalSnapshot`; and story traces record `kind: "snapshot"` entries with a `snapshot` value.
- 787b6c8: Make the headless agent runtime DOM-free, so `getSchema()` / `execute()` / `on()` / `watchView()` work in pure Node and edge runtimes with no jsdom polyfill.

  The agent runtime is meant to be headless, but it allocated its internal host element via `document.createElement`, so `getSchema()` / `execute()` threw `document is not defined` in a non-DOM runtime. That host is only ever used as an **EventTarget** — `on()` registers `host.addEventListener` / `removeEventListener` and effect emits go through `host.dispatchEvent` — so a real element was never required for headless use. `createRuntimeHost` now falls back to a bare `EventTarget` when there is no `document` (Node 22 ships `EventTarget` + `CustomEvent` globally), and keeps `document.createElement` when a real or jsdom DOM is present (no behavior change in the browser or in tests). The DOM render path (the custom element / DOM bridge) is unchanged and still requires a real DOM. This unblocks running an igniteTools agent loop — the act → observe → act surface — headless on a server, CLI, or edge device with zero DOM shim.

- b94d375: Add the `igniteShell` sourceless composition-root primitive and make isolated
  `igniteCore` elements preserve their adapters across same-tick DOM moves.
- fe3fc74: Add the Anthropic `ToolDialect` adapter — the first provider dialect for igniteTools — on a new `ignite-element/tools/anthropic` entrypoint, and refine the `ToolDialect` port to its final shape.

  - **Added — `ignite-element/tools/anthropic`:** a pure, SDK-free `anthropic` dialect (no `@anthropic-ai/sdk` runtime dependency) that translates the neutral manifest to/from the Anthropic Messages tool-use wire format — `tools()` emits `{ name, description?, input_schema }` defs, `toolCalls()` extracts `tool_use` blocks, and `toolResult()` renders `tool_result` blocks (`is_error: true` on a failed call). The consumer brings the SDK and runs the model loop.
  - **Added — shared scalar round-trip (`tools/scalar.ts`):** `toProviderInputSchema`/`fromProviderInput` object-wrap a single-arg command's scalar input under a `value` key for the model and unwrap the returned `{ value }` on the way back — gated on the manifest schema, so an object command with its own `value` field is never unwrapped (collision-free). The neutral manifest stays scalar-honest; wrapping lives only at the provider boundary. PR3 (OpenAI/Ollama) reuses these verbatim.
  - **Breaking (pre-stable beta igniteTools surface) — `ToolDialect` port + `igniteTools` result renamed to bare ecosystem nouns:** `toToolDefs` → `tools`, `parseToolCalls` → `toolCalls` (now `toolCalls(response, manifest)`, the manifest threaded in for scalar unwrap), `toToolResult` → `toolResult`; the consumer execution verb `invoke` → `run`. The bound first argument/type is now `runtime` / `IgniteToolsRuntime` (was `component` / `IgniteToolsComponent`) — it is the agent runtime, not a UI element. `ToolObservation` is unchanged: `run`/`execute` remain act-plus-acknowledgement observations (state at command-acknowledgement; ongoing/remote effects are observed via the view/event stream).

- 6fe71e2: Add the SDK-free `ignite-element/tools/openai` ToolDialect for OpenAI-compatible Chat Completions tool calls, including OpenAI, Ollama, and MLX servers exposed through `/v1/chat/completions`.
- eabc37d: igniteTools: surface the derived **view** in `ToolObservation` so an agent grounds on the read-model, not just the raw snapshot.

  `run()`'s observation is now `{ snapshot, view, events }` (was `{ snapshot, events }`). `igniteTools` binds `getView` — added to the `IgniteToolsRuntime` surface alongside `getSchema`/`execute` — and captures it at command-acknowledgement, so every observation, and thus every provider `tool_result` a dialect serializes, carries the view (the derived read-model, e.g. `lightsOn`/`allDoorsLocked`) the design says agents should ground on, distinct from the raw snapshot. `ToolObservation<Snapshot, Events>` gains a `View` type parameter (`ToolObservation<Snapshot, View, Events>`) and `NeutralToolResult` threads it through. Breaking to the pre-stable beta igniteTools surface (the observation shape + the `IgniteToolsRuntime` pick); the Anthropic dialect needs no change (it serializes the whole observation). Found while dogfooding the headless smart-home agent example.

- b0f3aee: Add command availability predicates through `command(fn, { canExecute })` and expose the headless runtime `canExecute(name)` query, with gated commands marked in `getSchema()`.

### Patch Changes

- 02b9381: Remove the positional effects callback form for v3 beta. Effects callbacks now
  use only the object-form signature:
  `({ snapshot, prevSnapshot, actor, emit, host, select }) => { ... }`.
- bb19f3d: Tighten igniteTools scalar provider envelopes by publishing `additionalProperties: false` on scalar wrappers and rejecting malformed `{ value, ...extra }` provider inputs as `InvalidInput`.
- Updated dependencies [ccdc9e5]
- Updated dependencies [02b9381]
- Updated dependencies [8201902]
- Updated dependencies [787b6c8]
- Updated dependencies [b94d375]
- Updated dependencies [fe3fc74]
- Updated dependencies [eabc37d]
- Updated dependencies [b0f3aee]
  - @ignite-element/adapters@3.0.0-beta.9
  - @ignite-element/core@3.0.0-beta.9
  - @ignite-element/renderer@3.0.0-beta.9

## 3.0.0-beta.8

### Minor Changes

- b263e78: Unify the actor-web adapter config surface and accept actor-web's opaque branded address.

  **Breaking — `commandSource` and `ActorWebSourceHandle` removed.** Every adapter now takes a single `source`, so the config surface is uniform: `{ source, view, commands, effects, events }`. The actor-web read/write `commandSource` config key and the `ActorWebSourceHandle` source-bundle are gone — the command actor derives from the single `source` (writable iff it exposes `send`); a read-only source yields no command actor (command dispatch is a no-op with a dev warning, unchanged). Migrate `igniteCore({ source: readModel, commandSource: cmd, … })` to a single command-capable `source`. actor-web's read/write split, when needed, lives inside the source object — not a second `igniteCore` key.

  **Address contract — `ActorWebAddress` accepts actor-web's opaque branded address.** actor-web's canonical `ActorAddress` collapsed from an object interface to an opaque branded `string`. Ignite's loose `ActorWebAddress` is widened to `string | { id; path; type?; node? }` so the compile-time drift guard against `@actor-web/runtime` stays green for both the published object-address runtime and the new branded-string runtime. The address is opaque to Ignite (pass-through only — never read for `.id`/`.path`/`.node`), so it will later collapse to plain `string` once actor-web publishes the branded address and Ignite bumps the dep.

- 8561826: Add `expectView(expected)` to the test DSL — assert the projected view (mirrors the runtime's `getView()`) alongside `expectState`. Accepts a deep-partial object match or a predicate over the view.
- 27d6579: Expose the projected view in `getSchema()` as `IgniteAgentSchema.view`, beside `state`. An agent introspecting a component now sees the derived view shape it binds to — typed from the `view` callback's projection (`getSchema().view` mirrors `getView()`), rather than only the raw `state` snapshot. Additive: `commands`/`events`/`state` are unchanged, and `view` defaults to `IgniteSchemaValue` for the loose `IgniteAgentSchema` default. Pre-stable type addition (the view projection now flows end-to-end into the schema surface).
- 33b617d: Add `igniteTools(component, dialect?)` and a new `ignite-element/tools` entrypoint — the hexagonal bridge from the agent-runtime contract (`getSchema()` + `execute()`) to LLM tool-use. This first piece is the SDK-neutral core: a pure functional core (`buildManifest(getSchema())` → neutral tool manifest; `resolveCall(name, input)` → validated `{ command, payload }`), the `ToolDialect` port (`toToolDefs`/`parseToolCalls`/`toToolResult`), and an imperative shell (`invoke()` → the single `execute` side effect). Errors are values, not exceptions: `resolveCall`/`invoke` return a `Result<…, ToolError>` (`UnknownCommand` · `InvalidInput` · `Unavailable` · `ExecuteFailed`) so a failed call is data the agent maps to a provider `tool_result`, never a throw across the seam. Availability-gated commands compose with `canExecute` when present (duck-typed; all commands offered without it). The neutral core is usable directly; a `ToolDialect` shapes provider tool defs and parses/formats calls. No provider SDK ships here — the Anthropic and OpenAI (Codex/Ollama-compatible) adapters land as separate `ignite-element/tools/*` entrypoints. Design: `docs/ignite-tools.md`.
- 95aedff: Type the test DSL's `expectView` from the runtime's view projection. `igniteTest(component).expectView(...)` now sees the projected view's keys with their value types — mirroring `getView()` — instead of falling back to `Record<string, unknown>`. The runtime `IgniteCoreReturn` already surfaced the projection into `getView()`/`watchView()`/`record()`; the test DSL's `RuntimeView` extractor was reading the wrong runtime generic (schema state) and now reads the view projection. Pre-stable type tightening (loose → typed); no runtime behavior change.

### Patch Changes

- Updated dependencies [b263e78]
  - @ignite-element/core@3.0.0-beta.8
  - @ignite-element/adapters@3.0.0-beta.8
  - @ignite-element/renderer@3.0.0-beta.8

## 3.0.0-beta.7

### Minor Changes

- 571b93a: Export `IgniteReactRef<Handle>` from `ignite-element/react` — the public type for naming the imperative ref of a component built by `igniteReact`.

  `IgniteReactRef<typeof Handle>` resolves to the `CommandHandle` derived from the handle's command schema, so a consumer can type a `useRef` without hand-writing the command shape (and without drift from the element's commands):

  ```ts
  import { type IgniteReactRef, igniteReact } from "ignite-element/react";
  import { Counter as CounterEl } from "./counter.ignite";

  const Counter = igniteReact(CounterEl);
  const ref = useRef<IgniteReactRef<typeof CounterEl>>(null); // { increment; decrement; setLabel }
  ```

  This closes a gap in the `ignite-element/react` entrypoint: `React.ComponentRef<typeof Counter>` resolves to `never` for the synthesized `forwardRef` component, so there was no clean way to name the ref type. Type-only and additive — no runtime change.

- 82f784b: Add the `ignite-element/react` entrypoint (`igniteReact`) and make registration return a typed `IgniteComponent` handle.

  Ignite elements were always consumable from React through the custom-element surface, but imperatively — a hand-written element interface, JSX declaration, event wiring, and ref plumbing kept in sync by hand. `igniteReact` reuses the `getSchema()` metadata ignite already emits for agents to generate an idiomatic, typed React component from a single handle, with no manual type arguments.

  - **New (`ignite-element/react`):** `igniteReact(component)` returns a typed `forwardRef` React component. Commands → the imperative ref API (`CommandHandle<Commands>`); single-arg `setX` commands → optional string props (set as attributes, mirroring `inferObservedAttributes`); the events map → `on<Event>` callback props receiving the **flat** event member (`event.detail` is forwarded directly — never the `{ type, payload }` envelope). `react` is an optional peer dependency of this entrypoint only.
  - **Changed (`ignite-element`):** registration (`igniteCore(config)(tag, render)`) now returns a typed `IgniteComponent<Commands, Events>` handle (was `void`) carrying `tagName` and a `getSchema()` that delegates to the same single agent-runtime source of truth. Additive — callers that ignore the return are unaffected — and useful beyond React (a typed per-element handle also sharpens the test DSL and agent ergonomics).
  - **Generalizes:** the same handle + `getSchema()` drives Vue/Svelte/Angular wrappers as follow-up entrypoints.

  Pre-stable: lands in Phase 1 before the breaking cutover so the React demo (`src/examples/frameworks/react`) showcases it.

- 5ca4686: Render lit-html views config-free — no `ignite.config.ts` required.

  The config-free default render-strategy resolution now auto-detects the view output: a lit-html `TemplateResult` (when `@ignite-element/renderer/lit` is imported) routes to the `lit` strategy, and everything else routes to `ignite-jsx` (unchanged). Previously, selecting lit required `ignite.config.ts` plus the Vite config plugin; a lit-html view authored without it rendered a blank `<!--ignite-unknown-->`. An explicit `renderer` in `ignite.config.ts` still wins.

  Backward-compatible: ignite-jsx views are unchanged (the wrapper attaches ignite-jsx eagerly and never switches), and a lit-html view rendered without registering the lit strategy still falls back to ignite-jsx exactly as before — no new throw or warning. See `docs/renderer-selection.md`.

- 75cd1c2: `XStateCommandActor` now exposes xstate-native `getSnapshot()` and the invented `.state` accessor is removed.

  The command actor handed to `commands`/`effects` (`({ actor }) => …`) is deliberately adapter-native — Redux exposes `{ dispatch, getState }`, MobX is the store, Actor-Web is its command source. The XState command actor was the lone outlier: it exposed an ignite-invented `readonly state` getter instead of xstate v5's native `actor.getSnapshot()` (which is also the runtime's snapshot vocabulary). Reading current state inside a command/effect now uses `actor.getSnapshot().context.…` instead of `actor.state.context.…`, so there is one snapshot vocabulary across the whole surface and no library-specific alias to learn.

  - **Changed (`@ignite-element/adapters`):** `XStateCommandActor<Machine>` is now `{ send; getSnapshot(): ExtendedState<Machine> }` (was `{ send; readonly state }`). Same value, native method name.
  - **Migration:** in XState `commands`/`effects`, replace `actor.state` with `actor.getSnapshot()`. (Redux/MobX/Actor-Web command actors are unchanged.)

  Pre-stable cleanup: lands before `3.0.0`. Completes the source-native vocabulary alignment begun in the adapter-contract snapshot-naming change.

### Patch Changes

- Updated dependencies [5ca4686]
- Updated dependencies [75cd1c2]
  - @ignite-element/renderer@3.0.0-beta.7
  - @ignite-element/core@3.0.0-beta.7
  - @ignite-element/adapters@3.0.0-beta.7

## 3.0.0-beta.6

### Patch Changes

- 82dfa1f: Honor source ownership for shared cores. A consumer-owned source (an
  already-live instance passed to `igniteCore` → shared scope) now lives for the
  core's lifetime instead of being torn down when the element refcount transiently
  hits zero — e.g. an outlet swapping pages, which previously froze every page's
  reads with a stale snapshot.

  - `cleanup` now defaults to `false` for shared scope (consumer-owned sources);
    isolated scope, where ignite owns one adapter per element, keeps per-element
    teardown. Pass `cleanup: true` to opt a shared core back into element-refcount
    teardown.
  - Adapters generalize `ownsActor` → `ownsSource`: `stop()` only tears down the
    underlying source when ignite created it. Fixes `ActorWebAdapter` closing a
    consumer-owned source it did not create; XState behavior is unchanged.

  Ownership is inferred from what you pass to `source` (a live instance vs a
  factory) — no new public option. Fixes the shared-router/SPA footgun.

  - @ignite-element/core@3.0.0-beta.6
  - @ignite-element/adapters@3.0.0-beta.6
  - @ignite-element/renderer@3.0.0-beta.6

## 3.0.0-beta.5

### Major Changes

- 74e4700: Remove the deprecated pre-stable API surface (T7). Everything removed here had warned in dev mode since the canonical names landed in the v3 beta line.

  - **Removed runtime aliases:** `getState()` (use `getSnapshot()`), `watch(handler)` (use `watchSnapshot(handler)`), and `subscribe(eventName, handler)` (use `on(eventName, handler)`), along with their once-per-process dev warnings.
  - **Removed config alias:** the `states` projection option on every adapter config (xstate, redux, mobx, actor-web) and the low-level factories — use `view`. The `FacadeStatesCallback` and `AnyStatesCallback` types are gone with it.
  - **Removed type alias:** `IgniteAgentStateListener` — use `IgniteAgentSnapshotListener`.
  - **Removed:** `IgniteElement.forceRender()`, which had been slated for removal since v2. Rendering is driven by state changes; there is no supported imperative re-render.

  Migration is mechanical: rename `states:` config keys to `view:`, `getState()`/`watch()`/`subscribe()` calls to `getSnapshot()`/`watchSnapshot()`/`on()`, and `IgniteAgentStateListener` to `IgniteAgentSnapshotListener`. The canonical surface is unchanged.

### Minor Changes

- 75abf87: Align the internal `IgniteAdapter` contract with the public `igniteCore` snapshot vocabulary so the adapter-authoring surface reads consistently with the runtime it feeds.

  - **Renamed (core `IgniteAdapter`):** `getState()` → `getSnapshot()`, `subscribe(listener)` → `subscribeSnapshots(listener)`. (The optional emitted-event method is `subscribeEvents()`.) This is the contract custom adapters implement; the built-in XState/Redux/MobX/Actor-Web adapters, the runtime bridge, and the projection factories all move to the new names.
  - **Unchanged — public API:** the headless runtime keeps `getSnapshot()`, `watchSnapshot()`, `on()`, `execute().events`, and `record()`. Application code and command/view/effects authoring are unaffected.
  - **Unchanged — source-native vocabulary:** adapters still speak their source's language internally — Redux `store.getState()`/`store.subscribe()`, XState `actor.getSnapshot()`/`actor.subscribe()`, Actor-Web `source.snapshot()`/`source.subscribeEvent()`. Only the Ignite-facing contract names changed.

  Pre-stable cleanup: this lands before `3.0.0` so the adapter contract ships stable with one consistent vocabulary. Only authors of custom `IgniteAdapter` implementations need to rename the three members.

### Patch Changes

- Updated dependencies [75abf87]
- Updated dependencies [74e4700]
  - @ignite-element/core@3.0.0-beta.5
  - @ignite-element/adapters@3.0.0-beta.5
  - @ignite-element/renderer@3.0.0-beta.5

## 3.0.0-beta.4

### Minor Changes

- 484d3f3: Add `@actor-web/runtime` as an optional peer dependency of `@ignite-element/adapters`, with compile-time drift-proofing against its canonical neutral source types.

  The adapter's public `ActorWeb*` types stay self-contained and deliberately looser than the canonical contract (optional `subscribeEvent`/`transportStatus`/snapshot helpers, so barebones and foreign sources remain accepted), and the optional peer never enters the shipped type graph. A typecheck-only assertion suite now pins the relationship — every real `@actor-web/runtime` source (`ActorReadModelSource`/`ActorCommandSource`) is verified assignable to the adapter's accepted shape, and transport-status/event-subscription shapes are verified field-identical in both directions — so upstream contract drift fails the build instead of surfacing in consumers. No runtime behavior change; consumers without `@actor-web/runtime` are unaffected.

- c7fac99: Canonicalize the headless-runtime raw-read surface on snapshot vocabulary and the projection config on `view`, with a clean deprecation path.

  - **Added:** `getSnapshot()` and `watchSnapshot(handler)` on the headless runtime as the canonical raw-read accessor and subscription, restoring symmetry with `getView()`/`watchView()`. Added the `IgniteAgentSnapshotListener` type.
  - **Deprecated (still functional, dev-mode `console.warn`, removed at stable v3):** `getState()` → use `getSnapshot()`; `watch(handler)` → use `watchSnapshot(handler)`; the existing `subscribe(eventName, handler)` alias now also warns (use `on`); the `states` projection config option and `FacadeStatesCallback` type → use `view`. `IgniteAgentStateListener` is kept as a deprecated alias of `IgniteAgentSnapshotListener`.

  No behavior change: every deprecated alias delegates to its canonical counterpart and continues to work through the v3 beta. The deterministic-effects contract, `getView`, and the headless runtime remain identical across all four adapters.

- 3254246: Add a uniform, optional emitted-event streaming seam so sources with a native event side-channel surface their domain events through the headless runtime automatically.

  - **Added (core):** optional `stream?(listener): { unsubscribe() }` on `IgniteAdapter`, plus a third `Emitted` type parameter (default `never`). Adapters that emit no source events simply omit the method — fully backward-compatible.
  - **Added (runtime):** `createAgentRuntime` bridges the seam — `on(type)` forwards source emits of that type for the subscription's lifetime, and `execute()` captures emits during the command window into `result.events` (independent of the declared `events:` map); `record()` inherits both. Uniform shape: an emitted member `M` surfaces as `{ type: M.type, payload: M }` in `execute().events` and as `event.detail === M` in `on(...)` handlers. Subscriptions are per-consumer and leak-free.
  - **Added (actor-web):** `ActorWebAdapter` implements `stream()` by wrapping the source's optional `subscribeEvent`, and the source's distinct `Emitted` union threads into the runtime `Events` typing — `on()`/`execute().events` are typed from the source with no manual type arguments.

  No behavior change for non-emitting adapters (XState/Redux/MobX) or for effects-declared events, which keep flowing alongside the bridge. `getSchema().events` still lists declared event names only; source-emitted types are dynamic and observable via `on(...)`/`execute().events`.

### Patch Changes

- Updated dependencies [484d3f3]
- Updated dependencies [c7fac99]
- Updated dependencies [3254246]
  - @ignite-element/core@3.0.0-beta.4
  - @ignite-element/adapters@3.0.0-beta.4
  - @ignite-element/renderer@3.0.0-beta.4

## 3.0.0-beta.3

### Patch Changes

- 6e4fa40: Fix #57: toggling an element between JSX children and an `innerHTML` /
  `dangerouslySetInnerHTML` / `textContent` branch across re-renders now
  **replaces** the previous subtree instead of appending duplicate children.
  As of this beta, an `innerHTML` branch owned the subtree (child diffing was
  skipped), and when an element switched back to JSX children the renderer
  hard-cleared the subtree with `replaceChildren()` before diffing, so child
  count no longer accumulated on each round-trip. Later betas do not apply
  `innerHTML`, `outerHTML`, or `srcdoc`, and those props do not own the subtree.
  `textContent` still renders and stays deprecated.
  - @ignite-element/core@3.0.0-beta.3
  - @ignite-element/adapters@3.0.0-beta.3
  - @ignite-element/renderer@3.0.0-beta.3

## 3.0.0-beta.2

### Minor Changes

- Publish the supporting packages under the `@ignite-element` npm scope: `ignite-core` → `@ignite-element/core`, `ignite-adapters` → `@ignite-element/adapters`, `ignite-renderer` → `@ignite-element/renderer`. The main `ignite-element` package keeps its unscoped name. Import paths move accordingly (e.g. `@ignite-element/adapters/xstate`); `ignite-element` consumers are unaffected since the siblings are internal dependencies resolved at install time.

### Patch Changes

- Updated dependencies
  - @ignite-element/core@3.0.0-beta.2
  - @ignite-element/adapters@3.0.0-beta.2
  - @ignite-element/renderer@3.0.0-beta.2

## 3.0.0-beta.1

### Minor Changes

- Mark the state-library and renderer peers as optional so consumers only install what they actually use. `xstate`, `redux`, `@reduxjs/toolkit`, and `mobx` are pick-one adapters, and `lit-html` is only needed for the opt-in `lit` render strategy — the default renderer is `ignite-jsx`, which pulls no `lit-html` at runtime. Installing `ignite-element` with one adapter (e.g. `npm i ignite-element xstate`) no longer drags in the other state libraries or emits unmet-peer warnings for them.

### Patch Changes

- Updated dependencies
  - ignite-adapters@3.0.0-beta.1
  - ignite-renderer@3.0.0-beta.1
  - ignite-core@3.0.0-beta.1

## 3.0.0-beta.0

### Major Changes

- 75061c1: Narrow the stable public API for v3 so `ignite-element` only publishes the root entrypoint, adapter entrypoints, JSX entrypoints, and package metadata.

  Removed the stable `ignite-element/config/*` and `ignite-element/renderers/*` subpaths, and removed root exports for config loaders, renderer strategy registration, global style mutation, and factory internals. `ignite-renderer` does not replace those removed public subpaths with new stable loader or plugin APIs. Advanced apps that still need shared styles or renderer diagnostics should import the underlying `ignite-renderer` config primitives directly in app-owned code, while the old loader/plugin behavior remains internal compatibility rather than part of the public v3 API.

  Added export-boundary verification that locks the public subpath allowlist, checks `typesVersions` parity, and fails if removed stable paths are reintroduced.

  Documented the v3 agent runtime contract: `execute(...)`, `story.execute(...)`, and `story.until(...)` are Promise-returning APIs. Story workflow helpers now expose serializable snapshots through `IgniteStorySnapshot`, `IgniteStoryTraceSnapshot`, `IgniteStorySnapshotEvent`, and `IgniteStorySummarySnapshot`, with snapshot summary state, view, and event payloads represented as `IgniteSchemaValue` JSON data.

### Minor Changes

- 3dd4dd2: Promote the view-first single-source DX so object snapshots spread their fields directly onto the view context. `ViewContext<Snapshot>` now resolves to `Snapshot & { snapshot: Snapshot }` for object snapshots, letting view callbacks destructure `context`, `transport`, `phase`, etc. at the top level while `snapshot` stays available for the full read model. Non-object snapshots keep the `{ snapshot }` shape.

### Patch Changes

- Updated dependencies [3dd4dd2]
  - ignite-core@3.0.0-beta.0
  - ignite-adapters@3.0.0-beta.0
  - ignite-renderer@3.0.0-beta.0

## Unreleased

### Major Changes

- Shift `igniteCore` to an effects-driven event model: commands now express intent, `effects(snapshot, prevSnapshot, ctx)` handles typed DOM event emission, and the runtime exposes headless `execute`, `getState`, and `subscribe` helpers.
- Align package boundaries with ADR-003: `ignite-core` is now contract-only, `ignite-adapters` no longer exposes `igniteCore` authoring builders, and component authoring lives on `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx`.
- Tighten default `igniteCore` adapter inference so zero-argument Redux, MobX, and Actor-Web source factories are no longer executed or inferred without an explicit adapter. Use `adapter`, an adapter-specific entrypoint, or a required host-context Actor-Web factory for omitted-adapter inference.
- Align the agent runtime TypeScript contract with runtime behavior: `execute(...)`, `story.execute(...)`, and `story.until(...)` now return Promises.
- Add serializable workflow/story snapshots through `IgniteStorySnapshot`, `IgniteStoryTraceSnapshot`, `IgniteStorySnapshotEvent`, and `IgniteStorySummarySnapshot`; snapshot summary state, view, and event payloads are modeled as `IgniteSchemaValue` JSON data.

### Deprecations

- `emit` has been removed from `commands()`. Move DOM event emission into `effects()`.
- Migration tooling is available via `pnpm run migrate:effects-events` and `docs/migrations/v2.2.3-effects-events.md`.
- Advanced package-boundary migration guidance is available at `docs/migrations/adr-003-package-boundaries.md`.

## 2.2.2

### Patch Changes

- 04e262f: - Fixed igniteCore event typing so emit stays strongly typed even when commands appear before events, preventing typos from compiling.

  - Tightened event definition types (AnyEventsDefinition now uses EventMap) and updated tests to cover the commands-before-events scenario.

## 2.2.1

### Minor Changes

- Add diffing renderer rollout: Ignite JSX now patches DOM in place by default with append-only guard, optional `strategy` config (auto-diff unless `strategy: "replace"`), per-component opt-out via `data-ignite-nodiff`/denylist/`data-ignite-hydrated`, and internal `IGNITE_DIFF_ENABLED` flag (default on). Fallback logging hooks report replace events; docs updated with rollout notes.

## 2.2.0

### Minor Changes

- fix globalStyles application so late-loaded configs flush styles into pending shadow roots, and align the Vite config plugin/tests with the resolved loadIgniteConfig import path.
- fix Vite config loader to resolve loadIgniteConfig via a browser-safe path; inject globalStyles reliably across components.
- ensure defineIgniteConfig is applied when loaded and flush pending shadow roots to inject styles after config load.
- improve shadow style injection robustness and logging, then remove debug output.
- clarify docs: globalStyles is shadow-scoped; app shell/light-DOM styles should be imported separately.

## 2.1.0

### Minor Changes

- Move adapter usage to adapter-specific entrypoints. The root `ignite-element` entry no longer exports `igniteCore` or adapter helpers; import from `ignite-element/xstate`, `ignite-element/redux`, or `ignite-element/mobx` instead.

## 2.0.2

### Patch Changes

- 5d1acf9: - Fix ignite config Vite loader (root-relative imports) and restore webpack plugin export surface.
  - Add JSX runtime entrypoints + DOM polyfill wiring; tighten igniteCore/Facade typings and command actor wrapper.
  - Emit declarations to dist/types (excluding tests) and align package exports for config/vite, config/webpack, and JSX runtimes.
- 5d1acf9: set up the beta release flow, tighten redux adapter unsubscribe handling, and align example/tooling configs for the prerelease build

## 2.0.0-beta.2

### Major Changes

- af8561a: set up the beta release flow, tighten redux adapter unsubscribe handling, and align example/tooling configs for the prerelease build

## 2.0.0-beta.1

### Major Changes

- Centralised configuration with `ignite.config.ts`, `defineIgniteConfig`, and optional Vite/Webpack plugins so apps can declare global styles and renderer choice without touching runtime code.
- Renderer strategies extracted from the core runtime; Ignite JSX now ships as the default renderer with `jsx`/`jsxs`/`jsxDEV` factories, while the lit strategy remains available via configuration.
- Adapter inference and entry points ensure `igniteCore` auto-detects Redux slices/stores, XState machines/actors, and MobX observables/factories, letting bundlers tree-shake optional peers.

### New Features

- Typed event emission via an `events` map that injects a strongly typed `emit` helper and host reference into command callbacks.
- Shared adapter lifecycle now reference-counts subscribers and tears down when the last host disconnects, with an opt-out for manual control.
- Facade ergonomics improved so `states`/`commands` callbacks infer their return types directly from the provided source.

### Documentation & Examples

- README, guides, and migration notes updated for the config workflow, renderer strategies, and typed events API.
- Examples refreshed to lazy-load only the adapters they need, including Tailwind v4 and Redux live CSS updates.

### Quality

- Expanded unit/integration coverage across configuration loading, renderer strategies, typed events, and adapter lifecycle; verified the full build/test/typecheck matrix for the v2 prerelease.

## 1.4.7

### Patch Changes

- a96d055: Improve Redux typing inference, add typecheck script, and keep unsupported adapter errors consistent.

## 1.4.6

### Patch Changes

- Fix workspace configuration so pnpm 9 installs succeed under Node.js 22 in CI
- Replace ESLint with Biome for linting and formatting

## 1.4.4

### Patch Changes

- c07f7be: Adjust documentation

## 1.4.3

### Patch Changes

- 4104ae9: Fix duplicate stylesheet fetching

## 1.4.1

### Patch Changes

- 6ed2a0f: Exclude examples and tests from packaged bundle

## 1.4.0

### Minor Changes

- f131b10: Refactor XStateAdapter for Unified API

## 1.3.1

### Patch Changes

- 050b368: Remove examples from published package

## 1.3.0

### Minor Changes

- 6b2c06c: Expose setGlobalStyles function for global styling

## 1.2.1

### Patch Changes

- fd292e3: set eslint-plugin-security to dev dependencies

## 1.2.0

### Minor Changes

- ec0d98e: ### Features

  - **Decorators for Reactive Components**: Added `Shared` and `Isolated` decorators to enable reactive, class-based components with support for XState, Redux, and MobX.
  - **DOM Event Handling**: Enhanced the `send` method to support DOM events, improving interoperability and enabling dynamic updates.
  - **Gradient Tally Example**: Added an example showcasing dynamic rendering with gradient tally effects using lit-html.

  ### Improvements

  - **Initialization Guard**: Moved `_initialized` flag handling to `IgniteElement` for better DOM readiness and SSR support.
  - **Redux Adapter Enhancements**: Added type-safe dispatch and dynamic state management for slices and stores.
  - **Test Enhancements**: Suppressed console warnings and errors during test runs for cleaner output.
  - **CI/CD Integration**: Added **Codecov** integration with 80% coverage enforcement and reporting.

  ### Documentation

  - Updated README to explain web standards leveraged by `ignite-element` and added links to official documentation for reference.

## 1.1.0

### Minor Changes

- 9385692: Refactored global styles handling and updated style injection API. Added deprecation warnings for `styles.paths` and `styles.custom`.

All notable changes to this project will be documented in this file. See [Changesets](https://github.com/changesets/changesets) for release and versioning guidelines.

## 1.0.13 to 1.0.19 (2024-12-16)

- **Tooling migration**:

  - Migrated from `standard-version` to `Changesets` for versioning and changelog generation.
  - Updated CI to use `pnpm` for dependency management.
  - Improved CI workflow with automatic publishing to NPM after successful builds.

- **Internal updates**:
  - Optimized caching steps in the CI workflow for better performance.
  - Refined publishing steps to avoid redundant actions.

## 1.0.0 (2024-12-11)

### Features

- Initial release with support for XState, Redux, and MobX adapters.
- Added support for custom and path-based styles.
- Provided examples for XState, Redux, and MobX integrations.
