# Prevent eager Actor-Web source factory execution during adapter inference

## Goal

Prevent `igniteCore()` from executing zero-argument Actor-Web source factories while merely inferring the adapter type.

## Evidence

- `packages/ignite-element/src/igniteCore/types.ts` allows Actor-Web source factories with optional host context.
- `packages/ignite-element/src/IgniteCore.ts` calls `inferFromFactory()` for function sources when `adapter` is omitted.
- `inferFromFactory()` executes zero-argument factories, which can allocate Actor-Web runtime handles before host binding or cleanup.

## Scope

- Adjust Actor-Web adapter inference semantics with the smallest compatible API change.
- Add regression coverage proving ambiguous Actor-Web factories are not executed eagerly.
- Align the public type surface, docs, and changelog with the reviewed fail-closed behavior: zero-argument/defaulted factories require explicit adapter selection unless they are required host-context Actor-Web factories.

## Acceptance Criteria

- Actor-Web factory inference no longer creates runtime handles during adapter selection.
- Existing host-context Actor-Web source factory behavior still works when the element connects.
- Tests cover the no-eager-execution case.
- Public types, state-adapter docs, and the package changelog describe the compatibility break.
- `fas validate-task` and final verification pass for the touched scope.

## Recommended Mode

6-agent

## Recommended Phase

implementation

## Scope Amendments
- Type: review-driven scope expansion
- Added at: 2026-05-15
- Trigger: QA/SRE/reviewer found runtime/type/docs release-readiness gaps while preserving no-eager-execution
- Reason: The safe implementation intentionally fails closed for zero-arg/defaulted factories across adapter inference, requiring test, type, docs, and changelog coverage.
- Added paths: packages/ignite-element/src/IgniteCore.ts, packages/ignite-element/src/igniteCore/types.ts, packages/ignite-element/src/tests/IgniteCore.test.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts, docs/site/src/content/docs/concepts/state-adapters.mdx, packages/ignite-element/CHANGELOG.md
- Evidence source: delegated-review
- Evidence: delegated-review | .fas/state/agent-orchestration.json | 6-agent QA/SRE/reviewer accepted runtime/types/tests/docs/changelog alignment after retries
- Accuracy signal: fas validate-task passed format lint typecheck after scoped fixes
- Follow-up needed: Keep separate Actor-Web adapter entrypoint/runtime-boundary docs task queued.

## Affected files
- packages/ignite-element/src/IgniteCore.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/site/src/content/docs/concepts/state-adapters.mdx
- packages/ignite-element/CHANGELOG.md
