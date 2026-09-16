# Testing Ignite Element

Use ordinary Vitest or Node assertions over `execute()`, `get('states')`, projected availability, native source snapshots and subscriptions. Keep source behavior tests separate from real registered-component DOM tests.

The [testing guide](https://0xjcf.github.io/ignite-element/handbook/testing/) contains canonical source, core, and Ignite JSX accessible-control examples. Add `@testing-library/dom` as a development dependency for DOM queries, mount an actual registered element, and query its rendered root.

## Migration

The v3 beta API removes the `test` export, testing/story types, `record(name)`, scenario methods and accessibility bridge. Replace scenario assertions with ordinary assertions on runtime results. Run fixture operations directly and observe their correlated source outcomes. Use bounded loops or waits, not a replacement scenario framework. Portable story receipts, traces, summaries and complete lifecycle histories are intentionally lost. Ordinary runtime results do not promise deep cloning.

Use named construction: `const core = igniteCore()` for source-free presentation or `const core = igniteCore({ source, ... })` from the relevant adapter entrypoint. The source/application owns asynchronous work and lifetime. `execute()` awaits its callback and defined observation, not all later business completion. Unsubscribe observation handles and remove elements; only the owner stops the source.

## Deterministic effects

Activation establishes one baseline per core/source instance without an effect call. Each later source notification queues a synchronous evaluation after source processing; no renderer or framework commit is guaranteed. The activated shared evaluator survives zero-view intervals until core disposal. Reconnection neither resets the baseline nor replays history.

Test errors, event sequence and multiplicity, external updates, disposal, and move/reconnect behavior directly. See the authoritative [events and effects contract](https://0xjcf.github.io/ignite-element/handbook/events/) for activation, delivery eligibility, and error handling.
