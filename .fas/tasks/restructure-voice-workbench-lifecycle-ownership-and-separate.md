# Restructure voice-workbench lifecycle ownership and separate presentation state

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Replace the provider/turn parallel cross-product with the approved compound machine: Preparing and Unavailable are top-level lifecycle states, while Idle and Responding exist only inside Available. Preserve the pure conversation reducer as aggregate authority. Move draft, mobile-panel, artifact-view, runtime-preview, speech-preference and read-model receipt recording out of the authoritative session lifecycle graph through the smallest compatible presentation boundary. Keep this slice behavior-compatible apart from eliminating forbidden raw snapshots; the next task owns full async terminal/cancellation/timeout protocols.

## Acceptance criteria
- The executable XState shape matches the approved compound session diagram and the raw snapshot cannot represent preparing/responding or unavailable/responding.
- A MODEL_FAILED event from Available.Responding exits the Available compound state, prevents subsequent artifact/complete commands from being admitted, and records an explicit non-success outcome without fabricating response completion.
- The graph invariant suite from task-1784171355639 removes the temporary known-violation baseline and asserts zero forbidden reachable combinations.
- Conversation/artifact data continues to change only through reduceConversationSession or an equivalently pure reducer with optimistic revision and validation behavior preserved.
- Presentation-only selections and read-model receipts no longer dominate the authoritative lifecycle graph or compete with the session machine as lifecycle truth; the chosen ownership boundary is documented and tested.
- Raw machine snapshots remain available independently from prepared Ignite views, and view status cannot mask a forbidden raw state.
- The projection command schema distinguishes user/model intent from private adapter and read-model channels without adding getBlueprint(), public inspect(), or another public schema.
- Existing headless, browser, model-loop, domain, and example fast tests pass with focused new regression coverage.
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
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/terminal.test.ts
- examples/agents/voice-workbench/src/terminal.ts

## Reference files

- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: architecture-consumer-alignment
- Added at: 2026-07-16
- Trigger: Architect inspection found stale executable-topology consumers outside the generated six-file hint.
- Reason: The workbench test asserts the obsolete parallel matchText and README explicitly describes the parallel provider/turn cross-product and two forbidden states; both must change with the authoritative machine.
- Added paths: examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/README.md
- Evidence source: live source inspection
- Evidence: live source inspection | examples/agents/voice-workbench/README.md | README lines 137-176 and 284-325 plus workbench.test.tsx lines 251-252 encode the outgoing parallel topology.
- Accuracy signal: Direct textual and test assertions would become false or fail after compound topology implementation.
- Follow-up needed: Keep changes limited to compound topology, channel metadata, and matching assertions; task-1784171467799 still owns terminal child lifecycles.

- Type: verification-consumer-alignment
- Added at: 2026-07-16
- Trigger: The complete 27-file voice-workbench suite found one stale raw-state expectation after the compound topology rename.
- Reason: terminal.test.ts directly asserts turn ready; the authoritative compound state and projection now use idle. Production must not be reverted to satisfy the obsolete assertion.
- Added paths: examples/agents/voice-workbench/src/terminal.test.ts
- Evidence source: complete voice-workbench test run
- Evidence: complete voice-workbench test run | examples/agents/voice-workbench/src/terminal.test.ts | Line 37 expects turn ready; all other focused compound lifecycle tests pass.
- Accuracy signal: One isolated full-suite failure directly names the outgoing lifecycle label.
- Follow-up needed: Update only the expected raw turn label to idle and rerun the complete suite.

- Type: verification-scope-narrowing
- Added at: 2026-07-16
- Trigger: The complete voice-workbench suite and typecheck passed without production changes in main.tsx or workbench.tsx.
- Reason: The private presentation envelope is fully owned by session.ts and the existing coordination/render consumers already use the compatible command and view contracts.
- Removed paths: examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/workbench.tsx
- Evidence source: implementation diff and complete voice-workbench verification
- Evidence: git diff plus 27 files / 206 passing tests show both predicted production consumers remain unchanged and compatible.
- Accuracy signal: Neither file differs from the task base, while their focused browser and workbench tests pass against the compound machine.
- Follow-up needed: None; re-add only if a later task changes the adapter or render contract.

