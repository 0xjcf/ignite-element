# Evaluate an optional Ignite XState graph-testing bridge from dogfood

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
After the statechart epic's example work, the existing headless-ergonomics audit, and named igniteTest rehearsals complete, evaluate whether repeated consumer friction remains when using XState 5 graph utilities directly from xstate/graph. Prefer documented composition and example-local helpers. A no-change verdict is successful. Only if concrete repeated friction remains, add the smallest XState-specific optional bridge that feeds generated paths into the existing igniteTest/story/rehearsal machinery without owning graph traversal or runtime state.

## Acceptance criteria
- The task begins with a written dogfood matrix comparing direct getShortestPaths/getSimplePaths/getPathsFromEvents/createTestModel usage against existing igniteTest, record/story, snapshot, trace, and rehearsal APIs.
- The evidence identifies at least two repeated consumer integration problems before any public API is proposed; otherwise the task closes with a documented no-new-API decision.
- Any implemented helper delegates traversal to xstate/graph, stays in the XState adapter/testing surface, preserves XState as an optional peer, accepts fresh logic/actor construction, and does not affect Redux, MobX, Actor-Web, or core runtimes.
- Generated internal machine events are not falsely exposed as Ignite commands; callers provide an explicit event-to-public-command/system-under-test mapping where needed.
- Raw XState value/context and native status/output/error/children/tags remain observable separately from derived Ignite views and serializable trace snapshots.
- No graph topology is added to getSchema(), and no getBlueprint(), public inspect(), second recorder, second rehearsal DSL, second state authority, or custom graph algorithm is introduced.
- If a public API ships, type tests, entrypoint/export tests, focused runtime tests, voice-workbench dogfood, docs, and a changeset pass; if no API ships, the evidence artifact and existing direct tests pass.
- The final result records why direct xstate/graph plus existing Ignite testing is sufficient or precisely what minimal bridge earned its maintenance cost.
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
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/adapters/XStateAdapter.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- packages/ignite-element/src/tests/entrypoints.test.ts
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/README.md

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
- Epic: `epic-voice-workbench-statechart-conformance` (`optional-ignite-bridge`).
- Depends on: `task-1784171467799`, `task-1783610933373`, and
  `task-1783810065213`.
- Blocks: none.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
