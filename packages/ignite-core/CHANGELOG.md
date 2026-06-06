# ignite-core

## 3.0.0-beta.3

## 3.0.0-beta.2

### Minor Changes

- Publish the supporting packages under the `@ignite-element` npm scope: `ignite-core` → `@ignite-element/core`, `ignite-adapters` → `@ignite-element/adapters`, `ignite-renderer` → `@ignite-element/renderer`. The main `ignite-element` package keeps its unscoped name. Import paths move accordingly (e.g. `@ignite-element/adapters/xstate`); `ignite-element` consumers are unaffected since the siblings are internal dependencies resolved at install time.

## 3.0.0-beta.1

## 3.0.0-beta.0

### Minor Changes

- 3dd4dd2: Promote the view-first single-source DX so object snapshots spread their fields directly onto the view context. `ViewContext<Snapshot>` now resolves to `Snapshot & { snapshot: Snapshot }` for object snapshots, letting view callbacks destructure `context`, `transport`, `phase`, etc. at the top level while `snapshot` stays available for the full read model. Non-object snapshots keep the `{ snapshot }` shape.
