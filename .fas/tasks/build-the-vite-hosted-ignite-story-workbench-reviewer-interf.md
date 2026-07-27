# Build the Vite-hosted Ignite Alchemy repo-scoped specimen workbench

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Build an example-local, repo-scoped Ignite Alchemy dev/test specimen workbench from the accepted specimen-first Mock Studio foundation and POC evidence. The primary UI is repository specimen catalog, selected specimen canvas, Story/page/public-command branch lane, and docked Inspector. Default review units are bounded component or feature projection specimens; full-page or composed Voice Workbench views appear only as explicitly labeled integration specimens. Use one fresh deterministic fixture per session, keep Story receipts and real actor or machine truth authoritative, support optional lenses and exact no-lens behavior, preserve production exclusion, and add no public Ignite API or production application surface.


## Acceptance criteria
- A Vite multi-page entry at examples/agents/voice-workbench/story-workbench.html loads the Workbench from example-local source modules.
- The entry constructs only deterministic fixture-owned Stories and never imports or boots the live Voice Workbench main entry, MLX, microphone, speech, provider, network, or production browser-port composition.
- Package scripts name the development, rendered-jsdom test, production build, and manual real-browser validation commands without changing public package entrypoints.
- The primary composition is repository-scoped specimen catalog/sidebar, selected specimen canvas, Story/page/public-command branch lane, and docked Inspector; it contains no P0 project-admission or full-screen builder workflow.
- Catalog entries visibly distinguish bounded component and feature projection specimens from explicitly labeled integration specimens. `Voice Workbench / STORY-002` is an integration specimen and does not imply a smaller implemented component.
- The specimen catalog, selected Story page, optional XState graph, semantic diff, evidence timeline, snapshot, view, and command-availability panels remain synchronized with the controlled Story session; the ordinary receipt panel appears only after completion or failure evidence.
- Run, Step, Back, Restart, and Cancel accurately reflect controller state and cannot issue duplicate page releases or operate on a disposed fixture.
- The graph highlights every active parallel region and animates only a uniquely evidenced edge; candidate edges and unavailable causal or guard evidence use distinct non-animated, non-color-only presentations.
- Semantic context diff is the default reviewer view while raw context and raw snapshot evidence are expandable.
- The scientific-alchemy product identity follows the accepted specimen-first foundation and any later human-approved visual handoff while canonical specimen, Story, Intent, Behavior, Checkpoint, receipt, command, view, state, and coverage labels remain visible.
- The interface is keyboard-operable, exposes accessible names and intentionally bounded live status, preserves focus unless the initiating control is removed, honors reduced motion, and keeps rendered jsdom assertions, manual real-browser receipts, and headless Story evidence distinct.
- Unmount, pagehide, Story replacement, and navigation dispose the one active session and optional lens exactly once; no session persists implicitly across reloads.
- The interface remains useful without an XState lens and does not pretend Redux, MobX, Actor-Web, or other runtimes are statecharts.
- A specimen does not require a machine; one shared app-owned actor may project into multiple specimens without duplicate ownership or a machine-per-visual-atom rule.
- The host is a dev/test-only reviewer around deterministic fixtures, not a production application, application generator, project-admission surface, or full-screen builder.
- No files under packages/ignite-element and no public Ignite API are modified.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Extend the existing Vite multi-page input pattern with a dedicated deterministic Ignite Alchemy entry and isolated token-driven styles.
- Keep a pure selected-specimen workbench view model over catalog selection metadata, controller, optional lens, and later coverage facts; the DOM shell only renders that model and dispatches semantic session actions.
- Implement a catalog plus specimen canvas and Story lane plus docked Inspector composition, evidence ledger, responsive anatomy, and explicit idle, paused, branch-boundary, replaying, disposing, complete, failure, no-lens, candidate-evidence, and unavailable states.

## Alternatives considered
- Rejected mounting the Workbench through the live Voice Workbench entry or importing production provider and device ports.
- Rejected copying generated MagicPath React into the host; revision 9 is historical donor-only and implementation translates a later approved specimen-first handoff into idiomatic Ignite JSX and local tokens.
- Rejected a Project Explorer admission controller, production application, or whole-application/full-screen builder as the default host experience.
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
- Build the repo-scoped specimen catalog, classification cues, selected-specimen canvas, and controlled session actions against existing Story definitions and the controller.
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
- Consumes the accepted specimen-first foundation and later approved visual/implementation handoff through those production foundations; revision 9 remains historical donor-only evidence.
- Blocks coverage task-1784602918285.

## Open questions
- A later human-approved specimen-first handoff decides graph layout and pane-resize behavior; the host must not select a new graph/rendering dependency without recording the rejected no-dependency option.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
