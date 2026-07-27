# Enforce exact-source provisioning and native lifecycle boundaries

## Source

Created with `fas create-task` on 2026-07-24.

## Problem
Turn the accepted source-only architecture and cross-adapter dogfood into enforceable conformance. Add boundary and type tests that prevent concrete environment APIs from entering deterministic source modules, prevent public Ignite commands and effects from regaining host or actor escape hatches, and prevent igniteCore from accepting ports, drivers, environments, provide hooks, Feature wrappers, lifecycle containers, or disposal policy. Verify that browser, Node, fake, isolated, and shared cleanup follows the selected source ecosystem native lifecycle. Produce the source-of-truth matrix consumed by final documentation; no public composition or lifecycle helper is implemented.


## Acceptance criteria
- Architecture checks fail when deterministic source modules import browser, Node, provider, renderer, or Ignite host APIs outside approved adapter or composition paths.
- Type tests prove narrowed commands and effects contexts and reject host mutation, effect-driven source commands, and promise-returning environmental effects.
- Type tests prove igniteCore accepts exact supported native sources and rejects ports, drivers, environments, provide hooks, Feature wrappers, lifecycle containers, and disposal policy.
- Lifecycle tests cover native subscription cleanup, cancellation, stop or shutdown, isolated Ignite-owned sources, shared consumer-owned sources, and headless use across representative ecosystems.
- A reviewed matrix cites concrete XState, Redux, MobX, Actor-Web, routing, Node, and deterministic fake evidence for exact source-only provisioning.
- Conformance preserves ecosystem-specific lifecycle semantics instead of inventing a cross-library disposal contract.
- ref and commit conformance remains presentation-only: retained cleanup never stops a source, and source cleanup never depends on a retained node callback.
- FAS architecture rules, package typechecks, example lanes, and full verification enforce the accepted boundary.
- TDD and DDD guardrails remain satisfied and the work remains tracked in the live queue.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Extend the architecture-rule fixtures with explicit deterministic-source, adapter, composition-root, and projection classifications so forbidden imports are rejected without flagging legitimate browser or Node adapters.
- Add public type tests that fail if `host` returns to commands, `host` or `actor` returns to effects, effects accept promise-like work, or `igniteCore` gains ports, drivers, environments, provisioning, or lifecycle-wrapper inputs.
- Add a lifecycle conformance matrix spanning isolated Ignite-owned sources,
  shared consumer-owned XState, Redux, MobX, and Actor-Web sources, browser and
  Node adapters, and deterministic fakes. Record the native stop, unsubscribe,
  abort, shutdown, or close semantics without forcing one public abstraction.
- Add cross-epic fixtures proving retained `ref` cleanup owns only node-bound
  presentation resources and never terminates an exact source.
- Hand the finalized exact-source contract and conformance fixtures directly to
  task-1784909364827 for public documentation.

## Alternatives considered

- Export `Feature`, `SourceRuntime`, `DisposableSource`, or another lifecycle
  wrapper: rejected because the exact native source is the only common
  `igniteCore` input and native runtimes retain lifecycle ownership.
- Require source-specific application factories everywhere: rejected because
  factories are useful for repeated composition but ordinary one-off native
  construction remains valid.
- Use one broad regex ban across the repository: rejected because adapters and composition roots legitimately import browser, Node, and provider APIs; checks must understand declared layer boundaries.
- Make `igniteCore` accept a lifecycle wrapper so it can call `dispose`: rejected because shared source ownership belongs to the application and an element disconnect must not terminate resources used by other consumers.
- Rely on the architecture document without executable fixtures: rejected because callback and import boundaries would otherwise regress silently.

## Affected files

- .fas/architecture-rules.json
- .fas-config.json
- scripts/check-architecture-rules.mjs
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-element/src/tests/types
- packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts
- examples/adapters
- docs/source-native-provisioning.md

## Scope Amendments

- None.

## Implementation plan
- Aggregate accepted architecture plus callback, routing, Redux, MobX, Actor-Web, Node, fake, native-cleanup, and retained-presentation receipts into a source-of-truth matrix.
- Add failing architecture and public-type fixtures for forbidden environment imports, callback escape hatches, environmental effects, source wrappers, and lifecycle ownership regressions, then implement the narrowest enforceable checks.
- Update the normative contract from cross-adapter evidence and hand exact-source and native-lifecycle receipts directly to the public guidance task.

## Verification plan
- Run architecture-rule unit tests, public type tests, all source-provisioning examples, pure-Node headless tests, and native cleanup or cancellation suites.
- Run retained ref and commit boundary checks ensuring presentation cleanup cannot own source lifecycle.
- Run contract-doc validation, fas validate-task, and full verification with independent false-positive and ownership review.

## Risks
- Import-path checks can mistake environment adapters for deterministic cores unless layer classification is explicit.
- Conformance could accidentally require false lifecycle uniformity across XState, Redux, MobX, and Actor-Web.
- Tests may pass while a real shared source listener or transport remains unclosed.
- Presentation cleanup and native source cleanup could be conflated without explicit cross-epic fixtures.

## Dependencies
- Depends on task-1784909267400, task-1784909278954, and task-1784909318199.
- Blocks task-1784909364827 final source-only guidance.
- The cancelled task-1784914562979 remains historical evidence of the rejected createFeature direction and is not an implementation dependency.

## Open questions
- None. New evidence may add ecosystem-specific guidance but may not introduce a generic source wrapper or lifecycle API without a separate architecture decision.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
