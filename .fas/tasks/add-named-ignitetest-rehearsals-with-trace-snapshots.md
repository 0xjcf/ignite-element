# Define and implement multi-step igniteTest narratives over existing Story evidence

## Source
Created with `fas create-task` on 2026-07-11.

## Problem
Replace the queued one-command rehearsal proposal with a typed multi-step narrative helper over the existing igniteTest scenario and Story evidence APIs. A narrative is the expected falsifiable experience; component.record produces the observed Story and snapshotStory produces its portable receipt. The helper must support assertion-only preconditions, multiple typed intent commands, consumer-driven external facts between intents, and named semantic checkpoints without creating a second recorder, state authority, graph engine, or trace schema. The first slice should return the existing IgniteStorySnapshot and use dogfood to decide whether a later receipt envelope is justified.


## Acceptance criteria
- igniteTest exposes a named callback-based narrative helper that supports multiple ordered steps while preserving existing igniteTest behavior for consumers that do not use narratives.
- Narrative names and typed command calls preserve literal inference; required, optional, and absent command inputs remain correctly discriminated.
- given assertions never inject, rehydrate, rewind, or reset source state, and repeatable execution requires a consumer-supplied fresh isolated runtime.
- intent steps delegate to the existing Story execute path and remain distinct from emitted events and externally driven adapter or host facts.
- The narrative callback may drive consumer-owned fixtures between intents without Ignite reclassifying those facts as commands or taking environment ownership.
- Named checkpoints assert current snapshot, view, emitted-event, and canExecute evidence using existing expectations and focused public reads.
- A successful narrative returns the existing serializable IgniteStorySnapshot; no parallel trace representation or public coherent inspection API is added.
- Failures identify the narrative name, checkpoint or phase, expected and received values, and the serialized Story trace accumulated before cleanup.
- Story recording and all narrative-owned observers are stopped in a finally path on success or failure without changing shared-source ownership.
- Focused runtime, type-level, diagnostics, cleanup, documentation, and entrypoint tests pass without requiring DOM.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Compose existing scenario assertions and Story evidence behind a named callback-based narrative:

  ```ts
  const receipt = await igniteTest(component).narrative(
    "permission denial preserves text recovery",
    async (narrative) => {
      narrative.given({
        view: { voice: { status: "idle" } },
        canExecute: { startVoiceCapture: true },
      });

      await narrative.intent({ command: "startVoiceCapture" });
      await voiceDriver.denyCurrentPermissionRequest();

      narrative.checkpoint("text recovery remains available", {
        view: { voice: { status: "permission-denied" } },
        canExecute: { submitPrompt: true },
      });

      await narrative.intent({
        command: "submitPrompt",
        input: { modality: "text", text: "Continue using text" },
      });
    },
  );
  ```

- Treat the example as directional rather than a locked signature; planning must preserve typed intent calls and reuse existing expectation types with the smallest coherent callback context.
- Implement narrative execution over assertion-only preconditions, `component.record(name)`, Story execution, focused reads, existing expectations, `snapshotStory`, and `story.stop()` in `finally`.
- Let consumer fixtures drive environment facts directly between intents; Ignite records and asserts resulting behavior without owning those facts.
- Return `IgniteStorySnapshot` directly in the first slice so consumers receive the existing trace, lifecycle, and summary format.

## Alternatives considered

- Renaming `record()` or `snapshotStory()` before dogfood: rejected because a downstream verdict task owns evidence-backed Story vocabulary changes.
- A new narrative trace type: rejected because `IgniteStorySnapshot` already supplies a serializable trace and final summary.
- A declarative one-command rehearsal registry: rejected because meaningful failure and recovery narratives interleave multiple intents with consumer-owned environment facts.
- State injection or automatic reset: rejected because it would create hidden state authority and unsafe behavior for shared sources.
- Treating host receipts or machine events as Ignite commands: rejected because commands are intents while adapters and actors own external facts and transition authority.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/site/src/content/docs/api/testing-dsl.mdx
- .changeset/executable-narratives.md
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-07-17
- Added paths: packages/ignite-element/src/testing.ts, packages/ignite-element/src/types/agent.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts, docs/site/src/content/docs/api/testing-dsl.mdx

