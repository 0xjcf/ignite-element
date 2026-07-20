# Evaluate an optional Ignite XState graph-testing bridge after executable-narrative dogfood

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
After the statechart epic example work, executable igniteTest narratives, Voice Workbench narrative dogfood, the post-dogfood ergonomics audit, and the Story API naming verdict complete, evaluate whether repeated consumer friction remains when composing XState 5 graph utilities with the final narrative and Story evidence APIs. Prefer documented composition and example-local helpers. A no-change verdict is successful. Only if at least two concrete repeated integration problems remain, add the smallest XState-specific optional bridge that feeds generated paths into existing narrative and Story machinery without owning graph traversal, runtime state, or narrative semantics.


## Acceptance criteria
- The task begins with a dogfood matrix comparing direct getShortestPaths, getSimplePaths, getPathsFromEvents, and createTestModel usage against the final igniteTest narrative, Story, snapshot, trace, and checkpoint vocabulary.
- The evidence identifies at least two repeated consumer integration problems before any public API is proposed; otherwise the task closes with a no-new-API decision.
- Any helper delegates traversal to xstate/graph, remains in the XState adapter or testing surface, preserves XState as an optional peer, and accepts fresh logic or actor construction.
- Generated internal machine events are not exposed as Ignite commands; callers provide explicit mappings to public intents or system-under-test drivers where needed.
- Raw XState value, context, status, output, error, children, and tags remain separate from Ignite semantic views and serializable Story evidence.
- No graph topology is added to getSchema, and no second narrative DSL, recorder, state authority, trace schema, graph algorithm, getBlueprint, or public inspect API is introduced.
- If an API ships, type, entrypoint, runtime, Voice Workbench narrative dogfood, docs, changeset, and full verification pass; if no API ships, the evidence artifact and direct tests pass.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Begin with an example-local Voice Workbench comparison harness and evidence artifact. Exercise `getShortestPaths`, `getSimplePaths`, `getPathsFromEvents`, and `createTestModel` against the finalized object-form `igniteTest({ component }).story(...)` vocabulary.
- Keep graph generation over raw XState logic and snapshots. Drive the system under test only through explicit public `narrative.intent(...)` mappings or fixture-owned `narrative.behavior(...)` operations, then assert ordinary Story checkpoints and receipts.
- Record which integration costs repeat across utilities and paths. Close with a no-new-API verdict when fewer than two framework-level problems remain.
- If two repeated framework-level problems are proven, stop and refresh scope before implementing the smallest optional XState-only bridge. Package implementation files are conditional, not pre-authorized by the evaluation plan.

## Alternatives considered
- Add `igniteTest().graph(...)` before dogfood: rejected because it would combine traversal and experience evidence before demonstrating repeated consumer need.
- Translate every raw machine event into an Ignite command: rejected because private receipts and machine lifecycle events are not public user intents.
- Let `createTestModel` replace Story execution: rejected because Story remains the portable behavior/projection evidence surface and XState remains the graph owner.
- Reuse one live actor across generated paths: rejected because each path needs fresh logic, actor, component, subscriptions, and cleanup.

## Affected files
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/xstate-graph-story-evaluation.md
- examples/agents/voice-workbench/README.md

## Conditional API scope
- Not planned for the evaluation slice.
- If and only if the evidence identifies at least two repeated framework-level integration problems, refresh scope before touching `packages/ignite-element/src/xstate.ts`, `packages/ignite-element/src/testing.ts`, adapter tests, type tests, or public entrypoints.

## Scope Amendments
- None.

## Implementation plan
- Add an executable, example-local direct-composition proof in `session.graph.test.ts` that compares all four XState graph utilities while preserving explicit machine-event-to-intent-or-behavior mappings and fresh system construction.
- Write `xstate-graph-story-evaluation.md` with the comparison matrix, user benefit, friction evidence, ownership boundaries, and the two-problem decision gate.
- Update the Voice Workbench README with the supported direct-composition pattern and the final no-API or conditional-bridge verdict.
- If the evidence does not meet the gate, make no package API, entrypoint, type, or changeset edits. If it does meet the gate, stop and run `fas scope refresh` before implementation.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- A graph path can look like a user story while containing private machine events; explicit drivers must preserve the distinction.
- `createTestModel` can become a second test runner if it is allowed to own Story semantics; use it only as a comparison point over XState traversal and execution hooks.
- Reusing actors or components across paths can leak state and subscriptions; each executable path proof must construct and dispose fresh resources.
- A Voice Workbench-specific inconvenience must not be promoted as framework-level friction without repetition across utilities or consumers.

## Dependencies
- Remains the optional-ignite-bridge member of epic-voice-workbench-statechart-conformance.
- Depends on the terminal-lifecycle and actor-topology tasks plus executable narrative implementation task-1783810065213, post-dogfood audit task-1783610933373, and Story naming verdict task-1784325062961.

## Open questions
- Whether direct xstate/graph composition already supplies sufficient path generation once narratives and Story receipts provide the higher-level experience evidence.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
