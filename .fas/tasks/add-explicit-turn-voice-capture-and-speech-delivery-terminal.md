# Add explicit turn, voice-capture, and speech-delivery terminal lifecycles

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Complete the lifecycle architecture after provider/turn restructuring. Make the outer model/capability round loop an invoked child actor or machine that owns request, evaluation, authorization, capability execution, round count, cancellation, timeout, exhaustion, and exactly one terminal result while retaining modelTurn() as pure one-round policy. Formalize browser voice capture and speech delivery as child lifecycles with imperative ports and serializable facts. Replace shell-owned watcher orchestration and synthetic COMPLETE_RESPONSE failure recovery with explicit typed events.

## Acceptance criteria
- The parent session handles distinct TURN_COMPLETED, TURN_FAILED, CANCELLED, TIMEOUT, and ROUND_LIMIT_REACHED outcomes; a failed/cancelled/timed-out turn returns to the appropriate idle/unavailable state without emitting response-completed.
- The model-turn child owns the six-round limit, model requests, domain authorization, capability execution, feedback/history, cancellation, timeout, stale-result rejection, and exactly-once terminal emission while reusing pure modelTurn policy.
- Voice capture has one executable statechart/transition table covering support check, idle, listening, interim transcript, final transcript, consume, cancel, permission denial, failure, end, reset, retry, and dispose behavior.
- Speech delivery distinguishes pending, muted, queued, delivered, unavailable, failed, cancelled, and transport-neutral acknowledgement; speechSynthesis.speak() alone never records delivered/played.
- Browser APIs, model HTTP, capability providers, clocks, and abort controllers remain ports in the imperative shell; expected failures cross actor boundaries as typed facts instead of throws.
- Each async request carries an attempt/turn identity so stale callbacks cannot mutate a newer lifecycle; cancellation and disposal are idempotent.
- Public Ignite commands represent user or authorized domain intent; adapter completions and internal read-model receipts use private actor event/port channels.
- Graph/model tests prove every terminal and recovery path, forbidden command admission, retry bounds, and agreement between raw snapshots and derived views; focused and full example verification pass.
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
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/capability-federation.ts
- examples/agents/voice-workbench/src/headless-proof.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model-turn.ts
- examples/agents/voice-workbench/src/model-turn.test.ts
- examples/agents/voice-workbench/src/parity.tsx
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/speech.ts
- examples/agents/voice-workbench/src/speech.test.ts
- examples/agents/voice-workbench/src/terminal.ts
- examples/agents/voice-workbench/src/voice.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/agent-loop.test.ts
- examples/agents/voice-workbench/src/capability-federation.test.ts
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/parity.test.tsx
- examples/agents/voice-workbench/src/projections.test.ts
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/terminal.test.ts
- examples/agents/voice-workbench/src/voice.test.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/workbench.test.tsx

## Reference files

- examples/agents/voice-workbench/src/domain.ts
- examples/agents/voice-workbench/src/workbench.tsx

## Scope Amendments
- Type: architecture-plan-correction
- Added at: 2026-07-16
- Trigger: The architect and staff-engineer passes found that the generated commit plan contained tests only even though the accepted behavior requires production child machines, cancellable ports, parent integration, and shell thinning.
- Reason: The original affected-file hints omitted the new model-turn and speech machine modules plus known consumers of internal commands that must move off the public Ignite schema.
- Added paths: examples/agents/voice-workbench/src/model-turn.ts, examples/agents/voice-workbench/src/model-turn.test.ts, examples/agents/voice-workbench/src/speech.ts, examples/agents/voice-workbench/src/speech.test.ts, examples/agents/voice-workbench/src/capability-federation.ts, examples/agents/voice-workbench/src/headless-proof.ts, examples/agents/voice-workbench/src/parity.tsx, examples/agents/voice-workbench/src/terminal.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/capability-federation.test.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/parity.test.tsx, examples/agents/voice-workbench/src/projections.test.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/terminal.test.ts, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/README.md
- Reference-only paths: examples/agents/voice-workbench/src/domain.ts, examples/agents/voice-workbench/src/workbench.tsx
- Evidence source: delegated architecture and staff-engineer review of live source
- Evidence: session.ts still exits responding on COMPLETE_RESPONSE; agent-loop.ts synthesizes completion on failure; workbench-agent.ts owns the six-round loop; voice.ts and main.tsx own browser lifecycle transitions; nine private/read-model commands have consumers across the added shell and projection files.
- Accuracy signal: The acceptance criteria cannot be met by the generated tests-only plan, while every added production path owns or consumes a lifecycle or private event being changed.
- Follow-up needed: Regenerate the task packet and commit plan before spawning the sole code writer. Do not modify shared Ignite packages, add public inspection APIs, or absorb the optional task-5 graph bridge.

### Closeout alignment

