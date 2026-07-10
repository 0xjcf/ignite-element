# Add rendered DOM accessibility verification for Ignite examples

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
Add rendered-DOM accessibility verification after the dynamic projection workbench exists. Prove that native JSX rendering of validated semantic ProjectionDocument nodes realizes keyboard operation, focus behavior, accessible names/descriptions, roles, disabled/busy/error states, validation relationships, command-backed actions, and intentional speech/live-region behavior where relevant. Cover representative existing examples plus the voice/text control-center without making top-level examples workspace members.


## Acceptance criteria
- Rendered tests cover accessible native mappings for representative projection nodes and existing examples.
- Command-backed action nodes expose correct names, disabled states, and keyboard activation based on runtime availability.
- Form, validation, status, dialog/focus, and live-region behavior is verified in a browser-capable environment where used.
- The thermostat `SAVE_FAILURE` flow keeps focus on the triggering control and exposes its asynchronous error through a dedicated assertive live region such as `role="alert"`.
- Voice-only projection remains DOM-free and is validated through the injected speech adapter rather than DOM assertions.
- Headless contract checks are not presented as browser accessibility proof.
- Existing example runtime-lane ownership remains intact.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- examples
- scripts/test-examples.mjs
- .github/workflows/ci.yml
- docs/site/src/content/docs/guides/accessibility-first.mdx

## Scope Amendments
- None.

## Implementation plan
- Select representative projection nodes and existing example flows with the highest accessibility risk.
- Add browser-capable role/name/keyboard/focus/live-region assertions using existing test infrastructure.
- Perform visual and interactive validation of the command-center dashboard.

## Verification plan
- Run focused rendered example tests and the example runtime lane.
- Create or refresh the final review summary artifact before task completion.
- Run the epic shared full verification and CodeRabbit review at closeout.

## Risks
- Avoid brittle DOM snapshots and implementation-detail selectors.
- Avoid treating model-authored copy as sufficient accessible naming without renderer validation.

## Dependencies
- Depends on task-1783613728381.
- Blocks task-1783610965770.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
