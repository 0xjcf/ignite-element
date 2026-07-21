# Harden Ignite Alchemy deterministic replay and derived review evidence

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Harden Ignite Alchemy as a deterministic-within-a-controlled-envelope testing and review product. Prove fresh fixtures, repeated semantic equivalence, generation isolation, exact cleanup, passive and child observation, parallel projection, coverage stability, accessible rendered behavior, and useful no-lens operation. Produce a versioned example-local derived report that embeds the unchanged ordinary JSON-safe Story receipt and adds normalized page outcomes, optional observations, coverage, gaps, exclusions, and verification metadata for read-only CI and LLM review. Define ordering, redaction, bounds, volatile-field exclusion, generation command, and artifact destination without creating another trace or public contract.


## Acceptance criteria
- Repeating a Story from identical controlled inputs produces semantically equivalent Story receipts, page outcomes, views, availability, coverage, and controlled-clock facts.
- Wall-clock duration is retained as reviewer telemetry but excluded from deterministic equivalence unless asserted through the controlled clock.
- Cancel, Restart, Back, failures, and ordinary completion each dispose actors, Story and lens subscriptions, timers, pending port work, and browser listeners exactly once.
- A multi-region or equivalent fixture proves all active parallel nodes, and passive or child-driven transitions are recorded without overstating unavailable causality.
- An adapter-neutral fixture proves Run, Step, Back, Restart, receipts, snapshot, view, availability, and page dispositions remain useful while machine topology coverage is explicitly unavailable without the XState lens.
- A versioned example-local JSON-safe report embeds the ordinary IgniteStorySnapshot receipt unchanged and adds stable Story identity, normalized page outcomes, optional lens observations, coverage classifications, gaps, exclusions, and verification metadata without replacing the Story trace.
- The report schema defines deterministic ordering, bounded/redacted raw evidence, excluded volatile fields, semantic-equivalence fields, and a schemaVersion with no claim of public compatibility.
- A documented package script generates `.fas/artifacts/traces/ignite-alchemy-review-report.json` from controlled inputs; generatedAt and environment metadata are outside semantic equivalence.
- CI and LLM consumers are documented as read-only reviewers that may identify or propose gaps but cannot authorize commands, alter coverage evidence, or become runtime state authorities.
- Rendered browser smoke and accessibility checks remain separate from headless Story assertions and cover keyboard controls, focus, status announcements, and failure recovery.
- Focused example tests pass, then fas validate-task and the full repository verification lane pass with no packages/ignite-element public API changes.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Add conformance fixtures around the production controller, optional lens, coverage projection, and browser lifecycle, then compare normalized semantic outputs across repeated runs.
- Define an example-local report envelope with schemaVersion, unchanged Story receipt, normalized derived sections, provenance, redaction metadata, and a separate volatile verification envelope.
- Add one deterministic generation command that writes the FAS trace artifact and document CI and LLM read-only consumption.

## Alternatives considered
- Rejected byte-for-byte comparison of wall-clock and environment metadata.
- Rejected reserializing or extending the Ignite Story trace, publishing the report as a package contract, or granting CI/LLMs command authority.
- Rejected claiming machine coverage in the adapter-neutral no-lens fixture.

## Affected files
- examples/agents/voice-workbench/src/story-workbench/review-report.ts
- examples/agents/voice-workbench/src/story-workbench/review-report.test.ts
- examples/agents/voice-workbench/src/story-workbench/generate-review-report.ts
- examples/agents/voice-workbench/src/story-workbench/replay.test.ts
- examples/agents/voice-workbench/src/story-workbench/workbench.test.tsx
- examples/agents/voice-workbench/package.json
- examples/agents/voice-workbench/README.md
- .fas/artifacts/traces/ignite-alchemy-review-report.json

## Scope Amendments
- None.

## Implementation plan
- Build repeated replay and cleanup fixtures for completion, cancellation, restart, failure, and Back.
- Add parallel, passive, child-driven, controlled-clock, and adapter-neutral no-lens conformance cases.
- Define and implement the versioned JSON-safe derived report around the unchanged ordinary IgniteStorySnapshot, normalized page results, optional lens observations, coverage, gaps, exclusions, provenance, redaction, and separate volatile verification metadata.
- Add browser accessibility and smoke coverage plus CI artifact generation.
- Document LLM and CI consumption as read-only review with no command or evidence authority.

## Verification plan
- Compare semantic replay outputs across repeated runs and assert timing exclusion except for controlled-clock facts.
- Prove exact cleanup of actors, subscriptions, timers, port work, gates, and browser listeners.
- Validate JSON serialization and deterministic report ordering.
- Run focused Voice Workbench and browser lanes, fas validate-task, then the full repository verification lane and retain receipts.

## Risks
- Nondeterministic ordering or wall-clock data can create false replay failures.
- A derived report may accidentally become a competing trace contract.
- Unbounded or unredacted raw actor/context data could make the artifact unsafe or nondeterministic.
- Adapter-neutral coverage may silently rely on XState-specific fields.
- Browser cleanup failures may appear only under repeated runs.

## Dependencies
- Depends directly on coverage task-1784602918285.
- Blocks dogfood and product MVP closeout task-1784602955608.

## Open questions
- Whether a later stable report contract belongs in a package remains post-MVP and requires a second consumer; this task deliberately produces an example-local schema.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
