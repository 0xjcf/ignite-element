# SPIKE (read-only, discussion/decision): evaluate the non-eng

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
SPIKE (read-only, discussion/decision): evaluate the non-engineering / go-to-market polish items from the v3 beta review and decide which to pursue and how. Cover: (1) a CLI scaffolder / project generator ('create-ignite-element' style) — worth building? what would it scaffold? alternatives (degit template, docs copy-paste); scope + ROI. (2) StackBlitz/CodeSandbox embeds for the examples (esp. spa-router) — feasibility given the source-alias monorepo setup vs the published @beta package; recommend an approach. (3) a demo video / screencast — outline a short script and what it should show (headless execute + agent angle). (4) an 'Ignite Element for AI Agents' one-pager — positioning + outline. OUTPUT: a recommendation per item (do now / defer / drop) with rationale + rough effort, plus follow-up task briefs for anything greenlit. Do NOT implement during the spike — these are partly marketing/non-code.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
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
- .fas/TASKS.md
- .fas/queue/tasks.json
- .fas/tasks/docs-add-ignite-element-for-ai-agents-one-pager-before-v3-st.md
- .fas/tasks/docs-demo-write-v3-headless-execute-and-smart-home-agent-scr.md
- .fas/tasks/playgrounds-add-published-package-open-in-stackblitz-links-a.md

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
