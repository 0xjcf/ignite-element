# Complete the dynamic MLX tool-feedback loop and retain artifact revision history in the voice workbench

## Source
Created with `fas create-task` on 2026-07-13.

## Problem
The workbench already proves a bounded MLX tool-feedback loop, immutable artifact revisions, and direct checklist interaction, but it is not yet a complete ecosystem proof. Finish the example by exposing checklist mutation to the model, supporting multiple selectable artifacts and mixed semantic nodes, adding an actual Node terminal consumer and a visible igniteTest proof lane, covering every supported semantic-node browser projection, and adding audit-preserving revision history and restore UX. Keep one idiomatic igniteCore component, pure functional state and view derivation, and projection-specific adapters without introducing Actor-Web or generic wrapper APIs.


## Acceptance criteria
- setChecklistItem is included only when authorized in the fresh igniteTools model manifest and an MLX turn can mutate an existing checklist before completing
- The actor stores multiple artifacts, exposes actor-authorized artifact selection, and the workspace renders mixed nodes in a responsive multi-node layout without replacing unrelated artifacts
- A Node terminal entrypoint consumes the same igniteCore component headlessly and prints actor-approved output without DOM APIs
- A visible headless proof script runs the igniteTest scenario lane and produces an inspectable trace
- Browser tests exercise text, checklist, action, form, table, timeline, chart, code-diff, and decision-log projections, including checklist interaction
- The UI exposes immutable per-artifact revision history and restore appends a new forward revision with conflict protection rather than mutating history
- Text and speech prompts use the same model-command path and current actor state remains the authority for every mutation
- The one-command MLX and browser launcher still works and documentation explains the browser, terminal, speech, and headless proof surfaces
- The work is tracked in .fas/TASKS.md with current planning and verification evidence
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- examples/agents/voice-workbench/src/domain.ts
- examples/agents/voice-workbench/src/domain.test.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/agent-loop.test.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/package.json
- examples/agents/voice-workbench/src/terminal.ts
- examples/agents/voice-workbench/src/terminal.test.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/headless-proof.ts
- examples/agents/voice-workbench/src/parity.tsx

## Scope Amendments
- Type: implementation-expansion
- Added at: 2026-07-13
- Trigger: Live checklist prompt exposed missing model tool-feedback and revision-history contracts
- Reason: The readiness UI is complete, but the example cannot prove dynamic IgniteTools projection until the model observes actor outcomes and can revise accepted state; retained snapshots are the minimal prerequisite for future undo and redo.
- Added paths: examples/agents/voice-workbench/src/domain.ts, examples/agents/voice-workbench/src/domain.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/agent-loop.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/README.md
- Evidence source: live-browser-and-headless-reproduction
- Evidence: live-browser-and-headless-reproduction | examples/agents/voice-workbench/src/main.tsx | A schema-valid checklist proposal was rejected by domain validation, while a live model prompt produced an accepted text node instead of the requested checklist.
- Accuracy signal: confirmed
- Follow-up needed: Design explicit undo and redo commands only after retained history is dogfooded.

- Type: acceptance-feedback
- Added at: 2026-07-14
- Trigger: Operator requested readable multiline matches object formatting during live example acceptance
- Reason: The actor-state proof must remain legible when its compound matches object wraps
- Added paths: examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/styles.ts, examples/agents/voice-workbench/src/workbench.test.tsx
- Evidence source: operator acceptance feedback
- Evidence: operator acceptance feedback
- Accuracy signal: Observed inline wrapping produced invalid-looking formatting in the live UI
- Follow-up needed: Keep the broader multi-node workspace as a separate planned capability

- Type: acceptance-feedback
- Added at: 2026-07-14
- Trigger: Operator approved making generated checklist nodes interactive through the existing component
- Reason: The workbench should prove that semantic nodes remain actor-authorized after projection, using a typed setChecklistItem command rather than a new actor or projection wrapper
- Evidence source: operator architecture review
- Evidence: operator architecture review
- Accuracy signal: Current ProjectionChecklistNode renders disabled controls and has no mutation path
- Follow-up needed: Evaluate reusable interactive-node command bindings only after workbench dogfood

