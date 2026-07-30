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

## Architecture Context

```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Make the accepted exact-source Ignite boundary executable and reviewable across architecture rules, public types, lifecycle fixtures, and current documentation."
    ],
    "behavior": [
      "Applications construct, share, isolate, and terminate their native sources through ecosystem-owned APIs.",
      "Source ecosystems own transitions, policy, cancellation, persistence, replay, transport, and shutdown semantics.",
      "Actor-Web owns runtime admission, authorization, execution evidence, checkpoints, replay, reconciliation, and transport lifecycle.",
      "Ignite observes exact native source projections, sends source-directed intent, publishes synchronous outward facts, and releases only its own observation or presentation resources."
    ],
    "policies": [
      "igniteCore accepts the exact caller-owned source rather than a Feature, port bag, driver, environment, lifecycle container, or disposal policy.",
      "Deterministic source modules cannot import environmental APIs directly, including through aliases, barrels, re-exports, or dynamic imports.",
      "Adapters and application composition roots may bind environmental capabilities through explicit allowlists.",
      "Public commands cannot regain host or actor escape hatches, and effects remain synchronous outward-fact callbacks.",
      "Presentation cleanup cannot start, stop, or dispose a native source.",
      "Actor-Web remains optional and retains runtime authority; this task does not implement its evidence projection."
    ],
    "capabilities": [
      {
        "name": "source-directed commands and synchronous outward facts",
        "qualifier": "business",
        "owner": "Ignite public contract"
      },
      {
        "name": "native source lifecycle and environmental capability binding",
        "qualifier": "runtime",
        "owner": "application and selected source ecosystem"
      },
      {
        "name": "architecture, type, lifecycle, and evidence conformance",
        "qualifier": "agent-model",
        "owner": "Ignite enforcement task and FAS workflow"
      },
      {
        "name": "retained-node and presentation cleanup",
        "qualifier": "host-product",
        "owner": "Ignite renderer or consuming host"
      }
    ],
    "ports": [
      "native source command, snapshot, and observation contracts consumed by Ignite",
      "environmental capabilities injected at adapter or application composition roots",
      "verification receipts consumed by downstream guidance and optional projection work"
    ],
    "adapters": [
      "XState, Redux, MobX, Actor-Web, browser, Node, and deterministic fake integrations",
      "architecture-rule classifications and explicit environmental-import allowlists",
      "public-type and lifecycle conformance fixtures"
    ],
    "infrastructure": [
      "browser and Node hosts",
      "source runtimes and transports",
      "architecture checker and TypeScript compiler",
      "FAS verification and evidence artifacts"
    ],
    "projections": [
      "exact-source read models rendered or inspected by Ignite",
      "architecture and type failures for forbidden couplings",
      "lifecycle receipts separating Ignite observation cleanup from native shutdown",
      "freshness-bearing source-of-truth conformance matrix"
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "deterministic source behavior and source-directed intent",
      "pure architecture classification and boundary decisions",
      "conformance facts and evidence-matrix claims"
    ],
    "imperativeShell": [
      "bind environmental implementations at declared adapter or composition roots",
      "construct and terminate exact native sources",
      "attach and release Ignite observation or presentation resources",
      "run architecture, type, lifecycle, and repository verification"
    ]
  },
  "ownership": [
    {
      "owner": "Application and native source ecosystem",
      "responsibilities": [
        "construct, share, isolate, and terminate the source",
        "own policy, persistence, cancellation, replay, transport, and shutdown"
      ],
      "maturity": "current"
    },
    {
      "owner": "Actor-Web runtime",
      "responsibilities": [
        "own admission, authorization, execution receipts, checkpoints, replay, reconciliation, and transport lifecycle",
        "publish optional evidence through a later versioned consumer contract"
      ],
      "maturity": "current"
    },
    {
      "owner": "Ignite",
      "responsibilities": [
        "observe the exact source and send source-directed intent",
        "clean up only Ignite-owned observation and presentation resources"
      ],
      "maturity": "current"
    },
    {
      "owner": "Conformance enforcement",
      "responsibilities": [
        "reject forbidden architectural and public-type couplings",
        "publish cited lifecycle and freshness evidence for downstream consumers"
      ],
      "maturity": "target"
    }
  ],
  "maturity": [
    {
      "claim": "Exact source-only provisioning is the accepted architecture.",
      "status": "current",
      "evidenceRefs": [
        ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md",
        ".fas/tasks/dogfood-source-native-provisioning-across-redux-mobx-node-an.md"
      ]
    },
    {
      "claim": "Architecture, public types, lifecycle fixtures, and normative docs prevent regression to wrapper-owned lifecycle.",
      "status": "target",
      "evidenceRefs": [
        ".fas/tasks/enforce-source-provisioning-boundaries-and-decide-the-minima.md"
      ]
    },
    {
      "claim": "Optional Actor-Web execution-evidence projection is implemented.",
      "status": "proposed",
      "evidenceRefs": [
        ".fas/tasks/extend-the-optional-actor-web-adapter-with-execution-evidenc.md"
      ]
    }
  ],
  "boundaries": [
    "Deterministic sources remain free of direct environmental imports.",
    "Adapters and application composition roots bind environmental capabilities without leaking them into Ignite public contracts.",
    "Ignite receives the exact caller-owned source and never terminates it during observation or presentation cleanup.",
    "Actor-Web runtime and evidence authority remain upstream-owned and optional.",
    "Retained-node cleanup stays presentation-only.",
    "Downstream guidance and projection tasks consume cited current receipts rather than inferred claims."
  ],
  "forbiddenCouplings": [
    "Feature, createFeature, feature.source, onDispose, generic lifecycle containers, or disposal policy become accepted Ignite contracts.",
    "Commands expose host or actor mutation escape hatches, or effects perform promise-like environmental work.",
    "Deterministic source modules import browser, Node, provider, transport, or persistence APIs outside declared adapters or composition roots.",
    "Ignite element disconnect or retained-node cleanup stops a shared native source.",
    "Actor-Web admission, authorization, execution, persistence, replay, reconciliation, or transport authority moves into Ignite.",
    "The optional Actor-Web evidence projection is implemented before its upstream versioned fixture handoff."
  ],
  "evidenceRefs": [
    ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md",
    ".fas/tasks/dogfood-source-native-provisioning-across-redux-mobx-node-an.md",
    ".fas/tasks/enforce-source-provisioning-boundaries-and-decide-the-minima.md",
    ".fas/architecture-rules.json",
    "scripts/check-architecture-rules.mjs",
    "packages/ignite-element/src/tests/types",
    "docs/source-native-provisioning.md"
  ]
}
```

