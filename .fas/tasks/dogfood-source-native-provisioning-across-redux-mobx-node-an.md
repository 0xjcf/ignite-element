# Dogfood source-native provisioning across Redux, MobX, Node, and deterministic fakes

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Prove that exact source-only provisioning is source-library-native rather than XState-specific. Refactor the Redux and MobX examples to inject capability ports through Redux store construction, thunk or middleware and MobX constructors or factories, then pass the exact configured store or observable directly to igniteCore. Add Actor-Web comparison evidence, a Node or headless composition proof, and deterministic fakes. Each ecosystem retains its native lifecycle and shutdown conventions; do not introduce createFeature, Feature wrappers, onDispose, or a cross-library lifecycle abstraction. Treat Voice Workbench as read-only evidence and avoid overlapping its queued implementation scope.

## Acceptance criteria

- Redux, MobX, Actor-Web, Node, and deterministic examples construct and expose exact native sources without a Feature wrapper or shared composition helper.
- Redux injects ports through native store construction and gives environmental middleware or subscriptions an explicit Redux-owned shutdown path.
- MobX injects ports through constructor or factory composition and keeps application disposal distinct from Ignite observation cleanup.
- Actor-Web evidence preserves its source and runtime ownership without an Ignite wrapper.
- A pure Node or headless consumer and deterministic fake exercise commands, views, success, failure, cancellation, and native cleanup without DOM globals.
- At least one synchronous fire-and-forget capability and one asynchronous result-bearing capability demonstrate source-native action, actor, thunk, method, or transport ownership.
- Cross-adapter tests distinguish Ignite adapter cleanup from consumer-owned native source cleanup.
- Voice Workbench findings reference its existing task chain rather than modifying overlapping production files.
- TDD and DDD guardrails remain satisfied and the work remains tracked in the live queue.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the existing Redux and MobX counter examples as the two source-library proofs. Add an example-local counter persistence capability with explicit load, accepted save, observation, result facts, and unsubscribe semantics; do not introduce a framework-level capability abstraction.
- Bind the Redux implementation through `configureStore` thunk `extraArgument` or middleware construction and bind the MobX implementation through the `Counter` constructor or its factory. In both cases, `igniteCore` receives only the already-configured store or observable source.
- Use the existing smart-home model seam and lifecycle tests as the Node/headless asynchronous proof, extending only the smallest composition and deterministic-fake surfaces needed to compare success, failure, cancellation, and disposal. Treat its model call as the result-bearing capability rather than inventing a second asynchronous counter API.
- Include Actor-Web as a comparison proof so runtime and transport ownership stay
  with its native source rather than an Ignite wrapper.
- Give each composition root an ecosystem-native source factory where repeated
  setup is useful. Return the exact store, observable, Actor-Web source, or
  headless source and test its native shutdown separately from Ignite adapter
  observation cleanup.

## Alternatives considered

- Add a generic Ignite port registry or dependency bag: rejected because Redux, MobX, and the Node consumer already have native construction seams and Ignite should not become their composition root.
- Invent unrelated network work in the counter demos solely to exercise promises: rejected; the smart-home model port is the existing honest asynchronous capability.
- Reuse or modify Voice Workbench production files: rejected because its queued port and adapter chain owns that scope and serves only as comparison evidence here.
- Treat Ignite adapter unsubscribe as native source shutdown: rejected because
  observation cleanup belongs to the consuming projection while shared
  environment resources belong to the application and selected source runtime.
- Standardize one cross-library disposal wrapper: rejected because it erases
  useful differences between Redux, MobX, Actor-Web, XState, and custom
  headless sources.

## Architecture Context

