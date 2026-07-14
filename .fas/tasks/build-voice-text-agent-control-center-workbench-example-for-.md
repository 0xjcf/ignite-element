# Build LLM-authored voice/text artifact control-center workbench

## Source

Created with `fas create-task` on 2026-07-09.

## Problem

Build examples/agents/voice-workbench as the decisive dogfood for agent-authored interfaces. A user types or speaks a prompt; a conversation/command-center actor exposes consumer-owned `createArtifact`, `reviseArtifact`, and `completeResponse` commands through igniteTools; a scripted or live OpenAI-compatible/MLX model proposes artifact content and response text/speech through those intent-oriented commands; the actor validates and stores durable ProjectionDocument state; Ignite commits it to accessible native JSX, speech, and text/terminal outputs without raw generated code or a DOM requirement for voice. Include a deterministic mock model and direct injectable text/terminal and speech commit callbacks in CI, optional live MLX, and actor-web-backed conversation/artifact actors where the current source integration supports them.

## Acceptance criteria
- Fresh load starts with an empty actor-owned conversation and no fixture artifact, counts, revisions, ids, titles, nodes, or responses.
- Text input and a capability-gated microphone transcript both enter through submitPrompt with explicit modality and continue one session.
- The live model path uses igniteTools(component, openai) against consumer-configured MLX_BASE_URL and MLX_MODEL; Ignite does not own provider lifecycle.
- The model sees only createArtifact, reviseArtifact, and completeResponse; submitPrompt and acknowledgeSpeech remain application or projection-owned.
- The semantic artifact command schema and domain validation fully describe every renderer-supported node shape so untrusted model output cannot crash the projection.
- The actor remains transition and revision authority, rejects invalid or stale proposals, and the center artifact visibly updates only after accepted commands.
- The approved Mock Studio source, tokens, designed states, controls, responsive behavior, and runtime teaching rail are ported to Ignite JSX without wrappers around igniteCore APIs.
- Runtime stats, schema, causal trace, channel receipts, and rejected-command evidence derive from current component view, events, tool results, and projection callbacks rather than a parallel fixture store.
- Browser document, terminal text, and speech outputs independently consume the same accepted actor facts; speech acknowledgement stays explicit.
- Pure-Node igniteTest and scripted-provider tests cover fresh create, mixed-modality revise, validation, conflict, completion, subscriptions, dynamic tool gating, and non-allowlisted calls before live adapters.
- Browser tests cover text submission, microphone capability/denial fallback, document/schema tabs, playback preference, focus, keyboard, empty, responding, artifact, permission, and visible error states.
- Live MLX, microphone, and speech synthesis remain optional manual validation paths; deterministic CI has no provider, device, or DOM dependency for the headless lane.
- The implementation documents privacy/redaction, local-model configuration, provider lifecycle, voice adapter, Actor-Web, persistence, and determinism boundaries.
- Mock Studio parity receipts cover ready, listening, responding, artifact, and permission states at 1440x900, 1280x800, 768x900, 390x844, and a wide viewport with zero horizontal overflow and required accessibility checks.
- No public inspect, getBlueprint, projection CRUD, commit scheduling, session wrapper, lifecycle registry, or model-generated JSX or JavaScript is added.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Build a deterministic domain core in which consumer-owned behavior validates
  model proposals and remains the only transition authority. The model never
  writes actor or projection state directly.
- Make the callable value returned by `igniteCore(...)` the primary workbench
  contract. Headless tests, `igniteTools`, DOM registration, and non-DOM
  projection targets all consume that same `component` value.
- Export one consumer-owned shared `source` actor and one literal
  `component = igniteCore({ source, cleanup: true, ... })` across every channel.
  Ignite releases its adapter resources; tests and application shutdown call
  `source.stop()` directly because the source owner controls actor lifetime.
- Do not add session handles, component factories, WeakMap lifecycle registries,
  `stopWorkbench()` helpers, or agent objects that wrap the Ignite APIs. A plain
  `runModelTurn({ component, model, prompt })` orchestration function may return
  facts but must not own state or lifecycle.
