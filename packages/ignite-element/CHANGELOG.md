# Changelog

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
