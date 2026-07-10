# Document LLM-authored projections, accessibility-first, and non-visual patterns

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
After replacement implementation, headless assertions, the LLM-authored workbench, and rendered validation land, publish the final v3 guidance. Replace ProjectionRequest/ProjectionSpec/ProjectionInstance registry documentation with the accepted architecture: behavior view and existing headless APIs remain stable; private coherent inspection and binding machinery support format-specific projection committers; validated ProjectionDocument data lives in actor state; LLMs author or patch documents through igniteTools commands; model-authored text/speech can be committed without DOM; accessible native JSX renders semantic nodes; provider/model loops and microphone lifecycle remain adapter concerns.


## Acceptance criteria
- Docs teach the final public igniteCore DX without exposing private bind, inspect, registry, or committer machinery.
- Docs distinguish behavior view, validated projection documents, format-specific output, and renderer/adapter responsibilities.
- A complete example shows prompt or speech input to LLM tool calls to actor-owned projection state to accessible JSX and model-authored speech/text.
- Docs explain why arbitrary generated JSX/JavaScript and DOM scraping are rejected.
- Docs cover command-backed actions, validation, privacy/redaction, provider-neutral igniteTools, OpenAI-compatible/MLX operation, actor-web behavior graphs, and deterministic CI versus optional live validation.
- Docs clearly separate headless behavior/document assertions from rendered browser accessibility guarantees.
- Stable v3 merge remains blocked until this documentation sweep is complete.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/guides/accessibility-first.mdx
- docs/projection-runtime.md
- docs/site/src/content/docs/concepts
- README.md
- examples

## Scope Amendments
- None.

## Implementation plan
- Rewrite the committed provisional projection design and site guide to the replacement architecture.
- Document the control-center example and minimal public APIs only after implementation names are final.
- Run docs example checks and remove all stale registry/behavior-metadata language.

## Verification plan
- Run focused docs/example checks and fas validate-task.
- Create or refresh the final review summary artifact before task completion.
- Run the epic shared full verification and CodeRabbit review before batch close.

## Risks
- Do not document private implementation contracts as public extension points.
- Do not imply models can safely generate executable UI code or that voice requires DOM.

## Dependencies
- Depends on task-1783610950265.
- Blocks task-1781292613064.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
