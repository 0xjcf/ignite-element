# Refactor Voice Workbench to a parent-supervised hexagonal actor topology

## Source
Created with `fas create-task` on 2026-07-16.

## Problem
Replace the transitional sidecar orchestration with one parent-supervised actor system. The compound Voice Workbench session machine must own and dispose model-turn, voice-capture, and speech-delivery child actor instances according to lifecycle state. Separate host-, environment-, and framework-dependent adapters from host-agnostic machines, policies, domain functions, port contracts, and projectors. Machine commands express the smallest caller intent and carry only genuinely external data; machines allocate correlation, attempt, sequence, and revision values. Ignite Element remains projection-only: derived values live in pure view projectors, renderer functions return template or JSX without workflow logic, and web components are split around coherent source and view boundaries without creating duplicate actors. Model, capability, browser, speech, microphone, clock, and persistence work cross typed ports and return correlated receipts or facts. The LLM remains a probabilistic edge adapter that proposes; deterministic actors, guards, policies, and reducers decide. Preserve current behavior, exact public command schema unless an explicitly reviewed compatibility amendment is required, browser/terminal/headless parity, fresh actor construction, serializable machine state, and example-local scope.

## Acceptance criteria
- The compound session actor invokes or supervises exactly one instance of every active model-turn, voice-capture, and speech-delivery child lifecycle; leaving the owning state disposes the child and no host module stores a competing workflow actor handle.
- Host-agnostic machine, domain, policy, port, and projector modules do not import browser globals, MLX transport, Ignite component singletons, renderer APIs, clocks, AbortController, or concrete capability providers.
- Concrete browser, terminal, MLX, capability, speech, microphone, clock, and persistence adapters are wired only in composition-root or host-effect modules and return typed correlated facts instead of mutating machine context directly.
- Public commands express minimal user or model intent; payloads contain caller-supplied facts only, while correlation identifiers, attempts, sequences, revisions, effect requests, and lifecycle decisions are allocated by authoritative actors.
- Pure view projectors own all derived presentation values and canExecute-style selectors; renderer functions only map prepared views to template or JSX and contain no raw snapshot branching or workflow derivation.
- Projected web components are split by coherent source and view ownership and bind to parent-owned child actors or parent projections; they never instantiate duplicate child machines.
- The LLM and external capabilities remain edge adapters whose proposals pass through deterministic schema admission, domain policy, actor guards, command authorization, and correlated execution receipts.
- Graph, actor, adapter, view, browser, terminal, and headless tests prove parent supervision, disposal, stale receipt rejection, cancellation, timeout, retry, projection parity, renderer purity, fresh isolation, and zero duplicate lifecycle authority.
- No shared Ignite routing, actor, graph, or inspection API is added unless this dogfood task demonstrates a concrete repeated gap and a separate reviewed amendment authorizes it.
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
- examples/agents/voice-workbench/src/model-turn.ts
- examples/agents/voice-workbench/src/voice.ts
- examples/agents/voice-workbench/src/speech.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/terminal.ts
- examples/agents/voice-workbench/src/parity.tsx
- examples/agents/voice-workbench/src/headless-proof.ts
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/model-turn.test.ts
- examples/agents/voice-workbench/src/voice.test.ts
- examples/agents/voice-workbench/src/speech.test.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/terminal.test.ts
- examples/agents/voice-workbench/src/parity.test.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/ports.ts
- examples/agents/voice-workbench/src/workbench-policy.ts
- examples/agents/voice-workbench/src/workbench-view.ts
- examples/agents/voice-workbench/src/workbench-component.ts
- examples/agents/voice-workbench/src/workbench-runtime.ts
- examples/agents/voice-workbench/src/adapters/browser-voice.ts
- examples/agents/voice-workbench/src/adapters/browser-speech.ts
- examples/agents/voice-workbench/src/views/conversation.tsx
- examples/agents/voice-workbench/src/views/artifact.tsx
- examples/agents/voice-workbench/src/views/runtime.tsx
- examples/agents/voice-workbench/src/workbench-runtime.test.ts
- examples/agents/voice-workbench/src/workbench-view.test.ts
- examples/agents/voice-workbench/src/adapters/mlx-model-turn.ts
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: architecture-discovery
- Added at: 2026-07-17
- Trigger: Delegated architect live-source review
- Reason: The accepted hexagonal split requires named example-local port, policy, projector, runtime, adapter, view, and focused test modules that were absent from the generated existing-file envelope.
- Added paths: examples/agents/voice-workbench/src/ports.ts, examples/agents/voice-workbench/src/workbench-policy.ts, examples/agents/voice-workbench/src/workbench-view.ts, examples/agents/voice-workbench/src/workbench-component.ts, examples/agents/voice-workbench/src/workbench-runtime.ts, examples/agents/voice-workbench/src/adapters/browser-voice.ts, examples/agents/voice-workbench/src/adapters/browser-speech.ts, examples/agents/voice-workbench/src/views/conversation.tsx, examples/agents/voice-workbench/src/views/artifact.tsx, examples/agents/voice-workbench/src/views/runtime.tsx, examples/agents/voice-workbench/src/workbench-runtime.test.ts, examples/agents/voice-workbench/src/workbench-view.test.ts
- Evidence source: fas_architect handoff
- Evidence: fas_architect handoff | .fas/state/agent-orchestration-execution.json | Parent supervision and adapter injection were resolved; shared Ignite packages and changesets remain advisory and out of implementation scope.
- Accuracy signal: Architect cited current session, workbench-agent, main, voice, task-packet, and commit-plan lines.
- Follow-up needed: Regenerate task packet and commit plan before fas_staff_engineer and the sole code writer.