- Type: public-api-release-metadata
- Added at: 2026-07-17
- Trigger: exported-ignite-test-scenario-method
- Reason: Adding narrative() to the exported IgniteTestScenario contract is a public additive beta API and repository precedent requires a package changeset.
- Added paths: .changeset/executable-narratives.md
- Evidence source: repository changeset precedent
- Evidence: repository changeset precedent | .changeset/object-command-call-envelope.md | Existing igniteTest and Story public contract changes carry ignite-element changesets.
- Accuracy signal: packages/ignite-element/package.json is 3.0.0-beta.8 and the new method is visible through the existing testing entrypoint.

- Type: implementation-scope-narrowing
- Added at: 2026-07-17
- Trigger: existing-story-types-proved-sufficient
- Removed paths: packages/ignite-element/src/types/agent.ts
- Reason: Implementation composes IgniteCommandCall, IgniteStory, and IgniteStorySnapshot from testing.ts without changing the lower-level public agent contract, so packages/ignite-element/src/types/agent.ts remains reference-only.
- Evidence source: committed implementation
- Evidence: 44624ec7 | packages/ignite-element/src/testing.ts | Existing public Story and command types support the narrative helper without a lower-level type edit.
- Accuracy signal: focused runtime and type tests plus the package typecheck pass on the committed implementation.

- Type: closeout-bookkeeping
- Added at: 2026-07-17
- Trigger: ignored-memory-projection-change-set-classification
- Reason: FAS memory projection files are ignored closeout bookkeeping already present in the worktree; classifying them prevents the live ChangeSet from treating them as product implementation.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: closeout-readiness
- Evidence: closeout-readiness | .fas/state/closeout-readiness/latest.json | Five ignored .fas/memory projections were the only unexpected paths; product implementation remains limited to testing.ts, tests, docs, and changeset.
- Accuracy signal: git status excludes the ignored projections while live ChangeSet discovery reports them as untracked bookkeeping.

## Implementation plan
- Write failing runtime and type tests for multi-step narrative execution, typed intents, assertion-only preconditions, consumer-driven external facts, named checkpoints, returned Story snapshots, diagnostics, and cleanup.
- Define the smallest callback-based narrative context by composing existing scenario assertions, component.record, story.execute, snapshotStory, canExecute, and focused getters.
- Implement narrative orchestration with deterministic cleanup and no state injection, second recorder, or hidden runtime reset.
- Document narrative versus Story versus receipt vocabulary and include one framework-neutral recovery example before Voice Workbench dogfood.

## Verification plan
- Run focused testing runtime and type suites for the narrative helper.
- Run entrypoint and documentation checks for any exported testing types.
- Run fas validate-task and the fast verification lane during implementation.
- Run full verification and committed review before closeout.

## Risks
- Avoid turning externally driven facts into Ignite commands or hiding environment ownership inside the helper.
- Avoid adding a second trace or atomic inspection promise alongside IgniteStorySnapshot.
- Avoid silent source reset, leaked Story observers, or widened command input inference.
- Keep the first public slice small enough for Voice Workbench dogfood to challenge before further API growth.

## Dependencies
- Depends on task-1784298607166 so the active Voice Workbench behavior handoff remains the approved narrative vocabulary input.
- Blocks Voice Workbench executable-narrative dogfood and remains an upstream dependency of the optional XState graph-bridge evaluation.

## Open questions
- Whether Voice Workbench dogfood justifies a later IgniteNarrativeReceipt envelope around IgniteStorySnapshot; the first slice returns the existing Story snapshot.
- Whether record and snapshotStory remain the final low-level names; a downstream beta naming-verdict task owns that decision.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