- Route prompts through a typed `submitPrompt` Ignite command. Derive the model
  manifest from `igniteTools(component).manifest`, filter it to
  `createArtifact`, `reviseArtifact`, and `completeResponse`, and reject any
  non-allowlisted call before execution.
- Start with red pure-Node `igniteTest` scenarios over the headless runtime,
  then implement the minimum actor state, guards, commands, events, and view to
  make those scenarios green.
- Only after the complete headless behavior suite is green, introduce a second
  red contract for accessible JSX, text/terminal commits, and speech commits;
  implement those projections over the already-proven view and actor-owned
  artifact state.
- Keep live OpenAI-compatible/MLX, browser speech, and Actor-Web integration as
  optional outer adapters layered after deterministic scripted-provider CI.

## Alternatives considered

- Build projections first: rejected because UI-first implementation would hide
  domain ambiguity and weaken the headless API stress test.
- Let model tool calls mutate projection state: rejected because models propose
  while consumer-owned behavior validates, authorizes, and persists.
- Add public `inspect()` or `getBlueprint()`: rejected until reproducible
  workbench evidence proves the focused getters and subscriptions insufficient.
- Make live MLX, microphone, or browser speech part of CI: rejected because the
  deterministic lane must remain provider-, device-, and DOM-independent.

## Affected files
- examples/agents/voice-workbench
- package.json
- scripts/__tests__/test-examples.test.mjs
- scripts/__tests__/typecheck-examples.test.mjs
- docs/ignite-tools.md
- docs/site/src/content/docs/guides/accessibility-first.mdx
- .mock-studio/voice-text-workbench
- .mock-studio/voice-text-workbench/README.md
- .mock-studio/voice-text-workbench/mock-studio-handoff.md
- .mock-studio/voice-text-workbench/mock-studio-log.md
- .mock-studio/voice-text-workbench/source/index.html
- .mock-studio/voice-text-workbench/source/tokens.css
- examples/agents/voice-workbench/src/domain.ts
- examples/agents/voice-workbench/src/domain.test.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/agent-loop.test.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/voice.ts
- examples/agents/voice-workbench/src/voice.test.ts
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/index.html
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/package.json
- .mock-studio/_nav/mocknav.js
- .mock-studio/catalog.json
- .mock-studio/index.html
- .fas-config.json
- examples/agents/voice-workbench/parity.html
- examples/agents/voice-workbench/src/parity.tsx
- examples/agents/voice-workbench/src/parity.test.tsx
- examples/agents/voice-workbench/src/contrast.test.ts

## Scope Amendments

- Type: scope-correction
- Added at: 2026-07-11
- Trigger: architecture review of example discovery and full-test admission.
- Reason: the generic example runner already discovers self-contained examples;
  admission is enforced by the root full-test manifest and its runner contract
  tests instead.
- Added paths: package.json, scripts/__tests__/test-examples.test.mjs,
  scripts/__tests__/typecheck-examples.test.mjs.
- Removed paths: scripts/test-examples.mjs.
- Evidence: current runner discovery and manifest contract tests inspected by
  the architecture step.
- Accuracy signal: no generic runner change unless implementation produces
  contrary evidence.
- Follow-up needed: none.

### Component-first headless correction

- Type: architecture-correction
- Added at: 2026-07-11
- Trigger: owner review found prompt input bypassing the headless command
  contract and the callable Ignite component hidden behind a narrowed wrapper.
- Reason: the workbench is intended to stress one idiomatic `igniteCore` value
  across headless behavior, tools, DOM, terminal, and speech.
- Added paths: none.
- Removed paths: none.
- Evidence: committed headless slice `351165b8` and owner-approved design review.
- Accuracy signal: `submitPrompt` executes through the exported component;
  model tools come from its filtered Ignite manifest; `completeResponse`
  finishes a turn and returns the conversation to ready; the same callable
  component remains available for projection registration; source teardown is
  the direct `source.stop()` ownership boundary.
