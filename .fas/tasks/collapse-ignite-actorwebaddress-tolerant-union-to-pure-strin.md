# collapse ignite ActorWebAddress tolerant union to pure string once @actor-web/runtime publishes the opaque branded addre

## Source
Created with `fas create-task` on 2026-06-23.

## Problem
Drop the object branch + the TODO(actor-web > 0.1.0) comment in packages/ignite-adapters/src/adapters/ActorWebAdapter.ts so ActorWebAddress = string. Gated on: actor-web publishing the branded ActorAddress AND ignite bumping its @actor-web/runtime devDep (currently ^0.1.0, object address). Once installed, the drift guard actor-web-canonical-compat.types.ts enforces opaque string against the real branded runtime. Shipped tolerant in beta.8 (PR #67).

## Automation admission
- Expected operator value: Improves operator leverage around "collapse ignite ActorWebAddress tolerant union to pure string once @actor-web/runtime publishes the opaque branded address and ignite bumps the devDep so CI installs it" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts
- packages/ignite-adapters/package.json
- pnpm-lock.yaml
- .changeset/collapse-actorweb-address.md
- packages/ignite-element/src/tests/adapters/ActorWebAdapter.test.ts
- packages/ignite-element/src/tests/entrypoints.test.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts

## Scope Amendments
- Type: dependency-scope
- Added at: 2026-07-05T17:30:00Z
- Trigger: @actor-web/runtime 0.2.0 published and task dependency gate now requires the installed devDependency to resolve that runtime version
- Reason: ActorWebAddress collapse cannot be validated against the canonical branded string address unless the adapter package dependency and lockfile install @actor-web/runtime 0.2.0
- Added paths: packages/ignite-adapters/package.json, pnpm-lock.yaml
- Evidence source: npm view @actor-web/runtime version
- Evidence: npm view @actor-web/runtime version | npm resolves @actor-web/runtime to 0.2.0; package still declares ^0.1.0
- Accuracy signal: task brief dependency section and package manifest agree the devDependency bump is required
- Follow-up needed: none

- Type: release-note-scope
- Added at: 2026-07-05T17:38:00Z
- Trigger: public ActorWebAddress type and optional actor-web peer floor changed
- Reason: Published package type contract changes require a changeset for @ignite-element/adapters and ignite-element
- Added paths: .changeset/collapse-actorweb-address.md
- Evidence source: repo changeset policy
- Evidence: repo changeset policy | ActorWebAddress is re-exported from ignite-element/actor-web and @ignite-element/adapters/actor-web
- Accuracy signal: changeset file scoped to affected public packages only
- Follow-up needed: none

- Type: test-fixture-scope
- Added at: 2026-07-05T17:47:00Z
- Trigger: fas validate-task typecheck found legacy object actor-web address fixtures outside the adapter package
- Reason: The address contract collapse requires downstream package test fixtures that instantiate ActorWebSourceSnapshot/ActorWebSource values to use string addresses
- Added paths: packages/ignite-element/src/tests/adapters/ActorWebAdapter.test.ts, packages/ignite-element/src/tests/entrypoints.test.ts, packages/ignite-element/src/tests/IgniteCore.test.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Evidence source: .fas/state/verification/validate-task-1783272749.log
- Evidence: .fas/state/verification/validate-task-1783272749.log | TypeScript errors in ActorWebAdapter.test.ts, entrypoints.test.ts, IgniteCore.test.ts, and igniteCore.types.test.ts
- Accuracy signal: All added files were named by the failed typecheck diagnostics
- Follow-up needed: none

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Blocked until `@actor-web/runtime` publishes the branded string `ActorAddress`
  and this repo bumps the installed/devDependency version. Current verification
  on 2026-07-03 shows `@ignite-element/adapters` still resolves
  `@actor-web/runtime@0.1.0`, which uses the legacy object address.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