```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Prove through representative dogfood that Ignite receives each caller-owned exact native source while source ecosystems and applications retain behavior and lifecycle authority."
    ],
    "behavior": [
      "Redux binds capabilities during store and middleware construction and owns middleware or subscription shutdown.",
      "MobX binds capabilities through constructors or factories and owns store disposal.",
      "Actor-Web retains source, runtime, transport, admission, and execution lifecycle ownership.",
      "Ignite observes native source projections and sends source-directed intent without wrapping or terminating the source."
    ],
    "policies": [
      "Capability dependencies enter through the selected source ecosystem's native composition seam.",
      "igniteCore receives the exact configured source and no Feature wrapper, port bag, lifecycle container, or disposal policy.",
      "Ignite observation cleanup remains distinct from consumer-owned source shutdown.",
      "Headless and deterministic proofs require no DOM globals.",
      "Voice Workbench is read-only comparison evidence and is not implementation scope."
    ],
    "capabilities": [
      {
        "name": "counter persistence and observation",
        "qualifier": "business",
        "owner": "Redux or MobX example composition"
      },
      {
        "name": "source-native provisioning and lifecycle",
        "qualifier": "runtime",
        "owner": "selected source ecosystem and consuming application"
      },
      {
        "name": "cross-adapter conformance evidence",
        "qualifier": "agent-model",
        "owner": "Ignite dogfood task and FAS workflow"
      },
      {
        "name": "headless projection",
        "qualifier": "host-product",
        "owner": "Ignite headless consumer"
      }
    ],
    "ports": [
      "example-local persistence capability consumed by Redux thunk or middleware and MobX methods",
      "smart-home model capability consumed by the headless source",
      "native command, snapshot, and observation contracts consumed by Ignite"
    ],
    "adapters": [
      "Redux thunk extraArgument or constructed middleware",
      "MobX constructor or factory implementation",
      "deterministic fake persistence and smart-home model implementations",
      "Actor-Web source and runtime comparison fixture"
    ],
    "infrastructure": [
      "Redux store and middleware runtime",
      "MobX observable runtime",
      "Actor-Web runtime and transport",
      "Node host",
      "Ignite adapter observation"
    ],
    "projections": [
      "Redux and MobX counter views derived from exact native source state",
      "headless smart-home output derived without DOM globals",
      "lifecycle receipts distinguishing Ignite observation cleanup from native source shutdown"
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "deterministic counter and smart-home behavior",
      "source-directed command intent",
      "result facts for success, failure, and cancellation"
    ],
    "imperativeShell": [
      "select and bind concrete persistence, model, transport, and clock implementations",
      "construct exact native sources",
      "start and stop application-owned resources through ecosystem-native APIs",
      "attach and release Ignite observation subscriptions independently"
    ]
  },
  "ownership": [
    {
      "owner": "Redux composition",
      "responsibilities": [
        "construct the store with injected capabilities",
        "own middleware, subscriptions, and shutdown"
      ],
      "maturity": "target"
    },
    {
      "owner": "MobX composition",
      "responsibilities": [
        "construct the observable with injected capabilities",
        "own reactions and disposal"
      ],
      "maturity": "target"
    },
    {
      "owner": "Actor-Web and headless source runtimes",
      "responsibilities": [
        "own behavior, transport, cancellation, and native lifecycle",
        "publish source state consumable by Ignite"
      ],
      "maturity": "current"
    },
    {
      "owner": "Ignite",
      "responsibilities": [
        "observe exact native source projections",
        "send intent and clean up only its own observation"
      ],
      "maturity": "current"
    }
  ],
  "maturity": [
    {
      "claim": "Exact source-only provisioning is the accepted architecture.",
      "status": "current",
      "evidenceRefs": [
        ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md",
        "docs/source-native-provisioning.md"
      ]
    },
    {
      "claim": "Redux, MobX, Node, and deterministic fake dogfood proves the architecture across ecosystems.",
      "status": "target",
      "evidenceRefs": [
        ".fas/tasks/dogfood-source-native-provisioning-across-redux-mobx-node-an.md"
      ]
    },
    {
      "claim": "Actor-Web remains an optional native source and runtime comparison rather than an Ignite-owned lifecycle.",
      "status": "current",
      "evidenceRefs": [
        "docs/actor-web-adapter.md",
        "docs/actor-web-evidence-governed-projections.md"
      ]
    }
  ],
  "boundaries": [
    "Examples bind concrete capabilities at their source-native composition roots.",
    "Ignite receives the exact store, observable, Actor-Web source, or headless source.",
    "Ignite observation cleanup never implies native source shutdown.",
    "Deterministic and headless proofs do not depend on DOM globals.",
    "Voice Workbench production files remain outside this task."
  ],
  "forbiddenCouplings": [
    "A generic Feature, createFeature, port registry, lifecycle container, or cross-library disposal abstraction enters the public contract.",
    "Redux, MobX, Actor-Web, or headless source shutdown is delegated to Ignite element disconnect.",
    "Environmental work is invented inside Ignite effects or deterministic source behavior.",
    "Actor-Web runtime, admission, transport, or execution authority moves into Ignite.",
    "Voice Workbench implementation is modified as part of this dogfood task."
  ],
  "evidenceRefs": [
    ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md",
    ".fas/tasks/dogfood-source-native-provisioning-across-redux-mobx-node-an.md",
    ".fas/tasks/enforce-source-provisioning-boundaries-and-decide-the-minima.md",
    "docs/source-native-provisioning.md",
    "examples/adapters/redux",
    "examples/adapters/mobx",
    "examples/agents/smart-home"
  ]
}
```

