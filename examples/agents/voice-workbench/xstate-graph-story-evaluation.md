# XState Graph and Story Evaluation

Date: July 20, 2026
Example: `examples/agents/voice-workbench`
Task: evaluate whether Voice Workbench still needs an Ignite-side XState graph-testing bridge after executable-narrative dogfood

## Verdict

No new Ignite API is warranted.

Direct composition is sufficient:

- XState owns graph generation and raw machine snapshots.
- Story owns user intent, fixture-owned boundary behavior, semantic checkpoints,
  view evidence, command-availability evidence, and the ordinary receipt/trace
  output.
- The example-local fixture owns fresh actor/runtime/component construction and
  cleanup for each replayed path.

The evidence does not show two framework-level problems. It shows two repeated
consumer costs that remain correct ownership boundaries:

1. Event-path selection must use explicit public-intent events and cannot
   substitute private runtime-correlated exits.
2. Each executable path needs a fresh fixture because runtime correlation,
   subscriptions, and cleanup are instance-owned.

Neither cost justifies a new bridge API.

## Evidence Matrix

| Utility | What it proved | Friction observed | Verdict |
| --- | --- | --- | --- |
| `getShortestPaths` | Deterministic reachable parent-session vertices match the expected topology. | Callers must choose a serialized state projection that strips raw XState details down to the semantic state shape they care about. | Accept direct use. |
| `getSimplePaths` | The same reachable vertex set is available with longer traversals preserved. | Same state-serialization choice as `getShortestPaths`; no extra Ignite help needed. | Accept direct use. |
| `getPathsFromEvents` | An explicit characterization sequence can use `MODEL_PREPARATION_PORT_RECEIVED` as setup/boundary data to reach `ready`, then `SUBMIT_PROMPT` to begin the public user-intent prefix into `responding`. | The runtime-correlated timeout exit is not directly selectable from static traversal because the timeout event must match the live child request identity. | Keep setup receipts local to graph characterization, keep `SUBMIT_PROMPT` as the public intent boundary, then let Story prove the correlated outcome. |
| `createTestModel` | Useful as a characterization boundary only. On XState `5.32.1`, it rejects invoked machines with `Invocations on test machines are not supported`. | It cannot own Voice Workbench narrative replay because the parent machine intentionally invokes children. | Record as comparison-only evidence; do not wrap it with an Ignite bridge. |

## Executable Proof

`src/session.graph.test.ts` now demonstrates the supported composition pattern:

1. Use `getShortestPaths` and `getSimplePaths` over the raw parent machine with
   explicit event filtering and a semantic state serializer.
2. Use `getPathsFromEvents` to select a characterization sequence that reaches
   `ready` with the setup receipt `MODEL_PREPARATION_PORT_RECEIVED`, then starts
   the public user-intent prefix with `SUBMIT_PROMPT`.
3. Use `igniteTest({ component }).story(...)` plus a fresh local fixture to
   prove the real behavioral path:
   `ready -> submit prompt -> timeout -> ready`.
4. Checkpoint the semantic snapshot, projected view, and command availability,
   while preserving the ordinary Story trace and receipt output.

This split is intentional. Raw graph traversal can use the preparation receipt
as local setup data and identify where the public `SUBMIT_PROMPT` intent begins,
but Story plus fixture-owned behavior is the right layer for proving the
runtime-correlated timeout outcome.

## Repeated Friction Categories

These costs repeated during the comparison and should remain local composition
concerns unless broader consumers prove otherwise:

- Explicit event-to-driver mapping:
  graph utilities operate on machine events, but Voice Workbench intentionally
  exposes public commands, not private child-machine or timeout correlation
  facts, as the user-facing surface. Even in characterization, the preparation
  receipt is setup data, not a public user command.
- Fresh fixture lifecycle:
  each replay needs a new actor, runtime, component, pending port state, and
  cleanup boundary.
- Semantic snapshot projection:
  useful graph assertions require a narrower serializer than raw XState
  snapshot/context data.
- `createTestModel` invoked-machine rejection:
  this is an XState utility limitation for this class of machine, not an Ignite
  testing-surface defect.

## Why This Does Not Cross the API Threshold

The task’s decision threshold was at least two repeated framework-level
problems. The observed costs are real, but they are not framework defects:

- explicit driver mapping keeps private machine facts private;
- fresh fixtures preserve isolation and cleanup correctness;
- semantic snapshot projection is a normal graph-characterization choice; and
- `createTestModel` failure is upstream utility behavior on invoked machines.

Because the problems do not belong to Ignite’s testing surface, adding
`igniteTest().graph(...)`, a graph-aware runner, a second receipt DSL, or an
XState-specific bridge would hide the ownership boundary instead of improving
it.

## User Value

The supported pattern already gives the user the important result:

- generated reachability paths from XState;
- user-visible behavioral proof from Story;
- normal Story receipts, trace, and diagnostics;
- explicit drivers that never reclassify private machine events as public
  commands; and
- isolated path replays without new Ignite core DSL or dependency surface.
