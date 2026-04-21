# ADR-003 package boundary migration

ADR-003 makes `ignite-element` the only supported component authoring surface.

## What changed

- `ignite-core` now exposes contract primitives only.
- `ignite-adapters` now exposes adapter factories, guards, and source-specific config/types only.
- `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx` remain the stable authoring entrypoints.

## Removed lower-level authoring APIs

These lower-level authoring APIs are no longer available:

- `ignite-core#createProjectionFactory`
- `ignite-core#ProjectionFactory`
- `ignite-core#ProjectionFactoryOptions`
- `ignite-core#WithFacadeRenderArgs`
- `ignite-core#IgniteCoreReturn`
- `ignite-core#facadeCleanupSymbol`
- `ignite-adapters/xstate#igniteCore`
- `ignite-adapters/redux#igniteCore`
- `ignite-adapters/mobx#igniteCore`

## How to migrate

Use `ignite-element` for component authoring and headless runtime access:

```ts
import { igniteCore } from "ignite-element/xstate";
```

Use `ignite-adapters` only when you need adapter factories, guards, or source-specific config/types:

```ts
import { createReduxAdapter, isReduxStore } from "ignite-adapters";
import { createXStateAdapter } from "ignite-adapters/xstate";
```

Use `ignite-core` only for adapter-neutral contracts and utilities:

```ts
import { event, matchState, StateScope } from "ignite-core";
```

`matchState` remains available from `ignite-core` and the stable
`ignite-element/xstate` entrypoint, but it is no longer re-exported from
`ignite-adapters/xstate`.