## Affected files

- `examples/adapters/redux/src/js/reduxCounterStore.test.ts`
- `examples/adapters/redux/src/js/reduxCounterStore.ts`
- `examples/adapters/redux/src/js/reduxExample.tsx`
- `examples/adapters/mobx/mobxCounterStore.test.ts`
- `examples/adapters/mobx/mobxCounterStore.ts`
- `examples/adapters/mobx/mobxExample.ts`
- `scripts/__tests__/test-examples.test.mjs`
- `scripts/__tests__/typecheck-examples.test.mjs`
- `scripts/test-examples.mjs`
- `scripts/typecheck-examples.mjs`

## Reference-only evidence

- `examples/agents/smart-home/src/agentLoop.test.ts`
- `examples/agents/smart-home/src/lifecycle.test.ts`
- `examples/apps/dashboard-with-shared-state/src/dashboard.headless.test.ts`
- Existing Actor-Web adapter and contract tests.
- Voice Workbench task artifacts; its production files remain out of scope.

## Scope Amendments

- Type: planning-correction
- Added at: 2026-07-30T01:47:00-04:00
- Trigger: delegated architect and staff-engineer commit-plan review
- Reason: Replace broad directory scope and an under-specified two-step commit plan with exact Redux, MobX, and harness paths that support red-first tests and incremental implementation.
- Evidence source: FAS delegated consultation
- Evidence path: `.fas/state/commit-plan.json`
- Evidence detail: The generated source step named only the two harness scripts and the test step had no planned paths, leaving the actual example implementation unassigned.
- Accuracy signal: high
- Follow-up needed: Regenerate planning, task-packet, commit-plan, and Codex orchestration artifacts before spawning the code-writing role.

## Implementation plan

- Add task-scoped failing tests to the existing Redux and MobX store suites, plus harness unit tests, proving native dependency injection, exact-source identity, result facts, and source-owned shutdown before implementation begins.
- Implement the narrow Redux and MobX composition changes in their existing store and example entrypoints. `igniteCore` receives the exact configured store or observable; no shared wrapper, lifecycle container, or disposal abstraction is introduced.
- Align the example test and typecheck harnesses with the new conformance coverage. Use existing smart-home, dashboard-headless, and Actor-Web tests as reference evidence unless a focused failure proves that their production seams must change and the task is replanned.

## Verification plan

- Record the initial failing Redux/MobX and harness tests with `fas tdd-red` before production changes.
- Run `pnpm exec vitest run examples/adapters/redux/src/js/reduxCounterStore.test.ts examples/adapters/mobx/mobxCounterStore.test.ts scripts/__tests__/test-examples.test.mjs scripts/__tests__/typecheck-examples.test.mjs`.
- Run the smart-home lifecycle and dashboard headless tests as unchanged evidence for Node, cancellation, cleanup, and DOM-free behavior.
- Run `node scripts/test-examples.mjs --list --require-covered-packages-match-discovered --covers-package examples/adapters/redux --covers-package examples/adapters/mobx --covers-package examples/agents/smart-home --covers-package examples/apps/dashboard-with-shared-state`.
- Run the focused example typecheck lane, `fas validate-task`, the examples full lane, and `fas verify --full` at the root-owned final gate.

## Risks

- Artificial examples could falsely justify framework behavior that native source libraries already provide.
- Redux observation cleanup and consumer-owned middleware or environment cleanup may be conflated.
- Native lifecycle differences could be erased by documentation that seeks false uniformity.
- Editing Voice Workbench production files would overlap its authoritative task chain.

## Dependencies

- Depends on task-1784909239951 corrected source-only architecture standard.
- Blocks task-1784909335843 exact-source conformance.
- Existing Voice Workbench tasks are reference evidence only and remain independently authoritative.

## Open questions

- None. The purpose is to preserve native differences while proving the one common Ignite boundary: pass the exact source.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
