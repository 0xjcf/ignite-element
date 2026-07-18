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
