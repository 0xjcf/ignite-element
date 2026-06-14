# Add a realistic XState-backed SPA/router example (history routing, dynamic params /users/:id, 404, one auth redirect/guard, active links, pure route core with effects/shell for History I/O, headless-runtime navigation tests) under packages/ignite-element/src/examples/spa-router, plus a guides/routing.mdx docs page; AND a full uniformity pass across the xstate/redux/mobx examples: fix the redux v2 send() render-arg drift, add tests to redux and mobx, align README/structure, document the intentional styling divergence

## Source
Updated with `fas edit-task` on 2026-06-14.

## Problem
Add a realistic XState-backed SPA/router example (history routing, dynamic params /users/:id, 404, one auth redirect/guard, active links, pure route core with effects/shell for History I/O, headless-runtime navigation tests) under packages/ignite-element/src/examples/spa-router, plus a guides/routing.mdx docs page; AND a full uniformity pass across the xstate/redux/mobx examples: fix the redux v2 send() render-arg drift, add tests to redux and mobx, align README/structure, document the intentional styling divergence

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Scope Amendments
- Type: scope-expansion
- Added at: 2026-06-14
- Trigger: beta.5 release ran mid-task
- Reason: The 3.0.0-beta.5 release (pnpm release:beta) executed inside this task's window, so its artifacts (core/adapters/element/renderer CHANGELOGs, package.json version bumps, .changeset/pre.json, docs compatibility.mdx) appear in the task diff. They are deliberately claimed here so closeout scope aligns; they were produced by the operator-run release, not by the examples implementation. The examples uniformity + SPA router + routing guide are the task's actual deliverables.

## Implementation plan
- Describe the intended code or workflow changes in execution order.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Note any regression, rollout, or coordination risk before implementation begins.

## Dependencies
- List blocking tasks, PRs, docs, or external inputs.

## Open questions
- Capture unresolved decisions that need confirmation before closeout.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
