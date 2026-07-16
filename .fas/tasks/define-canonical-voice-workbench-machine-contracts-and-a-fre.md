# Define canonical voice-workbench machine contracts and a fresh actor factory

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Start from .fas/artifacts/audits/voice-workbench-state-machine-audit.md. Make machine shapes the reviewed design input, then make executable XState logic the only runtime lifecycle authority. Inventory every provider, turn, voice-capture, speech-delivery, aggregate, policy/fact, and presentation surface; resolve the speech receipt-versus-delivery ambiguity; classify all commands/events as public intent, model-authorized domain command, private adapter result, or internal read-model fact. Export reusable unstarted machine logic and/or a createVoiceWorkbenchSessionActor factory that creates fresh context per runtime/test while preserving getSchema() as the only public Ignite blueprint.

## Acceptance criteria
- A reviewed lifecycle-disposition table and Mermaid statecharts cover session/provider/turn, model-turn orchestration, voice capture, and speech delivery, with maturity labels and one owner per lifecycle fact.
- The contract enumerates states, public commands, private/internal events, guards, invoked effects/ports, emitted facts, initial/terminal/recovery paths, raw snapshot value/context/native metadata, derived views, and command-availability rules.
- Executable machine logic or a factory can create at least two isolated actors whose initial contexts do not share mutable state; importing the module no longer forces tests to reuse one already-started actor.
- The authoritative machine invariants and forbidden combinations are represented as executable predicates or typed contract data ready for xstate/graph tests.
- The speech contract distinguishes projection acknowledgement, delivery queued, delivery completed, muted, unavailable, failed, and cancelled outcomes.
- Reducer-owned conversation/artifact state, policy outcomes, capability results, and presentation-only state keep explicit non-machine dispositions instead of becoming competing lifecycle authorities.
- No getBlueprint(), public inspect(), second schema, second recorder, or generic graph abstraction is introduced.
- Focused tests and the voice-workbench fast verification lane pass.
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
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
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
- Epic: `epic-voice-workbench-statechart-conformance` (`machine-contracts`).
- Depends on: none.
- Blocks: `task-1784171355639`.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