- Follow-up needed: capture a new RED/GREEN headless receipt before projection
  implementation.

### Direct projection-fact correction

- Type: architecture-correction
- Added at: 2026-07-11
- Trigger: owner review found custom artifact shapes, test harnesses, and
  explicit `igniteCore` type scaffolding obscuring the first-party APIs.
- Reason: the example must demonstrate direct Ignite usage rather than teach a
  workbench-specific facade.
- Added paths: none.
- Removed paths: none.
- Accuracy signal: actor context stores the standard document and speech target
  callback shapes directly; tests call `igniteTest(component)` and import the
  literal `component`/`source`; `session.ts` relies on inferred
  `igniteCore({ ... })` types; only the external model turn remains a plain
  application boundary.
- Follow-up needed: consider named projection-type exports separately; this
  example currently derives the existing public callback shapes once.

- Type: approved-design-handoff
- Added at: 2026-07-13
- Trigger: Human approval of Mock Studio Round 2 and the fresh local-MLX product definition.
- Reason: Promote the approved mock source and handoff as production port input; replace fixture browser behavior with an empty-session, real OpenAI-compatible MLX loop, capability-gated microphone transcription, actor-validated semantic artifacts, and measured parity evidence.
- Added paths: .mock-studio/voice-text-workbench
- Evidence source: Mock Studio handoff and owner approval
- Evidence: Mock Studio handoff and owner approval | .mock-studio/voice-text-workbench/mock-studio-handoff.md | The center artifact must update from accepted text or speech prompts; no browser-demo ids, titles, nodes, responses, counts, or revisions may be hardcoded.
- Accuracy signal: Fresh load starts empty; configured MLX tools create and revise validated semantic artifacts; speech and text converge at submitPrompt; runtime evidence derives from component facts; production parity receipts cover approved states and viewports.
- Follow-up needed: None; implement within the current workbench task before downstream QA.

- Type: scope-refresh
- Added at: 2026-07-13
- Added paths: .mock-studio/voice-text-workbench/README.md, .mock-studio/voice-text-workbench/mock-studio-handoff.md, .mock-studio/voice-text-workbench/mock-studio-log.md, .mock-studio/voice-text-workbench/source/index.html, .mock-studio/voice-text-workbench/source/tokens.css, examples/agents/voice-workbench/src/domain.ts, examples/agents/voice-workbench/src/domain.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/agent-loop.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/voice.ts, examples/agents/voice-workbench/src/voice.test.ts, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/src/styles.ts, examples/agents/voice-workbench/index.html, examples/agents/voice-workbench/README.md, examples/agents/voice-workbench/package.json

- Type: mock-gallery-support
- Added at: 2026-07-13
- Trigger: Mock Studio handoff review found the approved feature source depends on the shared role gallery and navigator.
- Reason: Include only the root gallery files needed to discover and navigate the approved voice workbench mock; do not create another per-mock server.
- Added paths: .mock-studio/_nav/mocknav.js, .mock-studio/catalog.json, .mock-studio/index.html
- Evidence source: Mock Studio skill
- Evidence: Mock Studio skill | .mock-studio/voice-text-workbench/README.md
- Accuracy signal: The root catalog links the voice-text-workbench and the shared navigator remains contained by dedicated prototype chrome.
- Follow-up needed: None.

- Type: correctness
- Added at: 2026-07-13
- Trigger: example admission verification
- Reason: FAS full verification duplicates the discovered example coverage list and must admit voice-workbench with the root scripts.
- Added paths: .fas-config.json
- Evidence source: configured verification command
- Evidence: configured verification command | .fas-config.json | testCommand uses --require-covered-packages-match-discovered and omitted examples/agents/voice-workbench.
- Accuracy signal: full verification coverage parity

