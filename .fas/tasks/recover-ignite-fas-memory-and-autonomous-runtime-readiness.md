# Recover Ignite FAS memory and autonomous runtime readiness

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Restore trustworthy project-local FAS runtime prerequisites without changing Ignite product behavior. Preserve a recoverable backup of the unreadable SQLite memory database, rebuild it from curated projections, verify queue/current-task continuity, and assess the configured monitor packs and launchd readiness so future autonomous workflows report active, quiet, stalled, blocked, and recoverable states truthfully.

## Automation admission
- Expected operator value: Restores trustworthy context retrieval and observable runtime health before unattended Ignite workflows are promoted.
- Observability surface: fas status, fas runtime status, memory record counts, monitor state, and a durable recovery receipt show whether readiness is healthy, degraded, blocked, or intentionally disabled.
- Recovery path: Restore the uniquely named memory.db backup, keep the runtime disabled, and rerun the documented refresh or monitor readiness checks without altering queue truth.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after repeated memory rebuild and monitor runs preserve queue state, emit trustworthy health, and demonstrate a bounded rollback path.

## Acceptance criteria
- The unreadable .fas/memory/memory.db is backed up or moved to a uniquely named recoverable path before any rebuild.
- fas setup --refresh-memory rebuilds readable SQLite memory_records from curated projections and reports source provenance, record counts, and no silent data loss.
- Current task, queue tasks, Epic membership, dependency edges, workflow history, and verification receipts remain unchanged by memory recovery.
- fas status and fas runtime status no longer report SQLite unavailable, and memory-backed retrieval is smoke-tested against a known curated entry.
- Configured ci-regressions, dependency-drift, and quality-check monitors receive an explicit enabled, intentionally-disabled, or blocked disposition with observable status and recovery commands.
- 24x7 or autonomous execution is not enabled silently; any launchd installation or runtime-mode promotion remains an explicit operator decision after readiness evidence.
- The final receipt records backup location, rebuild commands, runtime-health output, rollback path, and remaining environment limitations.
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
- .fas/memory/memory.db
- .fas/state/launchd
- .fas-config.json
- .fas/WORKFLOW.md

## Scope Amendments
- None.

## Implementation plan
- Capture queue current-task workflow and memory checksums then move the unreadable database to a uniquely named recoverable backup.
- Run the supported memory refresh path and verify authoritative SQLite records against curated projections without editing product source.
- Recheck queue and workflow continuity then exercise context retrieval against a known entry.
- Assess each configured monitor and launchd surface and record enabled intentionally-disabled or blocked status without silently enabling unattended execution.

## Verification plan
- Compare pre/post queue Epic dependency current-task and workflow checksums.
- Run fas status fas runtime status and a known memory retrieval smoke test.
- Run monitor readiness and dry-run diagnostics appropriate to the accepted operator posture and record rollback evidence.
- Run fas validate-task and focused FAS metadata verification; product tests are required only if tracked product files unexpectedly change.

## Risks
- The unreadable database may contain unrecoverable records; never overwrite or delete it before a verified backup exists.
- Memory refresh must not mutate queue workflow or product truth.
- Do not enable launchd 24x7 execution or promote autonomy mode without a separate explicit operator decision.

## Dependencies
- Standalone operational task: it intentionally belongs to no product Epic because project-local FAS health supports every chain.
- No product task is blocked on this recovery, but unattended runtime promotion should wait for its readiness receipt.

## Open questions
- Whether the operator wants launchd installed after readiness is proven remains a separate explicit decision; default to leaving it disabled.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
