# add command metadata helpers for enriched agent runtime sche

## Source
Created with `fas create-task` on 2026-04-21.

## Problem
Implement optional command(fn, metadata) helper support for igniteCore command facades so plain functions remain valid commands and wrapped commands behave like functions while contributing JSON-serializable metadata to getSchema(). Include low-overhead schema helpers such as command.number({ minimum, maximum }) for payload metadata, preserve existing command execution/render behavior, and demonstrate it in the XState API showcase.

## Automation admission
- Expected operator value: Improves operator leverage around "add command metadata helpers for enriched agent runtime schemas" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- Plain command functions continue to work without metadata.
- `commands` callbacks may receive a `command` helper for wrapping command functions with metadata.
- Wrapped commands remain callable from render args and `execute(commandName, payload)`.
- `getSchema()` preserves the existing `commands`, `events`, and `state` fields and adds enriched command contract metadata when provided.
- The XState API showcase demonstrates `setLimit` and `setStep` metadata without forcing metadata on every command.
- Typecheck, focused tests, and example Playwright proof pass
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Add a lightweight callable `command(fn, metadata)` helper to the igniteCore command facade context. The helper returns the same callable command shape used by render args and the agent runtime, but stores JSON-serializable metadata out-of-band for schema generation.
- Add small input schema helpers, starting with `command.number({ minimum, maximum })`, so developers can express numeric payload constraints without repeating `type: "number"`.
- Extend the agent schema shape with an optional `contract.commands` map while preserving the existing top-level arrays and state schema for compatibility.

## Alternatives considered
- Require every command to use an object descriptor. Rejected because it would increase authoring overhead and break the simple command-function API.
- Infer runtime metadata from TypeScript parameter types. Rejected because TypeScript types are erased at runtime and would require a build-time transform or explicit schema registration.
- Keep metadata fully open-ended with no helper. Rejected because common payload metadata should be low-friction and consistent enough for agents and inspectors.

## Affected areas
- `packages/ignite-element/src/igniteCore/*` for command facade typing and helper implementation.
- `packages/ignite-element/src/types/schema.ts` and runtime schema generation for enriched contract output.
- `packages/ignite-element/src/examples/xstate/*` for the API showcase and agent runtime proof.
- Focused Vitest/type tests plus the XState Playwright example proof.

## Implementation plan
- Inspect the existing command callback, render args, runtime execute, and schema generation paths.
- Add command metadata types and a wrapper helper that preserves command call signatures.
- Thread command metadata into `getSchema()` under a backward-compatible optional contract field.
- Demonstrate the helper in the XState API showcase for `setStep` and `setLimit`.
- Add focused tests for plain commands, wrapped commands, schema metadata, and example agent runtime behavior.

## Verification plan
- Run focused Vitest and type tests for igniteCore and agent runtime typing.
- Run the XState example TypeScript build.
- Run the XState Playwright proof that drives `window.__igniteExamples.apiShowcase.execute("increment")` and checks `getView().isLimited`.
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Command wrappers must stay plain-callable so render code and `execute()` do not need branchy special cases.
- Schema metadata must remain serializable and optional so current consumers of `getSchema()` are not broken.
- Type inference should not force developers to annotate command functions beyond normal payload parameter types.

## Dependencies
- No external dependency or PR is required.
- Existing XState showcase changes are in the current worktree and should be preserved.

## Open questions
- Non-blocking assumption: the enriched schema will use an optional `contract.commands` map rather than changing the existing top-level `commands: string[]` field.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
