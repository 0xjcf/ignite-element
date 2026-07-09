# Document projection runtime, accessibility-first, and non-visual patterns

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
After the design, guardrails, headless assertions, projection workbench, and example validation are in place, publish the projection runtime/accessibility-first/non-visual interface DX docs. The guide should teach ProjectionRequest, ProjectionSpec, ProjectionInstance, projection registry/selection, native-first markup, when ARIA is appropriate, how behavior metadata powers headless tests, voice/agent/non-visual interfaces, when to run DOM checks, and how actor-web behavior graph alignment fits without implying DOM scraping or raw generated UI.

## Acceptance criteria
- Docs include concise projection runtime, accessibility-first, and non-visual interface guidance for Ignite Element v3.
- Examples show native-first implementation before ARIA-heavy patterns.
- Docs explain headless behavior-contract assertions and rendered DOM verification separately.
- Docs connect ProjectionRequest/ProjectionSpec and behavior metadata to voice, agent, and assistive/non-visual runtime use without implying DOM scraping or raw generated UI.
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
- docs/site/src/content/docs/guides/accessibility-first.mdx
- docs/projection-runtime.md
- docs/site/src/content/docs/concepts
- README.md
- examples

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
