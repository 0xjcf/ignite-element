# Create ecosystem architecture constitution docs and ignite-element ADR

## Source
Created with `fas create-task` on 2026-07-02.

## Problem
Apply the ecosystem architecture review to ignite-element's shared architecture docs without creating a competing ECOSYSTEM/MANIFESTO document: keep ADR-003 as the normative source, tighten current-vs-target language, clarify actor-web and fas-local boundaries, remove provider/model dependency implications, and add a bounded Law of Least Inference.


## Acceptance criteria
- docs/adr-003-shared-arc.md remains the single normative shared-architecture source for this repo
- docs/shared-architecture-model.md explains current vs target state for actor-web and fas-local without overstating ownership
- docs/architecture.md aligns the local package map and denies any ignite-element provider/model dependency implication
- The Law of Least Inference includes a cost, correctness, and latency escape clause
- Verification passes with markdown/docs/FAS gates
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- docs/adr-003-shared-arc.md
- docs/shared-architecture-model.md
- docs/architecture.md

## Scope Amendments
- Type: scope-clarification
- Added at: 2026-07-02
- Trigger: FAS code-writing token blocked on missing explicit affected-file scope
- Reason: Architect and staff handoffs narrowed the task to the three existing architecture docs and explicitly rejected creating a competing ECOSYSTEM.md or MANIFESTO.md in this repo.
- Added paths: docs/adr-003-shared-arc.md, docs/shared-architecture-model.md, docs/architecture.md
- Evidence source: delegated handoff
- Evidence: delegated handoff | .fas/state/agent-orchestration-execution.json
- Accuracy signal: fas_senior_engineer token was blocked until explicit affected files were added

## Implementation plan
- Update ADR-003 normative language and non-goals
- Update shared architecture model explanatory current-vs-target sections
- Update local architecture package map and dependency-direction wording

## Verification plan
- Run npm run lint:md
- Run pnpm docs:build
- Run fas validate-task
- Run .fas/scripts/verify.sh --full

## Risks
- Creating a duplicate normative ecosystem document would conflict with ADR-003
- Diagrams may be misread as package dependency chains
- actor-web or fas-local target-state claims may be mistaken for current repo facts

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
