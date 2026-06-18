# examples: add React/Vue/Svelte/Angular framework-interop demos under examples/frameworks + extend host-app-integration g

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Decomposed from task-1781724737259, deliverable (1). Prove the renderer-agnostic distribution-layer thesis with runnable demos consuming an ignite-element custom element from each major framework via standard custom-element APIs (attributes/props in, CustomEvents out). One small app per framework under packages/ignite-element/src/examples/frameworks (react, vue, svelte, angular), reusing the vite + source-alias scaffolding from the existing examples. Surface and document each framework real friction point (do NOT paper over): React props-as-attributes + no declarative custom-event listener pre-19 (ref + addEventListener), clean on React 19 (decide the version stance when building); Vue 3 compilerOptions.isCustomElement; Angular CUSTOM_ELEMENTS_SCHEMA; Svelte near-zero friction. Extend docs/site guides/host-app-integration.mdx with per-framework integration code (do NOT duplicate the guide). Keep each demo minimal and headless-testable. PRIMARY GAP-FINDER: capture any ignite-element API gaps surfaced here as follow-up tasks BEFORE the additive source work (whenChanged/expectView).

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
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
- Scope unknown.

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
