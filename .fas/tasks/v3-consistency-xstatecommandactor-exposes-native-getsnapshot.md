# v3 consistency: XStateCommandActor exposes native getSnapshot(), remove invented .state accessor

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
v3-api-consistency epic item (audit 2026-06-18). Principle: ignite should expose the SOURCE's native methods/values, not invent aliases that add mental overhead for devs/LLMs. The command actor is intentionally adapter-native — Redux exposes {dispatch,getState} (redux-native), Mobx is the store, ActorWeb is ActorWebCommandSource — but XStateCommandActor exposes an invented 'readonly state' getter instead of xstate v5's native getSnapshot(). getSnapshot() is also the ignite runtime's own vocabulary, so this fixes both a cross-API inconsistency and an un-native accessor. CHANGE (packages/ignite-adapters/src/adapters/XStateAdapter.ts): type XStateCommandActor<Machine> = { send; readonly state: ExtendedState<Machine> } -> { send; getSnapshot: () => ExtendedState<Machine> }; impl (the commandActor object ~L273-287): replace 'get state() { return adapter.getSnapshot(); }' with 'getSnapshot: () => adapter.getSnapshot()'. Behavior-preserving (same value, native method name). REMOVE .state outright (owner decision) — it is undocumented (no docs fence teaches it) and used in exactly two internal call sites, both updated here: (1) examples/adapters/xstate/xstateApiShowcaseRuntime.ts L47 actor.state.context.step -> actor.getSnapshot().context.step; (2) tests/types/igniteCore.types.test.ts L775 actor.state.context -> actor.getSnapshot().context. Add a runtime assertion in tests/adapters/XStateAdapter.test.ts that the command actor's getSnapshot() returns the current snapshot (and that .state is gone). Add a changeset (pre-stable beta breaking change to the exported XStateCommandActor type; releases with the next beta). Verify: fas validate-task + verify.sh --full green; grep confirms no remaining command-actor .state usages.

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
- packages/ignite-adapters/src/adapters/XStateAdapter.ts
- packages/ignite-element/src/examples/adapters/xstate/xstateApiShowcaseRuntime.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/adapters/XStateAdapter.test.ts
- .changeset/xstate-command-actor-getsnapshot.md

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-18
- Added paths: .changeset/xstate-command-actor-getsnapshot.md

- Type: scope-refresh-promotion
- Added at: 2026-06-18
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

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
