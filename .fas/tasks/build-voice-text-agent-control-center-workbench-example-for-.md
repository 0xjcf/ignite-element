# Build voice/text projection control-center workbench example

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
Build examples/agents/voice-workbench as a voice/text projection control-center dashboard that stress-tests behavior-first interfaces. The example should run with a deterministic mock model/speech adapter in CI and optional live OpenAI-compatible or MLX path. A user can speak or type instructions; the agent uses igniteTools against a headless runtime to create ProjectionRequest objects and update structured ProjectionSpec objects such as checklists, forms, status cards, dashboards, timelines, conversations, and decision logs rather than arbitrary generated component code. The browser renders projections as accessible native JSX/custom elements with a cinematic command-center UX, while voice/text responses summarize state and next actions. Include actor-web-backed mode if available, or frame the bridge seam as the future actor-web-hosted behavior graph.

## Acceptance criteria
- A self-contained top-level example provides deterministic mock voice/model behavior for CI and optional live local-model validation.
- The agent creates ProjectionRequests and updates structured ProjectionSpecs, not raw generated component code.
- One headless runtime drives text chat, voice input/output, and the browser control-center dashboard.
- Rendered controls use native accessible elements and cover keyboard, focus, accessible names, and disabled/error states.
- Headless tests assert behavior-contract and projection command flow without a DOM.
- Docs explain safety boundaries, non-visual interface behavior, and actor-web behavior graph alignment.
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
- examples/agents/voice-workbench
- scripts/test-examples.mjs
- docs/ignite-tools.md
- docs/site/src/content/docs/guides/accessibility-first.mdx

## Scope Amendments
- None.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- None known at task creation.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
