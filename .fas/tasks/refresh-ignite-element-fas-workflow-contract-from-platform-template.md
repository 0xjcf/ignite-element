# Refresh ignite-element FAS workflow contract from platform template

## Goal

Review and intentionally sync `.fas/WORKFLOW.md` with the current platform workflow template while preserving any repo-local context that still matters.

## Evidence

- `fas status` reports `.fas/WORKFLOW.md` drift against `../FAS/templates/WORKFLOW.md`.
- The platform template includes current spike-phase, setup-prerequisite, planner orchestration, and delegated checkpoint guidance that the local file lacks.

## Scope

- Compare `.fas/WORKFLOW.md` against `../FAS/templates/WORKFLOW.md`.
- Update only the workflow contract and related tracker metadata.
- Do not alter product source code.

## Acceptance Criteria

- Drift is either resolved or documented as intentional with clear repo-local rationale.
- The local workflow mentions current setup, memory, spike, and delegated checkpoint expectations.
- Focused markdown and status checks pass.

## Recommended Mode

single-agent

## Recommended Phase

closeout
