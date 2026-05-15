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
- Preserve existing Redux and MobX factory inference behavior unless explicitly invalidated by tests.

## Acceptance Criteria

- Actor-Web factory inference no longer creates runtime handles during adapter selection.
- Existing host-context Actor-Web source factory behavior still works when the element connects.
- Tests cover the no-eager-execution case.
- `fas validate-task` and final verification pass for the touched scope.

## Recommended Mode

6-agent

## Recommended Phase

implementation
