# Adapter contract naming: replace stream/getState/subscribe w

## Source
Created with `fas create-task` on 2026-06-12.

## Problem
Decision from 2026-06-12 discussion while implementing task-1781292649702: the optional IgniteAdapter stream() seam is misnamed because it is not websocket/queue/buffer transport; it is a subscription to source-emitted domain events. Before stable v3, align the internal adapter contract with the public igniteCore snapshot vocabulary: getState() -> getSnapshot(), subscribe(listener) -> subscribeSnapshots(listener), stream?(listener) -> subscribeEvents?(listener). Keep public igniteCore runtime API unchanged: getSnapshot(), watchSnapshot(), on(), execute().events, record(). Preserve source-native vocabulary inside adapters only (Redux may still call store.getState(); XState may still call actor.getSnapshot(); Actor-Web may still call source.snapshot()/subscribeEvent()). Update all adapters, adapter guards, factories/runtime bridge, tests, docs/briefs/task wording, and current XState emitted-events work to the new names. Redux/MobX should omit subscribeEvents unless a real emitted-event channel exists. This task blocks/supersedes committing the current task's dirty stream()-named implementation as-is; either fold the rename into the active XState task before verification or run this task immediately before completing task-1781292649702.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-core/src/IgniteAdapter.ts
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/src/adapters/XStateAdapter.ts
- packages/ignite-adapters/src/adapters/ReduxAdapter.ts
- packages/ignite-adapters/src/adapters/MobxAdapter.ts
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/igniteCore/xstate.ts
- packages/ignite-element/src/tests

## Scope Amendments
- Type: scope-reduction
- Added at: 2026-06-12
- Reason: `packages/ignite-adapters/src/utils/adapterGuards.ts` was predicted as affected but deliberately left unchanged. It only inspects **source-native** shapes for adapter inference — Redux `store.getState`/`subscribe`/`dispatch`, the `XStateActorLike` shape with `getSnapshot`/`subscribe`/`send`. Those are the sources' own APIs, which the contract rename preserves, so renaming them would be incorrect. Removed from Affected files.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Blocks closeout of task-1781292649702 (`XStateAdapter: implement stream() over XState v5 emitted events`) unless the rename is folded into that active implementation before verification.
- Blocks the stable main-merge and stable-cut path; `Stable v3: merge the v3 line to main and retire branch-dispatch docs deploys` now depends on this task and task-1781292649702.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
