# CodeRabbit P2 docs and examples accuracy

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit docs/example findings: missing README links, package metadata/config concern if still valid, Redux example wording, MobX decorator tsconfig, and XState effects callback signatures.

## Acceptance criteria
- README links resolve to existing docs or are removed/replaced with current references.
- ignite-core package metadata/config finding is verified and fixed only if still valid.
- Redux and XState example docs match current view/commands/effects APIs.
- MobX example has the TypeScript config needed for decorators.
- Markdown lint, affected example checks, and repo verification pass.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-adapters/README.md
- packages/ignite-core/package.json
- packages/ignite-element/src/examples/redux/README.md
- packages/ignite-element/src/examples/mobx/package.json
- packages/ignite-element/src/examples/mobx/tsconfig.json
- packages/ignite-element/src/examples/xstate/README.md

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
