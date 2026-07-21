# Extract browser-safe shared Voice Workbench Story modules and fresh-fixture entrypoints

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
After Voice Workbench host convergence, extract the seven executable narrative bodies and deterministic construction seams from Vitest-only code into example-local browser-safe modules for Ignite Alchemy. Keep ordinary typed Story functions and explicit stable catalog metadata consumed by both Vitest and the browser through the existing igniteTest component story API. Replace embedded Vitest polling and expectations with portable fixture facts and waiting helpers, retain test-only receipt assertions in Vitest, construct real XState machines and Ignite runtimes with controlled external ports, expose an optional actor-creation observation hook, and provide abortable deterministic cleanup without public Ignite changes.


## Acceptance criteria
- All seven existing Voice Workbench failure and recovery stories execute from shared browser-safe modules imported by both Vitest and a browser-safe compilation test.
- Each Story remains an ordinary typed function or example-local catalog entry and is executed through igniteTest component story without defineStory, runStory, or a second executor API.
- Every catalog entry declares stable semantic storyId and pageId values independent of array position, timing, browser order, and receipt serialization.
- Shared Story functions use an example-local structural Story page interface derived from public IgniteTestScenario behavior; no private IgniteTestStoryContext type is exported.
- Every Story invocation receives a newly constructed real machine, actor, Ignite runtime, controlled external ports, and deterministic cleanup handle.
- No shared Story or fixture module imports Vitest, jsdom, a test file, a browser global at module load, or private packages/ignite-element implementation modules.
- The preparation failure, permission recovery, cancellation, timeout retry, stale receipt, artifact revision conflict, and speech-unavailable stories retain their current semantic checkpoints and receipts.
- Fixture cleanup settles or aborts pending operations and releases subscriptions, actors, timers, and controlled adapter resources without cross-run state leakage.
- Portable wait helpers and fixture operations return facts instead of invoking vi.waitFor or expect; Vitest-only final receipt and direct-coverage assertions remain in the test file.
- Fixture construction accepts an optional actor-system observation hook before actor start without making XState observation mandatory for Story execution.
- Existing Voice Workbench narrative and graph tests remain behaviorally equivalent after extraction.
- No files under packages/ignite-element are modified.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Extract an example-local catalog whose entries contain stable metadata, an ordinary typed Story callback, and a fresh fixture factory.
- Replace Vitest-bound waits and expectations with controlled-port operations, portable wait predicates, returned facts, abort signals, and idempotent disposal.
- Keep final receipt matrices, direct invariant assertions, and test-runner conveniences in Vitest while a browser-safety test imports every shared module through the Vite/TypeScript path.

## Alternatives considered
- Rejected importing workbench-narratives.test.ts in the browser or bundling Vitest shims.
- Rejected exporting IgniteTestStoryContext or adding a public defineStory/runStory surface solely to type example-local callbacks.
- Rejected mocked state machines; fixtures construct the real machine and control only clocks, providers, network, microphone, speech, identifiers, and other external ports.

## Affected files
- examples/agents/voice-workbench/src/workbench-narratives.test.ts
- examples/agents/voice-workbench/src/story-workbench/stories.ts
- examples/agents/voice-workbench/src/story-workbench/fixtures.ts
- examples/agents/voice-workbench/src/story-workbench/types.ts
- examples/agents/voice-workbench/src/story-workbench/stories.browser-safe.test.ts
- examples/agents/voice-workbench/src/story-workbench/fixtures.test.ts
- examples/agents/voice-workbench/README.md

## Scope Amendments
- None.

## Implementation plan
- Identify Vitest-only fixture and assertion dependencies in workbench-narratives.test.ts.
- Define stable catalog identities and the example-local structural Story page and fixture contracts.
- Extract deterministic fixture construction, portable waits, controlled ports, observation-before-start hook, abortable cleanup, ordinary Story functions, and catalog metadata into browser-safe modules.
- Rewire Vitest to invoke those functions through the existing igniteTest component story API without changing semantic checkpoints or receipts.
- Add browser-safe compilation and lifecycle tests covering fresh construction and exact cleanup.

## Verification plan
- Run focused Voice Workbench narrative tests and browser-safe module tests.
- Run Voice Workbench typecheck and build to prove no Vitest or Node-only imports leak into browser modules.
- Run fas validate-task and the final full verification lane after tracked source changes.

## Risks
- The extraction could preserve pre-convergence ownership or accidentally duplicate fixtures.
- An example-local callback type could accidentally widen into a public API proposal; keep it structural and local.
- Browser modules could transitively import Vitest, Node-only helpers, or private Ignite implementation files.
- Cleanup drift could make replay appear deterministic while leaking actors, subscriptions, timers, or pending operations.

## Dependencies
- Depends directly on architecture task-1784602834084.
- Depends directly on Voice Workbench host convergence task-1784298700854.
- Provides the shared Story and fixture input for technical POC task-1784655415553.
- Remains a direct prerequisite of controller task-1784602868853 and lens task-1784602883094 so their production inputs are explicit.

## Open questions
- The exact observer input shape must follow W1 and the converged fixture factory, but it must install before actor start and remain optional.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
