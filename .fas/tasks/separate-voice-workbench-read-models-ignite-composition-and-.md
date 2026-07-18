# Separate Voice Workbench read models, Ignite composition, and renderers

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Export explicit renderer-neutral Voice Workbench view contracts and split the composed presentation read model into coherent conversation, artifact, and runtime pure projectors. Keep Ignite composition thin: bind the caller-owned actor source, derive views, expose schema-admitted semantic commands, and emit public facts. Make JSX renderers consume prepared view contracts and return templates only, without importing the Ignite component type, reading raw snapshots, repeating guards, allocating workflow data, or performing effects.

## Acceptance criteria
- Renderer files depend on renderer-neutral view contracts rather than WorkbenchProjection inferred from workbench-component.ts.
- Conversation, artifact, and runtime projectors are pure, named, serializable, and compose into one VoiceWorkbenchView without becoming new authorities.
- The same pure selector drives command availability and projected can fields; views do not feed derived values back into commands or machines.
- Ignite commands express caller intent with only genuinely external payload data and the component does not perform model, network, clock, browser, or lifecycle orchestration.
- JSX renderers contain template and local event-to-command binding only; raw snapshot branching and imperative DOM work remain forbidden.
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
- examples/agents/voice-workbench/src/workbench-view.ts
- examples/agents/voice-workbench/src/workbench-component.ts
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/views/conversation.tsx
- examples/agents/voice-workbench/src/views/artifact.tsx
- examples/agents/voice-workbench/src/views/runtime.tsx
- examples/agents/voice-workbench/src/styles.ts

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
