# promote ignite-element markdown memory into SQLite records and refresh retrieval indexes

## Goal

Refresh ignite-element memory and retrieval surfaces so future planning uses authoritative memory records and current indexes.

## Evidence

- `.fas/memory/memory.db` exists, but `memory_records` currently has zero rows.
- `.fas/state/task-packet.json` reports retrieval confidence `0` and `retrieval index unavailable`.
- Several contextual memory entries are marked conflicted even though the current package structure can now resolve some conflicts.

## Scope

- Run the repo-native memory/index refresh path.
- Resolve or document conflicted memory entries around package boundaries and verification strategy.
- Do not change product source code except generated/index artifacts that the repo intentionally tracks.

## Acceptance Criteria

- SQLite-backed memory records are populated or a blocker is documented with exact command output.
- Retrieval/index artifacts are refreshed.
- Conflicted memory entries relevant to package boundaries are resolved, superseded, or explicitly documented.
- Focused validation confirms JSON/index artifacts are readable.

## Recommended Mode

single-agent

## Recommended Phase

closeout

## Scope Amendments

- Type: validation-scope
- Added at: 2026-05-26
- Trigger: validation-only memory/index refresh
- Reason: The task validates ignored FAS memory/index artifacts produced by fas memory-migrate and fas setup --refresh-memory. Product source paths from planner heuristics are reference-only and should not be edited.
- Added paths: .fas/tasks/promote-ignite-element-markdown-memory-into-sqlite-records-and-refresh-retrieval-indexes.md, .fas/TASKS.md
- Evidence source: focused validation
- Evidence: focused validation | .fas/state/task-packet.json | SQLite memory has 30 validated records; .fas/index and .fas/semantic artifacts are readable; memory_records conflict metadata is empty.

## Affected files

- .fas/tasks/promote-ignite-element-markdown-memory-into-sqlite-records-and-refresh-retrieval-indexes.md
- .fas/TASKS.md