- Type: verification-correctness
- Added at: 2026-07-13
- Trigger: QA parity evidence gap
- Reason: Production renderer needs a separate deterministic browser-addressable harness for the five approved states and exact viewport/accessibility receipts without seeding the live entrypoint.
- Added paths: examples/agents/voice-workbench/parity.html, examples/agents/voice-workbench/src/parity.tsx, examples/agents/voice-workbench/src/parity.test.tsx, examples/agents/voice-workbench/src/contrast.test.ts
- Evidence source: fas_qa handoff
- Evidence: fas_qa handoff | .fas/tasks/build-voice-text-agent-control-center-workbench-example-for-.md | Acceptance requires ready/listening/responding/artifact/permission at 1920x1080, 1440x900, 1280x800, 768x900, and 390x844 plus accessibility and contrast checks.
- Accuracy signal: browser-addressable production-renderer parity coverage

## Implementation plan
- Treat committed headless, component-first, wrapper-removal, projection, view-derivation, and thin-browser slices as the verified baseline.
- Update and approve the Mock Studio handoff as the durable production port input, including the fresh-session proof, state coverage matrix, control map, and parity checklist.
- RED: add deterministic tests for complete semantic-node schemas and runtime validation, an empty initial browser flow, dynamic model tools, MLX request/result translation, microphone capability and denial, real turn receipts, and center-artifact revision updates.
- GREEN: implement a thin OpenAI-compatible MLX client loop around igniteTools(component, openai), configured only through consumer input or environment, with visible errors and no hardcoded artifact fixture.
- Implement microphone transcription and speech playback as capability-gated browser adapters that converge on submitPrompt and acknowledgeSpeech without entering igniteCore configuration or actor state.
- Port the approved token-first desktop and responsive Mock Studio layout into the existing component registration, deriving all durable presentation from view and all causal evidence from component facts and projection receipts.
- Strengthen the semantic artifact schema and deterministic domain validation for text, checklist, action, form, table, timeline, chart, code-diff, and decision-log nodes before rendering untrusted model proposals.
- Admit the example to root test and typecheck manifests, document setup and ecosystem boundaries, and preserve live MLX as optional manual validation.
- Run focused tests after each implementation commit, then run Mock Studio parity and accessibility checks for every designed state and viewport before QA handoff.
- Complete root-owned full verification and review summary only after QA, SRE, and reviewer clear the implementation.

## Execution workflow

Use `6-agent` mode. The architect owns the interface and actor boundary, the
staff engineer owns shared contracts and the commit plan, and one senior
engineer is the sole code writer for the example, tests, adapters, and
task-scoped documentation. QA, SRE, and reviewer roles are read-only; no agent
other than the designated senior engineer may modify files. Create a separate
incremental commit after every commit-plan step before advancing a review gate.

## Verification plan
- Preserve or add RED and GREEN receipts for every new behavior slice.
- Run the voice-workbench pure-Node headless and model tests before DOM tests.
- Run voice-workbench typecheck and focused accessible JSX, microphone adapter, MLX adapter, projection, and browser tests.
- Run fas validate-task after each remaining commit-plan step.
- Run the Mock Studio visual validator or equivalent Chrome measurements across ready, listening, responding, artifact, and permission at 1920x1080, 1440x900, 1280x800, 768x900, and 390x844; record overflow, target size, runtime errors, and screenshots.
- Run axe or the repository accessibility bridge plus manual token and translucent-background contrast checks; presence and wide alignment gaps fail parity.
- Refresh closeout readiness and downstream context before QA, SRE, and reviewer handoff.
- Run fas verify --full only as the final root-owned release-quality gate and refresh the review summary.

## Risks

- Do not send private inspection state to a model without explicit selection/redaction.
- Do not allow arbitrary code, selectors, imports, DOM references, or unapproved model-owned command execution; models may invoke only validated, allowlisted igniteTools actions.
- Do not make live provider or browser speech availability a CI requirement.
- Do not expose `ProjectionDocument`, revision application, or committers as
  model-facing CRUD infrastructure; those remain actor and Ignite internals.

## Dependencies

- Depends on task-1783735005336.
- Depends on task-1783783535436, which defines `getSchema()` as the compiled
  blueprint and keeps coherent inspection private.
- Blocks task-1783610950265.

## Open questions

- None captured at task creation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