- Type: implementation-discovery
- Added at: 2026-07-17
- Trigger: Sole-writer composition-root cutover
- Reason: The accepted model/capability port needs a named concrete edge adapter so the probabilistic MLX integration does not remain under the legacy workbench-agent sidecar filename.
- Added paths: examples/agents/voice-workbench/src/adapters/mlx-model-turn.ts
- Evidence source: fas_senior_engineer confusion checkpoint
- Evidence: fas_senior_engineer confusion checkpoint | examples/agents/voice-workbench/src/workbench-agent.ts | Add adapters/mlx-model-turn.ts; reduce workbench-agent.ts to pure compatibility exports and remove lifecycle ownership.
- Accuracy signal: Live diff showed the non-owning port adapter temporarily co-located with the legacy runner.
- Follow-up needed: Refresh the 34-path task packet and preserve the three-step plan.

- Type: reference-only
- Added at: 2026-07-17
- Trigger: FAS closeout ChangeSet scan
- Reason: Five pre-existing git-ignored FAS memory projections are included by the live ChangeSet scanner; this task neither edits nor commits them.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: git status --short --ignored .fas/memory
- Evidence: git status --short --ignored .fas/memory | .fas/memory | The tracked implementation remains example-local; these files stay ignored and unstaged.
- Accuracy signal: scanner-only reference projections; git-ignored
- Follow-up needed: Keep these projections uncommitted and exclude them from implementation review.

- Type: closeout-plan-reconciliation
- Added at: 2026-07-17
- Trigger: Final ChangeSet alignment after QA, SRE, reviewer, and fresh full verification
- Reason: The initial plan named two focused test files as likely edit sites, but existing coverage in those files remained valid and the behavior changes were fully covered by the updated graph, headless, adapter, runtime, view, composition-root, and compatibility suites. Mechanical edits would add no evidence.
- Removed planned paths: examples/agents/voice-workbench/src/model-turn.test.ts, examples/agents/voice-workbench/src/speech.test.ts
- Evidence source: final independent reviewer and current full verification receipt
- Evidence: .fas/state/agent-orchestration-execution.json, .fas/state/verification/latest-full.json
- Accuracy signal: QA passed 12 files and 90 tests; SRE passed 31 files and 256 tests; the current full repository verification is head-bound to c3bb71d0 and passes every lane.
- Follow-up needed: Keep the unchanged focused suites as regression coverage; do not manufacture no-op diffs.

## Implementation plan
- Add red supervision and correlation tests, typed port contracts, pure policy extraction, and the compound parallel parent topology.
- Add the injected host runtime and concrete browser adapters; migrate browser and terminal composition roots and remove host-owned lifecycle actor handles.
- Split pure view projection, Ignite component composition, and coherent panel renderers around the single parent actor source; migrate parity and headless surfaces.
- Remove the transitional sidecar/global writers, document ownership, and complete focused plus full verification.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Depends on completed queue task task-1784171467799.
- Blocks optional Ignite graph-testing bridge task-1784171502136 until example-local topology proof is accepted.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
