# v3 docs polish: collapse concepts into one 'The Ignite model

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 2 restructure. Create ONE explanation page 'The Ignite model' (repurpose concepts/state-adapters): ownership, adapters, projection (view), commands/events/effects, lifecycle. Absorb concepts/events-and-commands (conceptual parts) + the conceptual halves of concepts/renderers + concepts/configuration. Move the ~72-line Actor-Web example OUT to guides/actor-web; move reference detail to api/*. Replace the ASCII 'Lifecycle at a glance' with a hand-authored inline SVG (theme-aware, NO Mermaid dep). The 'deterministic effects semantics' fact becomes canonical HERE (its duplicate copies in api/ignite-core + api/headless-runtime are removed in the guides-vs-reference task). Lean explanation only, no reference dumping. Update sidebar. Only current v3 docs; examples pass the guardrail. Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- One concept page ('The Ignite model') is the canonical explanation of adapters/ownership, view/projection, commands-events-effects, and lifecycle
- concepts/events-and-commands, concepts/renderers, concepts/configuration are merged in or reduced to pointers; no concept page duplicates an api/* reference page
- The 'Lifecycle at a glance' ASCII is replaced by a hand-authored, theme-aware inline SVG (no Mermaid/build dep) that passes the contrast guardrail
- Sidebar updated; doc examples pass the guardrail; docs:build green
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/concepts/the-ignite-model.mdx
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
