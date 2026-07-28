# Dogfood Ignite Alchemy and close or disposition Voice Workbench gaps

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Run the completed Ignite Alchemy MVP across all seven Voice Workbench executable Stories and compare observed paths, product surfaces, accessibility, deterministic replay, coverage, and derived reports with existing graph, lifecycle, invariant, headless, browser, terminal, cleanup, and projection evidence. Exercise the bounded coverage universe and race precedence cases, add narratives only for material product behavior, create dependency-aware follow-ups for product or machine defects outside Workbench-owned scope, and produce durable dogfood, browser, accessibility, and JSON receipts. Close the MVP epic without public API or package extraction and record the preview and second-adopter policy required before broader product distribution.


## Acceptance criteria
- The preparation failure and retry, permission denial and text recovery, correlated cancellation, timeout retry, stale receipt, artifact revision conflict, and speech-unavailable stories all run through the browser Workbench from fresh fixtures.
- Each Story demonstrates Run, Step, Back via replay, Restart, receipt inspection, semantic diff, snapshot, view, command availability, and bidirectional coverage navigation.
- Every item in the bounded, topology-versioned Voice Workbench coverage universe is narrative covered, directly covered by declared invariant or graph evidence, or assigned an explicit justified disposition.
- Race and precedence review covers at least timeout versus user action, cancellation versus completion, stale versus live receipts, permission failure versus text fallback, and revision conflict versus retry.
- Any newly discovered Voice Workbench product or machine defect outside Ignite Alchemy-owned files becomes a separately scoped dependency-aware follow-up task; W8 does not absorb external product fixes or expand public APIs.
- The final JSON-safe review artifact is reproducible from controlled inputs and is usable by CI and LLM reviewers without granting them runtime or coverage authority.
- Browser accessibility and reviewer usability are manually and automatically validated while DOM evidence remains separate from headless Story evidence.
- The epic closes with no changes under packages/ignite-element, no new public package, and a documented post-epic policy that a second real adopter is required before extraction is reconsidered.
- `.fas/artifacts/audits/ignite-alchemy-mvp-dogfood.md`, the final JSON report, measured browser/accessibility receipts, every exclusion, and every follow-up task ID form the durable MVP closeout evidence.
- Focused Voice Workbench lanes, fas validate-task, and the full repository verification lane pass with final receipts linked from the review summary.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Execute a fixed dogfood matrix across all seven shared Stories, the approved product states, race/precedence cases, and the topology-versioned coverage universe.
- Reconcile Story, graph, invariant, headless, rendered DOM, manual browser, accessibility, cleanup, replay, and report evidence into one durable MVP audit.
- Restrict changes to Ignite Alchemy-owned implementation, Stories, coverage evidence, dispositions, documentation, and artifacts; create queue tasks for external machine or product defects.

## Alternatives considered
- Rejected coloring every private state with artificial Stories or using an aggregate coverage percentage as the closeout gate.
- Rejected opportunistic Voice Workbench machine fixes, public API/package extraction, and promotion as generally available before a second adopter.
- Rejected treating controlled-port proof as live-provider conformance.

## Affected files
- examples/agents/voice-workbench/src/story-workbench/stories.ts
- examples/agents/voice-workbench/src/story-workbench/controller.ts
- examples/agents/voice-workbench/src/story-workbench/xstate-lens.ts
- examples/agents/voice-workbench/src/story-workbench/workbench.tsx
- examples/agents/voice-workbench/src/story-workbench/coverage.ts
- examples/agents/voice-workbench/src/story-workbench/coverage-evidence.ts
- examples/agents/voice-workbench/src/story-workbench/review-report.ts
- examples/agents/voice-workbench/src/workbench-narratives.test.ts
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/story-workbench-architecture.md
- examples/agents/voice-workbench/README.md
- .fas/artifacts/audits/ignite-alchemy-mvp-dogfood.md
- .fas/artifacts/traces/ignite-alchemy-review-report.json
- .mock-studio/ignite-story-workbench/approval.md

## Scope Amendments
- Type: cross-epic-evidence-gate
- Added at: 2026-07-28
- Trigger: evidence-governed-runtime-alignment
- Reason: Require the accepted Voice Workbench evidence-governed projection dogfood before Alchemy closes shared runtime-evidence gaps, while preserving Alchemy Story and observation ownership.
- Evidence source: Evidence-Governed Runtime Projections epic
- Evidence: Evidence-Governed Runtime Projections epic | .fas/tasks/dogfood-evidence-governed-runtime-projections-in-voice-workb.md | task-1785255004194 supplies the neutral admission, receipt, restart, replay, reconciliation, and FAS-compatible fixture evidence consumed by this downstream dogfood.
- Accuracy signal: high: live queue dependency and accepted cross-repo ownership contract
- Follow-up needed: Keep Alchemy example-local and do not add another runtime, graph, recorder, or receipt authority.

## Implementation plan
- Run all seven shared Voice Workbench Stories through the browser Workbench from fresh fixtures.
- Compare observed paths and coverage with direct graph, invariant, headless, terminal, browser, replay, cleanup, and accessibility evidence.
- Review race and precedence cases and add Stories only for material command, authority, guard, fact, lifecycle, recovery, race, or visible-surface branches.
- Create dependency-aware follow-ups for Voice Workbench product or machine defects outside Ignite Alchemy ownership; otherwise record explicit coverage dispositions.
- Capture final browser, headless, coverage, cleanup, and JSON review receipts and close the epic without public API or package extraction.

## Verification plan
- Exercise Run, Step, Back, Restart, receipts, diffs, snapshots, views, availability, topology, and bidirectional coverage for every shared Story.
- Validate timeout versus action, cancellation versus completion, stale versus live receipt, permission versus text fallback, and revision conflict versus retry precedence.
- Run focused Voice Workbench tests, typecheck, Vite build, browser accessibility smoke, fas validate-task, and the final full repository verification lane.
- Link final receipts and every uncovered or excluded disposition from the review summary.

## Risks
- Dogfood may expose real product gaps that require new prerequisite tasks and epic resequencing.
- Pressure for complete graph coloring may produce artificial narratives instead of justified invariant or private-system dispositions.
- Live provider validation must not be confused with deterministic controlled-port conformance.
- Packaging pressure must remain outside this epic until a second real adopter exists.
- Product promotion could overstate adapter support or determinism unless the final audit preserves MVP, controlled-envelope, and XState-lens maturity labels.

## Dependencies
- Depends directly on determinism and report task-1784602939863.
- Terminal implementation and product MVP validation task for epic-ignite-story-workbench.
- Second-adopter, public preview distribution, and package evaluation remain post-epic decisions.

## Open questions
- The final audit recommends the most credible second adopter and preview distribution form, but does not create a package or claim general availability.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
