# Testing Ignite Element

Use ordinary Vitest or Node assertions over `execute()`, `get('states')`, projected availability, native source snapshots and subscriptions. Keep source behavior tests separate from real registered-component DOM tests.

The [testing guide](https://0xjcf.github.io/ignite-element/guides/testing/) contains complete Redux event/command/external-update and XState/Lit accessible-control examples. Add `@testing-library/dom` as a development dependency for DOM queries, mount an actual registered element, and query its rendered root.

## Migration

The development candidate removes the `test` export, testing/story types, `record(name)`, scenario methods and accessibility bridge. Replace scenario assertions with ordinary assertions on runtime results. Run fixture operations directly and observe their correlated source outcomes. Use bounded loops or waits, not a replacement scenario framework. Portable story receipts, traces, summaries and complete lifecycle histories are intentionally lost. Ordinary runtime results do not promise deep cloning.

Use named construction: `const core = igniteCore()` for source-free presentation or `const core = igniteCore({ source, ... })` from the relevant adapter entrypoint. The source/application owns asynchronous work and lifetime. `execute()` awaits its callback and defined observation, not all later business completion. Unsubscribe observation handles and remove elements; only the owner stops the source.

## Deterministic effects

- A new host/runtime seeds `prevSnapshot` from current adapter state.
- Historical transitions are not replayed when a host attaches.
- The initial subscription establishes a baseline without running effects.
- Render updates precede synchronous effects queued in a microtask.
- Test retained errors, event sequence/multiplicity, external updates, cleanup, and move/reconnect behavior directly.