- Type: acceptance-feedback
- Added at: 2026-07-14
- Trigger: Operator requested completing the six remaining workbench gaps before moving to a studio product
- Reason: The example must prove model, actor, browser, speech, terminal, and headless consumers as one coherent Ignite component contract
- Added paths: examples/agents/voice-workbench/package.json, examples/agents/voice-workbench/src/terminal.ts, examples/agents/voice-workbench/src/terminal.test.ts, examples/agents/voice-workbench/src/domain.ts, examples/agents/voice-workbench/src/domain.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/agent-loop.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/src/styles.ts, examples/agents/voice-workbench/README.md
- Evidence source: operator architecture review and live workbench acceptance
- Evidence: operator architecture review and live workbench acceptance | examples/agents/voice-workbench | Remaining gaps are model checklist parity, multi-artifact layout, real terminal consumer, visible igniteTest proof, full node projection coverage, and revision restore UX
- Accuracy signal: confirmed
- Follow-up needed: Evaluate cross-process Actor-Web transport and reusable semantic-node interaction bindings after this Ignite-only proof

- Type: implementation-expansion
- Added at: 2026-07-14
- Trigger: Terminal and visible headless proof require shared application orchestration and executable entrypoints
- Reason: Share the real MLX round coordinator without injecting or wrapping the igniteCore component, and keep the trace proof DOM-free
- Added paths: examples/agents/voice-workbench/src/workbench-agent.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts, examples/agents/voice-workbench/src/headless-proof.ts
- Evidence source: implementation design review
- Evidence: implementation design review | examples/agents/voice-workbench/src/main.tsx | The existing model loop is browser-local and the browser console is not a terminal consumer
- Accuracy signal: confirmed
- Follow-up needed: Cross-process shared sessions remain out of scope

- Type: dependency-discovery
- Added at: 2026-07-14
- Trigger: Removing the simulated commitTerminal browser command exposed the parity harness as a direct caller.
- Reason: The parity harness must stop seeding a fake terminal receipt when the terminal becomes a real independent Node projection.
- Added paths: examples/agents/voice-workbench/src/parity.tsx
- Evidence source: source-search
- Evidence: source-search | examples/agents/voice-workbench/src/parity.tsx | seedArtifact executes commitTerminal
- Accuracy signal: rg located the only remaining consumer outside the original envelope
- Follow-up needed: Remove the obsolete parity command call and verify parity tests.

## Implementation plan
- Add failing contract tests for model-authorized checklist mutation and responding-state execution
- Add actor-owned artifact selection plus derived workspace summaries and implement a responsive multi-artifact and multi-node projection
- Add an audit-preserving restore command and revision-history projection
- Add a DOM-free Node terminal entrypoint that imports the same component and a visible igniteTest proof script
- Complete the browser projection matrix for all supported semantic node kinds and refine model guidance for mixed-node artifacts
- Polish responsive styling and documentation, then verify live MLX text and speech paths

## Verification plan
- Run focused domain, session, agent-loop, model, workbench, main, parity, projection, and terminal tests after each slice
- Run the example typecheck, test, build, terminal proof, and headless proof scripts
- Run fas validate-task and fas verify --full
- Launch the one-command example and verify text creates a mixed-node artifact, speech revises it, checklist interaction commits a revision, artifact switching works, and restore appends a new revision

## Risks
- A small local model may require concise schema guidance to choose mixed semantic nodes and checklist commands reliably
- A terminal process cannot share a browser in-memory actor without a transport boundary, so this example proves the same component contract in an independent headless session
- Revision restore must remain append-only and conflict-aware so history is never rewritten
- Nine node projections can overcrowd the workspace unless layout and responsive behavior remain data-driven

## Dependencies
- None known at task creation.

## Open questions
- Cross-process shared actor sessions remain future Actor-Web integration work and are intentionally out of scope
- Reusable generic interaction bindings for arbitrary semantic nodes remain follow-up work after this example proves the concrete command pattern

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