- `examples/agents/voice-workbench/src/domain.ts` and `examples/agents/voice-workbench/src/workbench.tsx` remained reference-only; neither required a production edit to satisfy the accepted lifecycle ownership.
- `examples/agents/voice-workbench/src/parity.test.tsx` remained an unchanged compatibility lane. Its existing assertions passed in the complete voice-workbench suite after the parity host was migrated, so a no-op diff was intentionally not manufactured.
- `.fas/memory/architecture.md`, `.fas/memory/decisions.md`, `.fas/memory/incidents.md`, `.fas/memory/patterns.md`, and `.fas/memory/pr-feedback.md` are generated, ignored FAS projections. They are not implementation inputs or changeset members and remain unstaged.
- The SRE-driven supervision repair stayed inside already accepted lifecycle surfaces: the parent projects serializable interruption facts, the browser shell owns the active controller and whole-turn clock, and asynchronous read-model envelopes are fenced by turn and attempt identity.

## Implementation plan
- Add failing machine, graph, and integration tests for all terminal outcomes, stale identities, retry bounds, voice consume rules, queued-versus-delivered speech, private command removal, and raw-snapshot/view agreement; record the TDD-red receipt before production edits.
- Add an example-private model-turn child machine that owns request, evaluation, authorization phase, capability execution, bounded history, six-round exhaustion, cancellation, timeout, stale-result rejection, and exactly-once terminal output while recreating the pure modelTurn() one-round policy instead of storing its generator.
- Add backward-compatible optional AbortSignal propagation through model and capability ports, remove synthetic completeResponse recovery, and reduce workbench-agent orchestration to typed shell port drivers.
- Make the voice-capture machine authoritative for support, idle, listening, interim/final transcript, consume, cancellation, permission denial, failure, reset/retry, and idempotent disposal with attempt correlation.
- Add a speech-delivery machine that distinguishes pending, muted, queued, delivered, unavailable, failed, cancelled, and disposed; treat speak() acceptance as queued and only utterance completion as delivered.
- Integrate all three child machines with the parent session while preserving the four parent raw values, existing aggregate reducer authority, serializable contexts, and view field compatibility; COMPLETE_RESPONSE stages a serializable pending completion, and only a matching TURN_COMPLETED atomically commits aggregate state and ends the turn.
- Move adapter and read-model receipts off the public Ignite command schema onto typed private events, then thin main, parity, terminal, headless-proof, and projection consumers without changing shared Ignite APIs.
- Update focused and compatibility tests, document the executable ownership/source-of-truth matrix and 19-command public schema, and preserve task 5 as an optional later evaluation.

## Verification plan
- Before production edits, run the focused new lifecycle tests in their expected failing state and record `fas tdd-red`.
- Run focused model-turn, model, capability, and workbench-agent tests after the model lifecycle step.
- Run focused voice, speech, session graph/headless, browser, parity, projection, terminal, and workbench tests after child integration.
- Run the complete voice-workbench suite and its typecheck before delegated QA.
- Run `fas validate-task` for the inner-loop verification gate after scoped behavior and docs are green.
- After QA, SRE, and reviewer clearance, run one root-owned `.fas/scripts/verify.sh --full` at the final release-quality gate.

## Risks
- Keep provider health distinct from per-turn execution failure: only explicit MODEL_FAILED enters unavailable; TURN_FAILED, CANCELLED, TIMEOUT, and ROUND_LIMIT_REACHED return to idle without response-completed.
- Do not store actors, generators, ports, functions, clocks, controllers, signals, browser recognition objects, or utterances in machine context.
- Correlate every async result by turnId or attemptId and make cancellation, terminal emission, and disposal idempotent so stopped children cannot mutate a newer lifecycle.
- Avoid circular ownership: child machine modules cannot import session.ts; session.ts cannot import shell drivers; workbench-agent remains an imperative port driver.
- Preserve the four parent raw values and existing top-level view fields while adding child detail; projection compatibility tests must catch any stale consumer.
- Optional signal arguments must remain source-compatible with existing one-argument capability owners.
- Removing nine internal commands from getSchema() requires updating every known example consumer in the same change without creating a public replacement API.
- Keep graph traversal bounded by canonical payloads, serialized lifecycle values, and the six-round cap; do not enumerate unbounded context histories.

## Dependencies
- Epic: `epic-voice-workbench-statechart-conformance` (`terminal-lifecycles`).
- Depends on: `task-1784171435029`.
- Blocks: `task-1784171502136`.

## Open questions
- Resolved: transient turn failure returns to available.idle; only explicit provider-health failure enters unavailable.
- Resolved: acceptance event names are TURN_COMPLETED, TURN_FAILED, CANCELLED, TIMEOUT, and ROUND_LIMIT_REACHED; child-specific internal names may not leak into the parent contract.
- Resolved: runtime domain functions remain deterministic shell ports because DomainRegistry contains behavior and cannot enter serializable machine context; the model-turn child owns the authorization phase and consumes its typed result.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
