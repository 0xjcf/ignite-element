# Build the Vite-hosted Ignite Alchemy Story Workbench application

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Build the production example-local Ignite Alchemy application from the accepted Mock Studio handoff and POC evidence. Add a deterministic-fixture-only Vite multi-page entry under Voice Workbench and implement the scientific-alchemy product identity across the Story catalog, controlled procedure page, optional reaction map, composition diff, evidence ledger, receipts, snapshots, semantic views, command availability, and session controls. Keep canonical technical labels visible, use token-driven accessible presentation, distinguish transient telemetry from the final Story receipt, dispose on page lifecycle boundaries, and never boot live microphone, MLX, provider, or normal application composition paths.


## Acceptance criteria
- A Vite multi-page entry at examples/agents/voice-workbench/story-workbench.html loads the Workbench from example-local source modules.
- The entry constructs only deterministic fixture-owned Stories and never imports or boots the live Voice Workbench main entry, MLX, microphone, speech, provider, network, or production browser-port composition.
- Package scripts name the development, rendered-jsdom test, production build, and manual real-browser validation commands without changing public package entrypoints.
- The Story list, narrative page, optional XState graph, semantic diff, evidence timeline, snapshot, view, and command-availability panels remain synchronized with the controlled Story session; the ordinary receipt panel appears only after completion or failure evidence.
- Run, Step, Back, Restart, and Cancel accurately reflect controller state and cannot issue duplicate page releases or operate on a disposed fixture.
- The graph highlights every active parallel region and animates only a uniquely evidenced edge; candidate edges and unavailable causal or guard evidence use distinct non-animated, non-color-only presentations.
- Semantic context diff is the default reviewer view while raw context and raw snapshot evidence are expandable.
- The scientific-alchemy product identity follows the approved token, typography, copy, motion, and component handoff while canonical Story, Intent, Behavior, Checkpoint, receipt, command, view, state, and coverage labels remain visible.
- The interface is keyboard-operable, exposes accessible names and intentionally bounded live status, preserves focus unless the initiating control is removed, honors reduced motion, and keeps rendered jsdom assertions, manual real-browser receipts, and headless Story evidence distinct.
- Unmount, pagehide, Story replacement, and navigation dispose the one active session and optional lens exactly once; no session persists implicitly across reloads.
- The interface remains useful without an XState lens and does not pretend Redux, MobX, Actor-Web, or other runtimes are statecharts.
- No files under packages/ignite-element and no public Ignite API are modified.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Extend the existing Vite multi-page input pattern with a dedicated deterministic Ignite Alchemy entry and isolated token-driven styles.
- Keep a pure application view model over controller, optional lens, and later coverage facts; the DOM shell only renders that model and dispatches semantic session actions.
- Implement the accepted three-pane desktop layout plus evidence ledger, the approved 1024 responsive anatomy, and explicit idle, paused, replaying, disposing, complete, failure, no-lens, candidate-evidence, and unavailable states.

## Alternatives considered
- Rejected mounting the Workbench through the live Voice Workbench entry or importing production provider and device ports.
- Rejected copying generated MagicPath React into the app; production translates the approved handoff into idiomatic Ignite JSX and local tokens.
- Rejected treating jsdom as real-browser proof, animating candidate causality, or using Alchemy metaphors as replacements for technical labels.

## Affected files
- examples/agents/voice-workbench/story-workbench.html
- examples/agents/voice-workbench/src/story-workbench/main.tsx
- examples/agents/voice-workbench/src/story-workbench/workbench.tsx
- examples/agents/voice-workbench/src/story-workbench/styles.ts
- examples/agents/voice-workbench/src/story-workbench/workbench.test.tsx
- examples/agents/voice-workbench/package.json
- examples/agents/voice-workbench/vite.config.ts
- examples/agents/voice-workbench/README.md

## Scope Amendments
- None.

## Implementation plan
- Add the Vite multi-page Story Workbench entry and documented scripts.
- Build the Story list and controlled session actions against the shared Story catalog and controller.
- Build the narrative page, assertions, transient outcome, final receipt, snapshot, semantic view, availability, timing, and context panels.
- Build the optional XState topology panel with active parallel nodes and observed-edge highlighting.
- Build the evidence ledger, exact focus and announcement policy, reduced-motion behavior, page lifecycle disposal, and useful no-lens state.

## Verification plan
- Run component tests for control state, synchronization, focus preservation, failure recovery, and no-lens behavior.
- Run rendered accessibility assertions separately from headless Story assertions.
- Run the Vite build, rendered jsdom lane, and a documented real-browser smoke pass for the new entry at approved viewports.
- Run fas validate-task and the final full verification lane.

## Risks
- UI state can drift from a paused or disposed Story session.
- Graph animation may imply causal certainty that observation does not provide.
- Frequent timeline and graph updates may create focus churn or performance problems.
- Vite host work must not leak into public package entrypoints.
- Product theming can reduce technical clarity if metaphorical copy replaces canonical evidence labels.

## Dependencies
- Depends directly on controller task-1784602868853 and XState lens task-1784602883094.
- Transitively consumes the approved MagicPath and MVP handoff through those production foundations.
- Blocks coverage task-1784602918285.

## Open questions
- The approved handoff decides the graph layout and pane-resize behavior; W5 must not select a new graph/rendering dependency without recording the rejected no-dependency option.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
