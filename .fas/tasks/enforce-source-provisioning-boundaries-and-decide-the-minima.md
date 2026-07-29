# Enforce exact-source provisioning and native lifecycle boundaries

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Turn the accepted exact-source-only architecture and completed cross-adapter evidence into executable conformance, while repairing normative architecture surfaces that still advertise the rejected createFeature, Feature, onDispose, and generic disposal direction. Enforce deterministic source, adapter, composition-root, projection, command, effect, retained-presentation, and native-lifecycle boundaries with architecture, public-type, and lifecycle tests. Preserve exact source identity and ecosystem-native ownership across XState, Redux, MobX, Actor-Web, browser, Node, isolated, shared, and deterministic fake flows. Produce a cited conformance source-of-truth matrix for downstream documentation and the optional Actor-Web evidence projection. Do not implement a public composition or lifecycle helper, the Actor-Web evidence projection, or retained-interface features in this task.

## Acceptance criteria

- Current architecture surfaces no longer describe createFeature, Feature, feature.source, onDispose, or generic disposal as current or accepted targets; the cancelled proposal remains historical only.
- Architecture checks classify deterministic source, adapter, composition-root, projection, and retained-presentation paths and fail direct imports, alias imports, re-export barrels, and dynamic imports that move browser, Node, provider, renderer, host, or transport APIs into deterministic source modules without flagging legitimate adapters.
- Public type tests prove commands remain source-directed intent, effects remain synchronous outward facts, host and actor escape hatches do not return, and promise-like environmental work is rejected.
- Public type tests prove igniteCore accepts the exact supported native source and rejects ports, drivers, environments, provide hooks, Feature wrappers, lifecycle containers, and disposal policy.
- Lifecycle tests distinguish Ignite observation cleanup from ecosystem-native unsubscribe, cancellation, stop, shutdown, abort, or close semantics for representative XState, Redux, MobX, Actor-Web, browser, Node, isolated, shared, and deterministic fake flows.
- Actor-Web retains source, runtime, admission, authorization, receipt, checkpoint, replay, reconciliation, and transport lifecycle ownership; Ignite remains projection-only and this task does not implement the optional evidence adapter.
- Retained ref and commit cleanup remains presentation-only: retained cleanup never starts or stops a source, and native source cleanup never depends on a retained node callback.
- docs/source-native-provisioning.md contains a Conformance source-of-truth matrix citing the concrete task, fixture, test, verification command, ownership, maturity, provenance, and freshness for every supported ecosystem claim.
- task-1784909318199 completes before implementation admission, and FAS scope, planning, task-packet, and commit-plan artifacts are refreshed from its actual receipts before code-writing delegation.
- The final handoff explicitly unlocks task-1784909364827 and task-1785254961929 without claiming the external Actor-Web evidence fixture is available before its upstream handoff.
- Each enforcement rule begins with a task-scoped failing test and a current TDD red receipt; every production or rule change is covered by an added or updated test.
- pnpm architecture:check, pnpm typecheck:packages, pnpm typecheck:examples, pnpm test:packages, pnpm test:examples, pnpm test:node, contract-doc validation, fas validate-task, and fas verify --full all pass.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- First reconcile the normative architecture surfaces with the accepted exact-source-only decision by removing rejected `createFeature`, `Feature`, `feature.source`, `onDispose`, and generic disposal target claims.
- Extend the architecture-rule fixtures with explicit deterministic-source, adapter, composition-root, and projection classifications so forbidden imports are rejected without flagging legitimate browser or Node adapters.
- Add public type tests that fail if `host` returns to commands, `host` or `actor` returns to effects, effects accept promise-like work, or `igniteCore` gains ports, drivers, environments, provisioning, or lifecycle-wrapper inputs.
- Add a lifecycle conformance matrix spanning isolated Ignite-owned sources, shared consumer-owned XState, Redux, MobX, and Actor-Web sources, browser and Node adapters, and deterministic fakes. Record native stop, unsubscribe, abort, shutdown, or close semantics without forcing one public abstraction.
- Add cross-epic fixtures proving retained `ref` cleanup owns only node-bound presentation resources and never terminates an exact source.
- Hand the finalized exact-source contract and conformance fixtures directly to task-1784909364827 for public documentation and task-1785254961929 for the optional Actor-Web evidence projection.

## Alternatives considered

