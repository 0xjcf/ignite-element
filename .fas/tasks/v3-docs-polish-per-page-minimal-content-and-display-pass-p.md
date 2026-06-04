# v3 docs polish: per-page minimal-content and display pass (p

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 3, AFTER the restructure tasks. Walk every SURVIVING v3 page; narrow each to minimal necessary content, fix display/formatting, ensure each runnable example is complete and passes the doc-typecheck guardrail, and confirm no page re-introduces content owned by another page. For any page still over-budget or needing substantial work, spin off a dedicated per-page subtask via fas create-task (dependsOn this task) rather than bloating this one. Pages already clean per the audit (redux-and-mobx, actor-web, command-metadata, testing-dsl, migration/*, community) need only a light consistency pass. Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- Every surviving v3 page is reviewed for minimal-necessary content, correct display, and single-ownership (no re-duplication); trivial fixes applied inline
- Any page needing substantial further work has a dedicated per-page follow-up subtask queued (dependsOn this task)
- All doc examples pass the guardrail; docs:build green; contrast guardrail green
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
