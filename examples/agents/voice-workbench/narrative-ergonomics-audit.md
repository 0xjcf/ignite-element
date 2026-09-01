# Voice Workbench Story Ergonomics Audit

Date: 2026-07-18
Task: `direct-1784394586900` / `task-1783610933373`

## Verdict

No public Ignite testing surface change is justified by the current dogfood.

The shipped `igniteTest({ component }).story(...)` helper, `record()`,
`snapshotStory()`, named checkpoints, command availability checks, ordinary test
assertions, and cleanup semantics already cover the Voice Workbench stories
with strong enough diagnostics to close this task without changing
the `test` export from `ignite-element/xstate`.

The remaining friction does not cross the brief threshold for public API growth:
there are not two repeated consumer problems that point to the same missing
generic surface.

## Evidence Baseline

Primary evidence came from:

- `examples/agents/voice-workbench/src/workbench-narratives.test.ts`
- `packages/ignite-element/src/tests/testing.test.ts`
- `examples/agents/voice-workbench/README.md`
- `docs/site/src/content/docs/guides/accessibility-first.mdx`

The dogfood suite exercises seven named stories and locks a coverage matrix
for commands, checkpoints, typed receipts, and final view status:

| Story | Core evidence covered |
| --- | --- |
| `preparation failure retries into ready` | preconditions, recovery, command availability, typed preparation receipts |
| `microphone permission denial recovers to typed prompt` | capability facts, passive voice failure state, text fallback |
| `correlated cancellation returns the active turn to idle` | passive transition, turn lifecycle, correlated cancellation |
| `timed out turn retries to an accepted response` | timeout terminal fact, retry flow, artifact acceptance, cleanup to ready |
| `stale correlated model receipts stay inert until the live turn ends` | stale receipt inertness, live correlation ownership |
| `artifact revision conflicts recover with the current revision` | consumer-driven external facts, conflict recovery, artifact revision checks |
| `speech unavailable remains actor-owned until acknowledged` | public command channel, passive speech facts, acknowledgment ownership |

The shipped helper coverage already proves:

- `given(...)` supports preconditions through structural `snapshot`, native
  `when(snapshot)` predicates, `view`, and
  `canExecute`.
- `intent(...)` supports typed public command calls with object-form commands.
- `behavior(...)` supports named fixture-owned external operations while keeping
  the existing Story recorder and trace.
- `checkpoint(...)` reports named failures against snapshot, view, events, and
  command availability.
- story failures include serialized Story evidence and phase metadata.
- cleanup runs on success, checkpoint failure, and callback failure.
- `serializeTrace()` and `snapshotStory()` already preserve portable receipts.

## Friction Classification

| Friction | Classification | Repeated consumer problem? | Notes |
| --- | --- | --- | --- |
| Fixture helpers such as `currentModelRequest`, `beginCurrentTurnCompletion`, and custom receipt senders are verbose | Voice Workbench/XState fixture-specific | No | The verbosity comes from this example's actor topology and correlated port receipts, not from a missing generic Ignite testing primitive. |
| Coverage matrix assembly is manual | Documentation-only | No | It is useful audit evidence, but the example can own this report structure locally. |
| Named checkpoint diagnostics need more context | Repeated public-surface evidence | No | The current helper already includes the story name, phase, checkpoint label, expected/received output, and serialized trace evidence. |
| External facts arrive through direct actor sends instead of `intent(...)` | Framework-neutral | No | This is expected: these are passive receipts and actor-owned lifecycle events, not public consumer commands. |
| Need a second story receipt envelope over `snapshotStory()` | Repeated public-surface evidence | No | Existing `snapshotStory()` and serialized trace already carry the portable summary this audit needed. |
| Need graph traversal or graph-aware assertions in Ignite | XState fixture-specific | No | Optional future bridge work belongs with `xstate/graph` ownership, not with Ignite’s core test DSL. |

## Why Public Surfaces Stay Unchanged

`packages/ignite-element/src/tests/testing.test.ts` stays unchanged because the
existing helper contract already covers the exact failure metadata, cleanup, and
portable story evidence used by the seven stories.

`docs/site/src/content/docs/guides/accessibility-first.mdx` stays unchanged
because the current guide already states the headless/runtime-vs-rendered-DOM
boundary and cites the Voice Workbench example as behavior-contract proof rather
than browser-AT proof. This audit did not surface repeated consumer confusion
that required broader docs changes there.

No story receipt envelope, trace replacement, graph engine, package API,
changeset, or XState bridge implementation is warranted from this evidence.

## Downstream Recommendations

### Story naming readiness

Ready to keep the current Story vocabulary.

- Keep `record()` as the durable way to capture long-form behavioral evidence.
- Keep `snapshotStory()` as the portable receipt surface.
- Keep `igniteTest({ component }).story(...)` as the opinionated composition layer
  over Story evidence rather than a replacement runtime authority.

### Optional XState bridge readiness

Not ready for implementation in Ignite core.

- There is a legitimate future seam for bridging named story checkpoints to
  XState graph coverage.
- The current dogfood does not show repeated consumer pain in Ignite’s public
  API.
- If pursued later, that work should stay optional, example-driven, and clearly
  owned by `xstate/graph` concerns rather than by a new Ignite assertion model.

## Practical Follow-up If Ergonomics Matter Later

If future examples surface the same pain at least twice, prefer this order:

1. Example-local fixture helpers.
2. Example or guide documentation that explains the pattern.
3. Internal helper extraction.
4. Public API change only after repeated cross-consumer evidence.

That sequence preserves the current testing surface and keeps domain- or
topology-specific ceremony out of the generic package contract.
