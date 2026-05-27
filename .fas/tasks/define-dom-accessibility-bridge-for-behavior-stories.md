# define DOM accessibility bridge for behavior stories

## Source
Created with `fas create-task` on 2026-05-26.

## Problem
Follow-up from inspector runtime investigation. Behavior-first runtime APIs and story lifecycle evidence exist, but docs/site agent-runtime-v3 still lists a DOM bridge gap: connect workflow expectations to rendered controls and accessible names after headless behavior is proven. Design a small mapping layer that keeps behavior tests headless by default and uses DOM/accessibility only for projection proof.

## Acceptance criteria
- A small public helper or documented pattern maps story/view expectations to rendered controls and accessible names without replacing headless behavior assertions.
- The bridge keeps DOM lifecycle evidence separate from behavior trace entries.
- Focused DOM/runtime tests and docs cover the bridge with an Ignite JSX example.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx

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
