# Prove Ignite Alchemy selected-specimen Story stepping, replay, and optional observation in a browser POC

## Source
Created with `fas create-task` on 2026-07-21.

## Problem
Build a deliberately narrow browser POC over the existing Voice Workbench / STORY-002 integration specimen and the specimen-first foundation evidence. Use the existing igniteTest component Story executor, a fresh deterministic fixture around the real Voice Workbench machine and controlled ports, exactly-once page gates, both admitted page-4 public-command branches, fresh-fixture Back replay, ordinary final Story receipts, and optional observation installed before actor start. Prove selected-specimen Story, page, branch, replay, and lens seams without project admission, a broad application shell, a public Ignite API, a second runner, a second graph algorithm, a new state authority, or a new trace. Keep POC evidence separate from production-readiness claims and record retain, rewrite, or retire dispositions.


## Acceptance criteria
- A browser-safe POC imports the existing `Voice Workbench / STORY-002` integration specimen and executes its shared Story through the existing igniteTest component story API against the real Voice Workbench machine and controlled fixture ports.
- Step releases exactly one page, Cancel disposes unresolved work, Restart creates a fresh fixture, and Back disposes, rebuilds, and deterministically replays to a prior page without snapshot mutation or event-injection shortcuts.
- The POC distinguishes transient page and observation telemetry from the ordinary final IgniteStorySnapshot receipt.
- Page 4 exposes the source-backed typed-fallback and retry-microphone public-command branches; Step pauses for reviewer choice, Run uses the declared typed-fallback default, and branch choice remains receipt/replay provenance.
- Optional XState observation is installed at actor creation and proves ordered observations, all active parallel regions, snapshot deltas, and uniquely evidenced or candidate topology edges while unknown causality fails closed; the same POC remains useful without a lens.
- The POC consumes specimen-first foundation evidence rather than an approved broad prototype and implements only enough catalog/canvas/Story-lane/Inspector shell to exercise the risky seams; project admission, visual polish, catalog completeness, coverage indexing, report generation, and production packaging remain outside scope.
- POC code and evidence have an explicit retain, rewrite, or retire disposition and no generated MagicPath React is treated as production source.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Add a temporary Vite POC entry that imports the existing `Voice Workbench / STORY-002` integration specimen, constructs one fresh real fixture per session, decorates the existing Story context with gates, and installs optional XState inspection before actor start.
- Implement only enough specimen-first Alchemy shell to exercise page-4 branch choice, Step, Cancel, Restart, Back replay, no-lens operation, active parallel nodes, snapshot deltas, candidate evidence, and the final unchanged receipt.
- Capture red/green tests and browser evidence, then classify every POC file and technique as retain, rewrite, or retire for the handoff.

## Alternatives considered
- Rejected proving the concept with a mocked machine, synthetic receipt, test-file browser import, or a second Story runner.
- Rejected project admission, a complete workbench host, all Stories/specimens, bidirectional coverage, final report, or production design polish inside the POC.
- Rejected retrofitting XState observation after actor start and rejected claiming exact edges when only candidate evidence exists.

## Affected files
- examples/agents/voice-workbench/story-workbench-poc.html
- examples/agents/voice-workbench/src/story-workbench-poc/main.tsx
- examples/agents/voice-workbench/src/story-workbench-poc/poc.ts
- examples/agents/voice-workbench/src/story-workbench-poc/poc.test.ts
- examples/agents/voice-workbench/package.json
- examples/agents/voice-workbench/vite.config.ts
- .mock-studio/ignite-story-workbench/receipts/poc/verification.md

## Scope Amendments
- None.

## Implementation plan
- Write failing tests for gate-before-page semantics, exactly-one Step, stale-session suppression, teardown-before-rebuild, ordinary final receipt, and ordered candidate observation facts.
- Add the minimal Vite POC entry and fixture/controller/lens seam around the shared timeout/retry Story and real machine.
- Exercise the approved interactions in a real browser without implementing the full product shell.
- Record verification, architectural findings, unresolved risks, and retain/rewrite/retire dispositions for the handoff.

## Verification plan
- Run focused POC tests, shared Story tests, Voice Workbench typecheck, and the Vite build.
- Validate Step, Back replay, Cancel, Restart, active parallel state, candidate-edge uncertainty, and unchanged final receipt in a real browser.
- Run `fas validate-task` and the full repository verification lane because tracked example source changes.

## Risks
- POC code can silently become production architecture unless every file has an explicit disposition.
- Paused behaviors can deadlock cancellation and late observation facts can contaminate replacement sessions.
- XState evidence may be weaker than the product design assumes; the POC must reduce claims rather than expand public APIs.

## Dependencies
- Depends directly on specimen-first foundation task-1784655399770; no broad prototype approval is assumed.
- Depends directly on shared Story and fixture task-1784602854408.
- Blocks implementation handoff task-1784655432373.

## Open questions
- Whether any POC implementation is retained is an evidence-based handoff decision; retention is not assumed by completing the POC.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
