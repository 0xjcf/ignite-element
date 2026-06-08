# Docs: canonical getSnapshot/watchSnapshot/view names + depre

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike: .fas/state/spikes/agent-runtime-api-review.md (T4, depends on T1+T2). Update live v3 docs to canonical names with a short deprecation aside per page: api/headless-runtime.mdx (methods table, frontmatter description, examples — getState->getSnapshot, watch->watchSnapshot), api/ignite-core.mdx (config view; mark states deprecated), concepts/the-ignite-model.mdx, getting-started/first-component.mdx, guides/agent-runtime-v3.mdx, overview/what-is-ignite-element.mdx. In api/testing-dsl.mdx add a one-line note that the assertion 'state' vocabulary (given/expectState) is intentional and distinct from getSnapshot. Keep execute() result destructure as { state, events }. DO NOT edit docs/site/src/content/docs/2.x/** (frozen v2 archive).

## Automation admission
- Expected operator value: Improves operator leverage around "Docs: canonical getSnapshot/watchSnapshot/view names + deprecation asides" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- live v3 docs use getSnapshot/watchSnapshot/view canonically
- each touched page notes the deprecated alias
- 2.x archive untouched
- doc code examples still typecheck under check-doc-examples
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
- docs/site/src/content/docs/api/headless-runtime.mdx
- docs/site/src/content/docs/api/ignite-core.mdx
- docs/site/src/content/docs/concepts/the-ignite-model.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- docs/site/src/content/docs/getting-started/first-component.mdx
- docs/site/src/content/docs/overview/what-is-ignite-element.mdx
- docs/site/src/content/docs/api/testing-dsl.mdx

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