- Export `Feature`, `SourceRuntime`, `DisposableSource`, or another lifecycle wrapper: rejected because the exact native source is the only common `igniteCore` input and native runtimes retain lifecycle ownership.
- Require source-specific application factories everywhere: rejected because factories are useful for repeated composition but ordinary one-off native construction remains valid.
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
- docs/architecture.md
- docs/shared-architecture-model.md
- docs/v3-api-consistency.md
- scripts/__tests__/script-hardening.test.js

## Scope Amendments

- Type: planning-correction
- Added at: 2026-07-29T18:15:43-04:00
- Trigger: operator Queue Inspector task-readiness review
- Reason: Make the task execution-ready by repairing rejected createFeature contract drift, binding concrete conformance evidence, and recording both downstream unlocks before implementation.
- Added paths: docs/architecture.md, docs/shared-architecture-model.md, docs/v3-api-consistency.md, scripts/__tests__/script-hardening.test.js
- Evidence source: repo-and-queue-audit
- Evidence: repo-and-queue-audit | docs/source-native-provisioning.md | The normative document still labels createFeature and Feature disposal as accepted targets while the completed architecture brief and cancelled implementation task reject that direction.
- Accuracy signal: high
- Follow-up needed: After task-1784909318199 completes, run fas scope refresh and regenerate planning, task-packet, and commit-plan artifacts before code-writing delegation.

## Implementation plan

- Reconcile docs/source-native-provisioning.md, docs/architecture.md, docs/shared-architecture-model.md, and docs/v3-api-consistency.md with the accepted exact-source-only decision and remove rejected wrapper-first target claims.
- After task-1784909318199 completes, refresh scope and planning from its Redux, MobX, Actor-Web comparison, Node, deterministic fake, cleanup, and cancellation receipts; do not infer missing evidence.
- Add task-scoped failing architecture, public-type, and lifecycle fixtures for import escapes, callback escape hatches, environmental effects, exact-source identity, wrapper rejection, shared versus isolated ownership, and presentation-versus-source cleanup.
- Implement the narrowest deterministic enforcement needed to make those fixtures pass, including alias, re-export, and dynamic-import coverage with explicit adapter and composition-root allowlists.
- Write the Conformance source-of-truth matrix in docs/source-native-provisioning.md and hand cited receipts to the public-guidance and optional Actor-Web projection tasks.

## Verification plan

- Record fas tdd-red against the task base after adding the first failing enforcement fixture.
- Run pnpm architecture:check and its focused script tests after each architecture-rule change.
- Run pnpm typecheck:packages and pnpm typecheck:examples for public exact-source and callback rejection coverage.
- Run pnpm test:packages, pnpm test:examples, and pnpm test:node for native lifecycle, cleanup, cancellation, shared-source, isolated-source, headless, and deterministic-fake coverage.
- Run contract-doc validation and search all current architecture surfaces for stale createFeature, Feature, feature.source, onDispose, generic disposal, host-mutation, and environmental-effect claims.
- Run fas validate-task, independent false-positive and ownership review, then fas verify --full at closeout.

## Risks

- The completed architecture task is recorded as done even though current normative surfaces still contain the rejected helper; failing to repair that drift would make enforcement encode contradictory policy.
- Broad import rules can flag legitimate browser, Node, provider, renderer, and Actor-Web adapters unless layer classifications and allowed composition roots are explicit.
- Conformance can erase meaningful lifecycle differences by inventing a common disposal contract instead of testing each native owner.
- Tests can pass while shared listeners, timers, transports, or provider work remain live; liveness-sensitive cleanup coverage must prove termination or retained ownership explicitly.
- This task could overlap the optional Actor-Web evidence adapter or retained-interface implementation unless those downstream boundaries remain explicit.

## Dependencies

- Depends on task-1784909267400 narrowed command and effect callbacks, task-1784909278954 routing source-native provisioning, and task-1784909318199 cross-adapter dogfood.
- The completed task-1784909239951 is authoritative for the exact-source-only decision, but its current documentation projection is inconsistent and must be corrected as an explicit first slice here before enforcement rules are treated as normative.
- Blocks task-1784909364827 final source-provisioning guidance and task-1785254961929 optional Actor-Web execution-evidence projection.
- The Actor-Web projection task also retains its external implementation gate: consume an accepted upstream versioned fixture rather than a sibling checkout or inferred unpublished API.
- Cancelled task-1784914562979 is historical evidence of the rejected createFeature direction and is not an implementation dependency.

## Open questions

- None before admission. If cross-adapter dogfood reveals an ecosystem-specific lifecycle not represented here, refresh scope and replan rather than inventing a cross-library wrapper or disposal abstraction.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
