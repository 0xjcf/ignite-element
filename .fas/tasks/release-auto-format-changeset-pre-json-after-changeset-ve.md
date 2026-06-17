# Release: auto-format .changeset/pre.json after 'changeset ve

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Release: auto-format .changeset/pre.json after 'changeset version' so the Biome format gate stays green. Every beta release, 'changeset version' rewrites .changeset/pre.json in a non-Biome format, tripping the whole-repo Biome format gate (observed for beta.5 and beta.6, each needing a manual 'chore(changeset): format release-generated pre.json' commit). Fix: in scripts/release-beta.mjs, run 'biome format --write .changeset/pre.json' immediately after the 'changeset version' step and before the release commit, so the generated file is committed already formatted. Verify a beta dry-run + real run leaves the format gate clean with no follow-up reformat commit.

## Acceptance criteria
- The defect no longer reproduces.
- A regression test covers the fix.
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
