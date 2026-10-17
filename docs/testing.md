# Testing Ignite Element

Use ordinary Vitest or Node assertions over `execute()`, `get('states')`, projected availability, native source snapshots and subscriptions. Keep source behavior tests separate from real registered-component DOM tests.

Every new invariant gets a property test when it can be stated as a property. Use `fast-check` as a devDependency only, with a fixed seed and run count recorded in the test so CI replays the same sequence. DOM behavior stays on the browser runner (`pnpm --filter ignite-element test:e2e`).

The [testing guide](https://0xjcf.github.io/ignite-element/handbook/testing/) contains canonical source, core, and Ignite JSX accessible-control examples. Add `@testing-library/dom` as a development dependency for DOM queries, mount an actual registered element, and query its rendered root.

## Migration

The v3 beta API removes the `test` export, testing/story types, `record(name)`, scenario methods and accessibility bridge. Replace scenario assertions with ordinary assertions on runtime results. Run fixture operations directly and observe their correlated source outcomes. Use bounded loops or waits, not a replacement scenario framework. Portable story receipts, traces, summaries and complete lifecycle histories are intentionally lost. Ordinary runtime results do not promise deep cloning.

Use named construction: `const core = igniteCore()` for source-free presentation or `const core = igniteCore({ source, ... })` from the relevant adapter entrypoint. The source/application owns asynchronous work and lifetime. `execute()` awaits its callback and defined observation, not all later business completion. Unsubscribe observation handles and remove elements; only the owner stops the source.

## Deterministic effects

Activation establishes one baseline per core/source instance without an effect call. Each later source notification queues a synchronous evaluation after source processing; no renderer or framework commit is guaranteed. The activated shared evaluator survives zero-view intervals until core disposal. Reconnection neither resets the baseline nor replays history.

Test errors, event sequence and multiplicity, external updates, disposal, and move/reconnect behavior directly. See the authoritative [events and effects contract](https://0xjcf.github.io/ignite-element/handbook/events/) for activation, delivery eligibility, and error handling.

## Mutation testing

Stryker runs the renderer test suite against mutated copies of `packages/ignite-renderer/src/renderers/jsx/renderer.ts` and `IgniteJsxRenderStrategy.ts` to show which behavior the tests do not pin down. It is a scheduled job, not a PR gate: `.github/workflows/mutation.yml` runs daily and on `workflow_dispatch`, and uploads the HTML and JSON reports plus the incremental file as artifacts. Do not add it to PR CI.

Run it locally with Node 22 and `NODE_OPTIONS=--expose-gc pnpm test:mutation`. The first run covers about 1,700 mutants; later runs reuse `reports/stryker-incremental.json` and only retest what changed. Config lives in `stryker.config.json`, and the runner uses `packages/ignite-element/vitest.stryker.config.ts`, which clears `execArgv` because Stryker's threads pool rejects `--expose-gc` there.

Treat survivors as a to-do list inside the mine-test-fix-verify loop: mine the report for surviving mutants, write a failing test for each real gap, fix the code or test, and verify by rerunning. Mark an equivalent mutant with `// Stryker disable next-line <mutator>: <reason>`. Thresholds are `high: 85`, `low: 70`, and `break: null` while a baseline accumulates; set `break` roughly five points under the observed score once there is one.
