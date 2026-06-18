# ADDITIVE: implement select().whenChanged() per docs/effects-

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
ADDITIVE: implement select().whenChanged() per docs/effects-change-detection.md. Add a chainable whenChanged(run) to the select() result (runs run(current,previous) only when changed; returns self); flip the default equality from Object.is to structural value-equality WITH an Object.is fast path (valueEqual); add an optional isEqual override arg; export a shallowEqual helper. Keep the existing current/previous/changed fields. Pure/deterministic (agent-replay safe). Affected files: packages/ignite-element/src/runtime/effects.ts (createSelect), packages/ignite-core/src/RenderArgs.ts + packages/ignite-element/src/RenderArgs.ts (Selected/EffectSelector types), a shallowEqual export, and tests (whenChanged fires only on change; object selection no longer spurious; isEqual override; scalar fast-path).

## Automation admission
- Expected operator value: Improves operator leverage around "ADDITIVE: implement select().whenChanged() per docs/effects-change-detection.md. Add a chainable whenChanged(run) to the select() result (runs run(current,previous) only when changed; returns self); flip the default equality from Object.is to structural value-equality WITH an Object.is fast path (valueEqual); add an optional isEqual override arg; export a shallowEqual helper. Keep the existing current/previous/changed fields. Pure/deterministic (agent-replay safe). Affected files: packages/ignite-element/src/runtime/effects.ts (createSelect), packages/ignite-core/src/RenderArgs.ts + packages/ignite-element/src/RenderArgs.ts (Selected/EffectSelector types), a shallowEqual export, and tests (whenChanged fires only on change; object selection no longer spurious; isEqual override; scalar fast-path)." by reducing manual coordination, repetitive execution, or trust gaps.
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
- `packages/ignite-element/src/runtime/effects.ts` — `createSelect`: add chainable `whenChanged(run)` to the returned selection (runs `run(current, previous)` only when changed; returns self); flip default equality from `Object.is` to structural `valueEqual` with an `Object.is` fast path; thread the optional `isEqual` override.
- `packages/ignite-core/src/RenderArgs.ts` — `EffectSelection<Value>`: add the `whenChanged(run): EffectSelection<Value>` method to the type; `EffectSelector<Snapshot>`: add the optional `isEqual?` comparator parameter.
- `packages/ignite-element/src/RenderArgs.ts` — passthrough re-exports of `EffectSelection`/`EffectSelector` (confirm the widened types flow through; no logic).
- `packages/ignite-element/src/runtime/equality.ts` (new) — internal `valueEqual` (deep structural, pure, agent-replay safe) used as the default + public `shallowEqual` helper for the `isEqual` override convenience.
- `packages/ignite-element/src/index.ts` — export the `shallowEqual` helper on the public surface.
- `packages/ignite-element/src/tests/effects-select.test.ts` (new) — `whenChanged` fires only on change; object selection no longer spurious; `isEqual`/`shallowEqual` override path; scalar `Object.is` fast-path unchanged; raw `current/previous/changed` preserved.

Design doc: `docs/effects-change-detection.md` (tracked under `docs/v3-api-consistency.md`). ADDITIVE — no breaking change to existing `select` fields.

## Scope Amendments
- None.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- None known at task creation.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