## Affected files

- .fas/architecture-rules.json
- scripts/check-architecture-rules.mjs
- scripts/__tests__/script-hardening.test.js
- scripts/__tests__/architecture-boundaries.test.mjs
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts
- docs/source-native-provisioning.md
- docs/architecture.md
- docs/shared-architecture-model.md
- docs/v3-api-consistency.md

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

- Type: scope-narrowing
- Added at: 2026-07-29T22:51:22-04:00
- Trigger: current-generation architect and staff-engineer review
- Reason: Preserve TDD order and prevent this enforcement task from reopening the completed source-native dogfood implementation. The accepted slice is documentation correction, red conformance fixtures, and the narrowest checker or rule-data change proven necessary by those fixtures.
- Removed production paths: `.fas-config.json`, `packages/ignite-core/src/RenderArgs.ts`, `examples/adapters`
- Removed broad paths: `packages/ignite-element/src/tests/types`, `examples/adapters`
- Promoted exact test paths: `packages/ignite-element/src/tests/types/igniteCore.types.test.ts`, `packages/ignite-element/src/tests/types/testing.types.test.ts`
- Reference-only evidence: `.fas-config.json`, `packages/ignite-core/src/RenderArgs.ts`, the completed Redux/MobX/Node/deterministic-fake adapter receipts, and Actor-Web emitted-event type coverage.
- Conditional path: `.fas/architecture-rules.json` changes only if a failing script-hardening fixture proves the existing rule data cannot express the required classification or allowlist.
- Evidence source: current-generation architecture and staff-engineer handoffs
- Accuracy signal: high
- Follow-up needed: Regenerate planning, task-packet, commit-plan, and orchestration artifacts before code-writing delegation.

- Type: verification-lane-correction
- Added at: 2026-07-29T23:15:32-04:00
- Trigger: root-owned `fas tdd-red` replay
- Reason: `scripts/__tests__/script-hardening.test.js` is a focused Vitest file but the durable `test:scripts` lane runs Node-native `scripts/__tests__/*.test.mjs`; the new enforcement cases otherwise pass only through an ad hoc temporary Vitest config and are skipped by project verification.
- Added path: `scripts/__tests__/architecture-boundaries.test.mjs`
- Superseded test placement: Move this task's direct, workspace-alias, barrel/re-export, dynamic-import, and legitimate adapter/composition-root architecture cases out of `scripts/__tests__/script-hardening.test.js` into the Node-native file. Keep unrelated existing script-hardening coverage unchanged.
- Evidence source: `.fas/state/verification/tdd-red-receipt.json`, `package.json`
- Accuracy signal: high
- Follow-up needed: Refresh scope and planning, then record a genuine current-task red receipt through the durable project test command before review.

## Implementation plan

1. Add task-scoped red fixtures before enforcement or documentation changes. The accepted task brief is the test contract while the current normative docs remain known-stale:
   - `scripts/__tests__/architecture-boundaries.test.mjs` for direct, alias, barrel, re-export, and dynamic environmental imports plus legitimate adapter and composition-root allowlists in the durable `test:scripts` lane.
   - `scripts/__tests__/script-hardening.test.js` remains the source location from which this task's temporary focused Vitest cases are removed; unrelated existing hardening coverage stays unchanged.
   - `packages/ignite-element/src/tests/types/igniteCore.types.test.ts` for wrapper, lifecycle-helper, host, actor, and promise-like effect escape-hatch rejection.
   - `packages/ignite-element/src/tests/types/testing.types.test.ts` only where the public test harness needs the same negative contract.
   - `packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts` for exact-source identity and the separation of Ignite observation cleanup from application-owned native shutdown.
2. Make the red fixtures pass with the narrowest enforcement change in `scripts/check-architecture-rules.mjs`. Change `.fas/architecture-rules.json` only when the fixture proves the checker needs new declared classification or allowlist data. Do not change `.fas-config.json`, `packages/ignite-core/src/RenderArgs.ts`, or adapter examples unless a new scope amendment cites a failing fixture that cannot be satisfied within the accepted paths.
3. Correct the normative contract and publish the source-of-truth conformance matrix, starting with `docs/source-native-provisioning.md`, then aligning `docs/architecture.md`, `docs/shared-architecture-model.md`, and `docs/v3-api-consistency.md`. Remove rejected wrapper and generic-disposal targets, preserve the cancelled proposal as historical evidence only, and cite current dogfood, architecture, type, lifecycle, and verification receipts.
4. Hand the cited evidence to `task-1784909364827` and `task-1785254961929` without claiming that the optional Actor-Web projection has been implemented.

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
