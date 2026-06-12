# Stable v3: merge the v3 line to main and retire branch-dispa

## Source
Created with `fas create-task` on 2026-06-12.

## Problem
Pre-stable-v3 audit finding F1 (high). main (origin/main 94a78b9) is ~306 commits behind the v3 line: it still carries v2 code and v2 docs, the live beta docs require a manual 'gh workflow run docs-deploy.yml --ref <branch>' dispatch, and ANY push to main redeploys v2 docs over the live beta docs. Immediately after the stable 3.0.0 publish: (1) merge the v3 line into main (human-approved merge; resolve the docs homepage overlap with PR #59's backported counter demo — the v3 version supersedes it); (2) confirm docs-deploy.yml fires on the merge push and the live site serves the v3 stable docs with the 2.x archive intact; (3) retire the branch-dispatch deploy workaround (no workflow changes needed — push-to-main becomes correct again); (4) verify repo metadata that encodes branch assumptions (e.g. repo example links pointing at tree/main) resolves correctly post-merge. Operator/owner runs the merge per FAS approval rules.

## Acceptance criteria
- main contains the v3 line and CI is green on main
- live GitHub Pages site serves v3 stable docs from a push-to-main deploy (no manual dispatch)
- 2.x archived docs remain reachable via the version picker
- PR #59 is merged or closed-superseded with a note
- post-merge fas post-merge run records lessons and closes the docs tasks parked in review
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
