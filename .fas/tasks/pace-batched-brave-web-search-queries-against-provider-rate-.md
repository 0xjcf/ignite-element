# Pace batched Brave web-search queries against provider rate limits without adding LLM rounds

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Batched searchWeb calls currently burst one Brave HTTP request per query. On the configured 1 request-per-second plan, all but the first request are rejected with 429 and immediate retries repeat the burst. Preserve one LLM tool round while pacing provider requests and returning one aggregated capability fact.


## Acceptance criteria
- One batched searchWeb tool call remains one LLM tool round and returns one aggregated fact.
- Brave requests within and across batches honor provider reset headers instead of bursting over the short-window limit.
- A 429 without Retry-After falls back to Brave rate-limit reset headers before retrying.
- The existing cache, coalescing, validation, timeout, and structured failure contracts remain intact.
- Focused tests cover pacing, aggregation, and header fallback.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- examples/agents/voice-workbench/server/brave-web-search.ts
- examples/agents/voice-workbench/server/brave-web-search.test.ts
- examples/agents/voice-workbench/README.md
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: planning-correction
- Added at: 2026-07-15
- Trigger: Live reproduction localized the failure after initial heuristic planning.
- Reason: Replace unrelated low-confidence package candidates with the concrete Brave adapter, its tests, and its operator documentation.
- Added paths: examples/agents/voice-workbench/server/brave-web-search.ts, examples/agents/voice-workbench/server/brave-web-search.test.ts, examples/agents/voice-workbench/README.md
- Evidence source: live-reproduction
- Evidence: live-reproduction | examples/agents/voice-workbench/server/brave-web-search.ts | Four concurrent query fetches exceeded Brave's 1 request-per-second header policy; a single query succeeded.
- Accuracy signal: directly reproduced
- Follow-up needed: none

- Type: scope-refresh
- Added at: 2026-07-15
- Trigger: Closeout ChangeSet classified task-packet-cited, Git-ignored memory projections as relevant untracked files.
- Reason: Record those projections as workflow references for plan alignment; they were not edited or staged.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: git-status-and-check-ignore
- Accuracy signal: directly verified

## Implementation plan
- Add deterministic Brave rate-limit header parsing and a shared provider gate in the server adapter.
- Schedule each subject query through the gate while preserving the existing batched public input and aggregated output.
- Adjust the default batch timeout budget for scheduled multi-query requests while preserving explicit timeout overrides.
- Document that batching is one tool call whose provider requests are internally paced.

## Verification plan
- Run the focused Brave web-search server tests in RED and GREEN phases.
- Run the voice-workbench example test lane and typecheck.
- Run fas validate-task for the inner-loop gate.
- Run fas verify --full before closeout.

## Risks
- Incorrect reset-header parsing could cause excessive delay or repeated 429s.
- A provider gate scoped too narrowly would still allow separate batches to burst concurrently.
- An unchanged 8-second default timeout may be too small for the maximum eight-query batch.

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
