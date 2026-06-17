# Engineering credibility backlog for v3 (post-beta.6, not rel

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Engineering credibility backlog for v3 (post-beta.6, not release-blocking). Three deliverables: (1) FRAMEWORK INTEROP DEMOS — show consuming ignite-element custom elements in React, Vue, Svelte, and Angular via standard custom-element APIs (attributes/props + CustomEvent listeners); small demo apps under packages/ignite-element/src/examples/ and/or extend the existing host-app-integration.mdx guide (do not duplicate it). (2) BUNDLE-SIZE NUMBERS — measure tree-shaken + gzip sizes per published entrypoint (root, xstate/redux/mobx/actor-web adapters, jsx, lit) and publish them (a docs page; optional size-budget check in CI). (3) MORE WORKED EXAMPLES — a form-with-validation example, a nested/child-router example (building on spa-router), and a dashboard-with-shared-state example; wire into docs as additional proof points. Keep each example minimal and headless-testable; reuse the existing example scaffolding (vite + source-alias) pattern from src/examples/*.

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
