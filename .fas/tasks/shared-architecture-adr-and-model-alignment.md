# shared architecture ADR and model alignment

## Source
Updated with `fas edit-task` on 2026-04-18.

## Problem
Define a canonical shared architecture ADR and tighten the accompanying shared model document so the ecosystem-wide architecture is explicit, reviewable, and aligned with current repository reality. The work should capture the architectural layers shared across editor-save-loop, FAS, actor-web, ignite-element, and Blueprint; distinguish current state from target state; and avoid collapsing policy, orchestration, projection, and composition concerns into one layer.



## Acceptance criteria
- adr-003-shared-arc.md records the decision, status, context, decision, consequences, and non-goals for the shared architecture model
- shared-architecture-model.md maps the canonical layers to each project with clear ownership boundaries and explicit current-state versus target-state labeling
- the documentation does not assign runtime, rendering, or orchestration ownership to the wrong project
- follow-up tasks or open questions are captured for unresolved cross-repo contract changes
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Implementation plan
- Write the ADR first as the normative source of truth for the shared architecture model
- Refactor the shared architecture model doc to become an explanatory companion to the ADR, not a second competing source of truth
- Call out ownership boundaries for FAS, actor-web, ignite-element, and Blueprint, including what each layer must not own
- Record any unresolved repo-external assumptions as open questions or follow-up tasks instead of hard-coding them into the ADR


## Verification plan
- Review the ADR and shared model for internal consistency and boundary correctness
- Run pnpm docs:build after the documentation changes land
- Confirm any current-state claims are grounded in this repo and any target-state claims are labeled as such

## Risks
- The current shared model may blur runtime execution, workflow policy, and UI projection into adjacent layers
- Cross-repo projects like actor-web and Blueprint are not present in this workspace, so target-state claims can drift into speculation if not labeled carefully
- FAS task state was previously pointed at an unrelated debug investigation, so this task must remain scoped to the new architecture brief and docs only


## Dependencies
- docs/adr-003-shared-arc.md
- docs/shared-architecture-model.md
- AGENTS.md
- CLAUDE.md
- .fas/AGENTS.md
- .fas/WORKFLOW.md


## Open questions
- Which parts of the shared model describe current ignite-element/FAS reality versus desired cross-repo alignment?
- Should the shared model include a topology diagram, an ownership matrix, or both as the durable artifact?
- Do we want repo-specific follow-up tasks created immediately for actor-web, Blueprint, or FAS contract alignment once the ADR is written?


## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/review-summary.md`
- Workflow: `.fas/state/workflows/`