- Type: pre-existing-reference-classification
- Added at: 2026-07-16
- Trigger: ChangeSet deliberately surfaced five ignored curated-memory projections during closeout.
- Reason: These project-local operational projections predate the active task, supplied planner context, and remain intentionally unedited; they are reference evidence rather than implementation output.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: file timestamps, git ignore policy, and ChangeSet classification
- Evidence: All five files were generated at 2026-07-16 12:26:17 before this task started, are ignored by the FAS managed block, and have no implementation diff or commit.
- Accuracy signal: Git status reports none of the files as changed, while FAS classifies curated memory projections specially as reference-scope documentation.
- Follow-up needed: Do not stage, delete, or rewrite these operational projections for this task.

- Type: qa-compatibility-repair
- Added at: 2026-07-16
- Trigger: Read-only QA found the terminal formatter still fabricating the removed parallel provider/turn snapshot and found checklist UI behavior regressed.
- Reason: terminal.ts must consume the existing snapshot-derived compound matchText; session/workbench tests must preserve the prior idle checklist control while retaining responding model authorization.
- Added paths: examples/agents/voice-workbench/src/terminal.ts
- Evidence source: fas_qa committed-range review
- Evidence: fas_qa committed-range review | examples/agents/voice-workbench/src/terminal.ts | terminal.ts lines 20-23 print provider/turn; session.ts hard-codes canSetChecklistItem false; base workbench test proves post-response checklist editing.
- Accuracy signal: Both issues are deterministic compatibility regressions covered by direct assertions and require no task-4 lifecycle work.
- Follow-up needed: Restore tests first, record a new TDD-red receipt, apply only these repairs, and rerun QA before SRE.

## Implementation plan
- Add failing graph, headless, and browser regressions for the compound raw state shape, zero forbidden states, model failure from responding, structural command rejection, and presentation-channel compatibility.
- Replace the parallel provider and turn regions in session.ts with top-level preparing and unavailable states plus available.idle and available.responding; record model failure as an explicit non-success fact without response completion and keep conversation mutations behind the pure reducer.
- Separate lifecycle events from presentation and read-model channels through private typed reducer slices while preserving the composed view.presentation contract and raw actor snapshots.
- Preserve the existing main.tsx and workbench.tsx coordination/render contracts; route the private adapter and read-model channels entirely through the compatible session.ts command surface without adding a public Ignite API.
- Run focused voice-workbench tests, fas validate-task, delegated QA, SRE, and review, then one final full verification.

## Verification plan
- Record a fas tdd-red receipt from the new failing lifecycle regressions before production edits.
- Run the focused session.graph.test.ts, session.headless.test.ts, and main.test.tsx suites after each implementation step.
- Run the complete voice-workbench example suite and typecheck before delegated review.
- Run fas validate-task for the inner-loop gate and one .fas/scripts/verify.sh --full after reviewer clearance.

## Risks
- Changing the raw XState value can silently break snapshot.matches consumers; update every in-scope consumer and lock exact graph vertices and edges.
- A presentation split can duplicate authority or suppress render notifications; retain one private reducer boundary and prove composed projection compatibility.
- MODEL_FAILED during responding must block later artifact and completion commands while preserving an explicit failure fact and never fabricating response-completed.
- Do not absorb cancellation and timeout protocols owned by task-1784171467799 or add public Ignite inspection APIs.

## Dependencies
- Epic: `epic-voice-workbench-statechart-conformance` (`lifecycle-ownership`).
- Depends on: `task-1784171355639`.
- Blocks: `task-1784171467799`.

## Open questions
- Non-blocking: preserve MODEL_PREPARATION_STARTED as the executable retry event while documenting it as the existing equivalent of conceptual RETRY.
- Non-blocking: keep the current view.presentation shape for compatibility while making its event channel explicitly non-lifecycle and private.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
