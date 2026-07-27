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

## Affected files

- examples/adapters/redux
- examples/adapters/mobx
- examples/agents/smart-home
- examples/apps/dashboard-with-shared-state
- scripts/test-examples.mjs
- scripts/typecheck-examples.mjs

## Scope Amendments

- None.

## Implementation plan
- Add honest capability-port examples to Redux and MobX using their native construction seams while preserving existing shared and isolated demonstrations.
- Add deterministic implementations and ecosystem-native shutdown tests, then use the existing Node or smart-home and Actor-Web seams for asynchronous and transport lifecycle evidence.
- Add headless success, failure, cancellation, subscription cleanup, and source-shutdown tests; record the source-only conformance matrix and Voice Workbench alignment by reference.

## Verification plan
- Run focused Redux, MobX, Actor-Web comparison, Node or smart-home, dashboard, and deterministic fake tests plus example typechecks.
- Run cleanup and liveness-sensitive tests repeatedly to catch lingering subscriptions, timers, transports, or handles.
- Run architecture checks, fas validate-task, examples full lane, and full repository verification.

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
