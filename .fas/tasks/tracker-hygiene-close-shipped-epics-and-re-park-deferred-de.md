# Tracker hygiene: close shipped epics and re-park deferred de

## Source
Created with `fas create-task` on 2026-06-12.

## Problem
Pre-stable-v3 audit finding F6. The tracker (.fas/TASKS.md / task read model) misstates lifecycle ahead of the release: (1) the 'Uniform emitted-event streaming seam on IgniteAdapter' epic entry still shows commit-planning although all six child tasks (E1-E6: core seam, runtime bridge, ActorWebAdapter stream(), tests, docs, changeset) are done and shipped in 3.0.0-beta.4 (2026-06-11) — close it out; (2) 'Ignite Element Actor-Web first-class adapter' is parked in review — confirm shipped scope and close or re-scope; (3) 'igniteCore send() command helper: validate send-in-commands-context across all four adapters' sits in commit-planning although the send() decision was DEFER (decisions.md 2026-06-08) — re-park it as an explicit deferred/backlog entry tied to the decision; (4) remove template/noise rows from .fas/TASKS.md. Apply the fas batch-close gotchas memory (snapshots freeze status at implementing -> patch to review for done; deferred tasks do not auto-link queueTaskId). Goal: the queue/tracker reads true before the stable-cut session.

## Acceptance criteria
- Stream-seam epic and any other shipped-but-open entries are closed with provenance
- send() validation entry is re-parked as deferred with a pointer to the 2026-06-08 DEFER decision
- .fas/TASKS.md contains no stale template/noise rows
- fas task list summary matches reality (no commit-planning/review entries for shipped work)
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
