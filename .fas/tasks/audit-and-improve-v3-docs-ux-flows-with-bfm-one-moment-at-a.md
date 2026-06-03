# Audit and improve v3 docs UX flows with BfM, one moment at a time

## Source
Created with `fas create-task` on 2026-06-02.

## Problem
After the design-system pass (Task: make docs theme token-driven) establishes consistent shared components, audit the v3-beta docs by UX MOMENT/FLOW rather than per screen, using Built for Mars (BfM) journey patterns as reference and walking each flow end-to-end in both themes. This task is about journey/affordance/content quality, not styling: any visual fix lands at the design-system/component layer, and flow-specific components compose from the established tokens. Run one moment at a time so each finding is acted on before moving to the next. BfM corpus is app-product UX, so value is concentrated in the few real docs moments below.

## Acceptance criteria
- Landing to 'try the v3 beta' CTA is audited against demo/escape-route patterns: clear, low-friction entry to the beta
- Getting-started funnel (install -> first component -> project setup) is progressive with no dead-ends or drop-off traps
- Version discovery/switching (2.x <-> v3 beta picker) is discoverable and switching keeps the reader oriented
- Migration journey (v2 -> v3) reduces upgrade anxiety with clear before/after framing
- Search -> find -> land (Pagefind/Ask) returns relevant results and is legible in both themes
- Each moment is audited one-at-a-time with a recorded BfM-informed finding and a concrete change; styling changes are deferred to the design-system task
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/index.mdx
- docs/site/src/content/docs/getting-started
- docs/site/astro.config.mjs

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
- Runs AFTER the design-system pass (Make the docs site theme token-driven) so flows compose from a consistent, finalized component set
- Visual/styling fixes are deferred to that design-system task; this task covers journey, affordance, and content only

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
