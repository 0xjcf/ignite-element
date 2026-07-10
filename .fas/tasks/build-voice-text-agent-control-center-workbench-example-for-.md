# Build LLM-authored voice/text projection control-center workbench

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
Build examples/agents/voice-workbench as the decisive dogfood for agent-authored interfaces. A user types or speaks a prompt; a conversation/command-center actor exposes domain and projection-authoring commands through igniteTools; a scripted or live OpenAI-compatible/MLX model calls upsertProjection or patchProjection with validated ProjectionDocument data and returns model-authored text or speech; actor state stores the durable documents; Ignite commits them to accessible native JSX, speech, and text/terminal outputs without raw generated code or a DOM requirement for voice. Include deterministic mock model, a mockable text/terminal committer adapter, and a separate mockable speech committer adapter in CI, optional live MLX, and actor-web-backed conversation/artifact actors where the current source integration supports them.


## Acceptance criteria
- Text and mock/live speech input drive one continuing conversation session.
- The model authors and incrementally patches validated projection documents through igniteTools commands rather than creating ProjectionRequest/ProjectionSpec objects or generated JSX/JavaScript.
- Actor state is the durable source of truth for messages, document revisions, artifacts, and command-backed actions.
- Model-authored final text is committed through a mockable text/terminal adapter, while structured speech is committed through a separate mockable speech adapter; voice-only operation requires no DOM.
- The browser maps semantic nodes to accessible native JSX and supports keyboard, focus, names, disabled/error states, and command actions.
- The artifact vocabulary includes at least text/markdown, checklist, form, table, timeline, decision log, code diff, and command-backed action nodes where useful.
- Deterministic CI covers the prompt-to-tool-call-to-state-update-to-JSX loop and independently verifies text/terminal commits and speech commits; live OpenAI-compatible/MLX validation remains optional.
- The example documents security, privacy/redaction, validation, provider, voice, and actor-web boundaries.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- examples/agents/voice-workbench
- scripts/test-examples.mjs
- docs/ignite-tools.md
- docs/site/src/content/docs/guides/accessibility-first.mdx

## Scope Amendments
- None.

## Implementation plan
- Model the conversation and projection store as deterministic actor state with explicit create/patch/reject events.
- Expose projection-authoring and domain commands through igniteTools with deterministic scripted provider fixtures.
- Build accessible JSX plus separate mockable text/terminal and speech committers over the same validated document state.
- Add optional OpenAI-compatible/MLX and actor-web-backed modes after deterministic lanes pass.

## Execution workflow

Use `6-agent` mode. The architect owns the interface and actor boundary, the
staff engineer owns shared contracts and the commit plan, and one senior
engineer is the sole code writer for the example, tests, adapters, and
task-scoped documentation. QA, SRE, and reviewer roles are read-only; no agent
other than the designated senior engineer may modify files. Create a separate
incremental commit after every commit-plan step before advancing a review gate.

## Verification plan
- Run focused headless, runtime, type, and rendered example tests plus visual and interaction validation after each commit-plan step.
- Create or refresh the final review summary artifact before task completion.
- Run the epic shared full verification and CodeRabbit review at closeout.

## Risks
- Do not send private inspection state to a model without explicit selection/redaction.
- Do not allow arbitrary code, selectors, imports, DOM references, or model-owned command execution.
- Do not make live provider or browser speech availability a CI requirement.

## Dependencies
- Depends on task-1783610933373.
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
