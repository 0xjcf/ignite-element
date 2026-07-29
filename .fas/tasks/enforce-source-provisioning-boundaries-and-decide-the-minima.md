# Enforce exact-source provisioning and native lifecycle boundaries

## Source

Created with `fas create-task` on 2026-07-24.

## Product frame

- **Person and context:** An Ignite developer is composing XState, Redux, MobX, Actor-Web, browser, Node, shared, isolated, or deterministic fake sources through `igniteCore`.
- **Desired progress:** Pass the exact source the application already owns to Ignite, keep that ecosystem's native lifecycle intact, and know that regressions will fail visibly.
- **Observed difficulty:** Current architecture guidance still advertises a rejected `createFeature` wrapper and generic disposal model, while the accepted exact-source boundary is not yet enforced by architecture, type, and lifecycle tests.
- **Known constraint:** Ignite may project source state and send source-directed intent, but it must not take ownership of source behavior, admission, authorization, persistence, replay, transport, or shutdown.
- **Hypothesis:** If the written contract, executable rules, public types, lifecycle fixtures, and evidence matrix all express the same boundary, developers and downstream tasks can rely on one source-native contract without an Ignite-specific wrapper.
- **Outcome signal:** Supported native sources work without wrapper or lifecycle escape hatches; invalid imports and public types fail conformance; downstream documentation and Actor-Web projection work consume cited receipts instead of inferred behavior.

## Product narrative

An Ignite developer wants to bind UI capabilities through the source library they
already use, pass that exact source to Ignite, and keep native cleanup ownership
clear. They should not have to adopt an Ignite-specific wrapper or guess whether
the docs, types, and runtime enforce the same boundary.

## Problem

The accepted architecture says that `igniteCore` receives the caller's exact
native source. Some normative docs still describe the rejected `createFeature`,
`Feature`, `onDispose`, and generic disposal direction, and executable checks do
not yet protect the accepted boundary.

This task makes that contract trustworthy. It aligns the written architecture,
then adds focused architecture, public-type, and lifecycle tests that preserve
source identity and ecosystem-native ownership.

The result is a cited conformance matrix that downstream documentation and the
optional Actor-Web projection can consume. It does not add a public composition
or lifecycle helper, implement the Actor-Web projection, or build retained UI
features.

## Behavior and authority

- **Application:** Constructs and owns the native source, chooses sharing, and invokes native shutdown when appropriate.
- **Source ecosystem:** Owns transitions, policy, cancellation, unsubscribe, stop, shutdown, abort, or close semantics.
- **Actor-Web runtime:** Owns admission, authorization, execution receipts, checkpoints, replay, reconciliation, and transport lifecycle.
- **Ignite:** Reads projections, sends source-directed intent, publishes synchronous outward facts, and cleans up only its own observation and presentation resources.
- **Evidence:** Architecture checks, public-type tests, lifecycle fixtures, and the cited matrix prove these boundaries without inventing a common runtime wrapper.

## Developer outcome

| Before | After |
| --- | --- |
| Conflicting guidance leaves developers unsure whether the exact source or an Ignite wrapper is authoritative. | One exact-source contract is reflected in docs, types, architecture rules, and lifecycle fixtures. |
| Cleanup ownership can be confused with element disconnect or retained-node cleanup. | Ignite cleanup and ecosystem-native shutdown are tested as separate responsibilities. |
| Downstream tasks must infer which claims are trustworthy. | Documentation and optional Actor-Web projection work receive cited, freshness-bearing conformance receipts. |

## Acceptance criteria

- **Developer outcome:** A developer can pass each supported exact native source to `igniteCore` without a port, driver, environment, `Feature` wrapper, lifecycle container, or disposal policy.
- **Contract correction:** Current architecture surfaces no longer present `createFeature`, `Feature`, `feature.source`, `onDispose`, or generic disposal as accepted targets; the cancelled proposal remains historical only.
- **Architecture enforcement:** Checks classify deterministic source, adapter, composition-root, projection, and retained-presentation paths. They reject direct, alias, barrel, and dynamic imports that move environmental APIs into deterministic source modules without flagging legitimate adapters.
- **Public behavior:** Type tests keep commands as source-directed intent and effects as synchronous outward facts. Host and actor escape hatches stay absent, and promise-like environmental work is rejected.
- **Lifecycle proof:** Tests distinguish Ignite observation cleanup from ecosystem-native unsubscribe, cancellation, stop, shutdown, abort, or close semantics across representative XState, Redux, MobX, Actor-Web, browser, Node, isolated, shared, and deterministic fake flows.
- **Ownership boundary:** Actor-Web retains source/runtime and execution lifecycle authority; Ignite remains projection-only and this task does not implement the optional evidence adapter.
- **Presentation boundary:** Retained ref and commit cleanup remains presentation-only. It never starts or stops a source, and native source cleanup never depends on a retained-node callback.
- **Evidence matrix:** `docs/source-native-provisioning.md` cites the task, fixture, test, verification command, ownership, maturity, provenance, and freshness for every supported ecosystem claim.
- **Admission gate:** `task-1784909318199` completes before implementation admission, then FAS scope, planning, task-packet, and commit-plan artifacts are refreshed from its actual receipts.
- **Downstream handoff:** The final handoff explicitly unlocks `task-1784909364827` and `task-1785254961929` without claiming that an external Actor-Web evidence fixture exists before its upstream handoff.
- **TDD evidence:** Each enforcement rule starts with a task-scoped failing test and a current TDD red receipt; every production or rule change has test coverage.
- **Verification:** `pnpm architecture:check`, package and example typechecks, package/example/Node tests, contract-doc validation, `fas validate-task`, and `fas verify --full` all pass.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

Deliver this in five readable slices:

1. **Correct the contract:** Remove rejected wrapper-first and generic-disposal claims from normative architecture surfaces.
2. **Make drift fail:** Add architecture and public-type fixtures for layer violations, callback escape hatches, environmental effects, exact-source identity, and wrapper rejection.
3. **Prove native lifecycle ownership:** Exercise representative shared, isolated, browser, Node, Actor-Web, and deterministic fake flows without forcing them behind one disposal abstraction.
4. **Separate presentation cleanup:** Prove retained `ref` cleanup owns node-bound presentation resources only and never terminates a source.
5. **Publish the evidence handoff:** Record the conformance matrix and pass cited receipts to the public-guidance and optional Actor-Web projection tasks.

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
- `scripts/__tests__/script-hardening.test.js`

## Scope Amendments

- Type: planning-correction
- Added at: 2026-07-29T18:15:43-04:00
- Trigger: operator Queue Inspector task-readiness review
- Reason: Make the task execution-ready by repairing rejected createFeature contract drift, binding concrete conformance evidence, and recording both downstream unlocks before implementation.
- Added paths: `docs/architecture.md`, `docs/shared-architecture-model.md`, `docs/v3-api-consistency.md`, `scripts/__tests__/script-hardening.test.js`
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
