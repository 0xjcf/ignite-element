# Accuracy pass on v3 docs examples (effects/view/select consi

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
The v3 docs are substantially accurate against the real API, but the example code has consistency problems and one real bug. BUG: guides/agent-runtime-v3.mdx line 32 does view: ({ context }) => ({ ..., isLimited: snapshot.matches('limited') }) but snapshot is not destructured, so it is a ReferenceError and will not typecheck. CONSISTENCY: effects are taught in two different signatures across pages — positional (snapshot, prevSnapshot, ctx) (first-component, api/ignite-core, testing, platform-contracts) and object-form ({ snapshot, prevSnapshot, emit, select }) (events-and-commands, agent-runtime-v3, migration/effects-events). Both are valid (FacadeEffectsLike) but mixing them unexplained confuses learners. Also snapshot.x vs snapshot.context.x and select param naming (state vs snapshot) are used interchangeably; the underlying 'context fields are spread onto the snapshot' ergonomic is never documented explicitly. Depends on the docs code-block guardrail so the full set of errors is surfaced and the fixes are verified.

## Acceptance criteria
- The docs code-block guardrail passes on all current v3 doc examples; every error it surfaces is fixed, starting with agent-runtime-v3.mdx line 32 (destructure snapshot or use a context-based field)
- Effects examples are standardized to ONE canonical signature across all v3 pages (decide positional vs object; object form recommended for consistency with the view/commands object style) — or both forms are documented once with an explicit note
- The context-fields-spread-onto-snapshot ergonomic is documented explicitly in one place and linked, so snapshot.x usage and select/param naming are consistent and intentional
- No signature drift: every shown signature matches the real exports
- Only current v3 docs are edited; the frozen 2.x archive is untouched
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx

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
