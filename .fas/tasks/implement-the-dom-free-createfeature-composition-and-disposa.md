# Implement the DOM-free createFeature composition and disposal helper

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Implement the accepted direct createFeature composition API after cross-adapter dogfood and conformance finalize its lifecycle semantics. createFeature receives a readonly ports object and a synchronous setup callback; setup receives ports plus onDispose and returns the already-bound source. The result is Feature<Source> with source and an application-owned dispose method. Guarantee idempotent and concurrent-safe disposal, reverse-order teardown, attempt-all cleanup, and AggregateError reporting across synchronous and asynchronous teardowns. Keep the implementation DOM-free and source-library-neutral. igniteCore continues to receive only feature.source and never accepts Feature, ports, drivers, environments, or lifecycle wrappers.

## Acceptance criteria

- A DOM-free public createFeature({ ports, setup }) API returns Feature<Source> with readonly source and dispose().
- setup is synchronous, receives readonly ports plus onDispose, and returns an already-bound XState, Redux, MobX, Actor-Web, or custom source without provider inspection.
- dispose is application-owned, idempotent, concurrent-safe, reverse-order, attempts every registered teardown, and reports multiple failures with AggregateError.
- Setup-failure behavior and synchronous plus asynchronous teardown behavior are explicitly specified and tested without DOM globals.
- Disposal awaits teardowns sequentially in reverse registration order; repeated or concurrent calls return the same settled or rejected completion and never retry completed teardown.
- `onDispose` accepts registrations only while synchronous setup is executing; a captured callback invoked after setup fails deterministically.
- Readonly ports prevent property reassignment without claiming deep immutability, portless features use the contract-approved empty-port form, and ports are absent from the returned `Feature`.
- `feature.source` remains structurally available after disposal, while the helper performs no implicit `stop`, `close`, `unsubscribe`, abort, or source-state inspection.
- igniteCore accepts only feature.source; public type tests reject Feature, ports, driver, environment, provide, or lifecycle-wrapper inputs.
- Routing, Redux, MobX, and Node dogfood migrate from their local candidate pattern to the shipped helper without changing source-native provisioning.
- Package exports, DOM-free import behavior, beta changeset, migration notes, and contract documentation cover the new API.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Implement `FeatureTeardown`, `FeatureScope`, `Feature<Source>`, and `createFeature<Ports, Source>` in `@ignite-element/core`, with readonly ports passed directly to synchronous setup and no source-library or provider inspection.
- Return the setup result as `feature.source`. Keep ports scoped to setup, expose only `source` and `dispose`, and require consumers to pass `feature.source` rather than the feature object to `igniteCore`.
- Implement the conformance-approved disposal state machine: one shared completion for concurrent calls, sequential reverse registration order, every teardown attempted, synchronous and asynchronous teardown support, no retry after rejection, and the accepted single-error or aggregate failure shape.
- Re-export the DOM-free contract through the approved public package surface, add pure-Node import tests, and migrate routing, Redux, MobX, and Node dogfood from their local candidate to the shipped helper.

## Alternatives considered

- Ship `createSourceRuntime(source, dispose)`: rejected because it standardizes only the result wrapper and obscures ports plus setup as the composition boundary.
- Require a feature-specific wrapper such as `createRouterFeature`: rejected as the default because direct `createFeature` is the consistent one-off pattern; wrappers remain application code for repeated multi-environment instantiation.
- Let `igniteCore` accept `Feature<Source>`: rejected because application-owned resource disposal must not become element-owned lifecycle.
- Resolve ports dynamically or expose them from the returned feature: rejected because `createFeature` is static composition, not a service locator or dependency-injection container.

## Affected files

- packages/ignite-core/src/createFeature.ts
- packages/ignite-core/src/index.ts
- packages/ignite-core/README.md
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/tests
- packages/ignite-element/scripts/verify-exports.mjs
- packages/ignite-element/README.md
- examples/apps/spa-router
- examples/adapters/redux
- examples/adapters/mobx
- examples/agents/smart-home
- .changeset

## Scope Amendments

- None.

## Implementation plan

- Write failing runtime and public type tests for readonly ports, immediate source availability, setup behavior, disposal ordering, concurrent calls, attempt-all cleanup, failure aggregation, and DOM-free imports.
- Implement the minimal core types and lifecycle state machine exactly as finalized by task-1784909335843, then expose the approved entrypoint without adding source-library dependencies or DOM side effects.
- Migrate the routing, Redux, MobX, and smart-home dogfood compositions to direct `createFeature`, pass only `feature.source` to Ignite, and add a coordinated beta changeset and migration note.

## Verification plan

- Run focused `createFeature` runtime tests, public type tests, pure-Node import tests, and setup/disposal failure suites.
- Run package typechecks, builds, export verification, and the routing, Redux, MobX, smart-home, and deterministic-fake example lanes.
- Run architecture checks, `fas validate-task`, and full verification because this adds a shared public contract.

## Risks

- An ambiguous export path could make the helper appear DOM-coupled even though its implementation is not.
- Cleanup state can become incorrect when synchronous throws, asynchronous rejection, and concurrent disposal overlap.
- Automatic rollback after synchronous setup failure is unsound if registered teardown is asynchronous unless the finalized contract provides an observable completion path or assigns failure atomicity to the feature-specific setup.
- Migrating examples could accidentally move source-native provisioning into the helper instead of leaving it in XState, Redux, and MobX setup code.

## Dependencies

- Depends on task-1784909335843 conformance and finalized contract.
- Blocks task-1784909364827 final public guidance.

## Open questions

- None; task-1784909335843 must resolve setup-failure and package-entrypoint semantics before this implementation starts.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
