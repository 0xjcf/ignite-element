# Spike: v3 docs IA audit — target page map, redundancy matrix

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Read-only information-architecture spike for the live v3 (beta) docs. v3 beta is deployed; the operator wants improvements covering styling, redundancy, per-page content/display, a better 'Lifecycle at a glance' diagram, exposing ignite.config.ts in advanced config, fewer pages, and trimming bloat. Optimize the TARGET docs for two audiences: (1) a developer with zero ignite-element experience — a clear golden path with progressive disclosure, pleasant to read; (2) AI agents — single source of truth per fact, predictable contract-first reference, no bloat or cross-page contradictions. Adopt a Diataxis structure (Tutorial / How-to / Reference / Explanation) and the principle 'one concept = one canonical page'. This is the keystone Phase 1 of a 4-phase initiative (Discover -> Restructure -> Polish content per-page -> Design+agent layer); its output drives all downstream implementation briefs. Do NOT edit docs/site content or package source in this task: it is READ-ONLY and produces a spike report plus drafted+queued downstream briefs only. Current v3 surface (~27 pages): index; overview/what-is-ignite-element; getting-started/{installation,first-component,project-setup}; concepts/{state-adapters,renderers,events-and-commands,configuration}; api/{ignite-core,headless-runtime,command-metadata,testing-dsl,define-ignite-config,renderers}; guides/{host-app-integration,platform-contracts,agent-runtime-v3,redux-and-mobx,actor-web,styling,testing,tooling}; migration/{v3,effects-events,v2}; community. Memory to read first: docs-design-audit-approach (audit in LAYERS — design-system once, UX per moment, contrast via CI guardrail; do NOT couple shared styling per page), docs-code-example-guardrail, docs-site-versioning (edit current/v3 docs only; never the frozen 2.x archive).

## Acceptance criteria
- READ-ONLY: no edits to docs/site content or package source in this task; the only outputs are the spike report and new task briefs / queue entries
- A page-by-page mapping of every current v3 doc page to a target home (keep / trim / merge / delete) under a Diataxis structure (Tutorial/How-to/Reference/Explanation), recorded in a spike report at .fas/state/spikes/v3-docs-ia-audit.md
- A redundancy matrix: each duplicated fact/concept across pages, with its single canonical owner page identified
- A proposed final page map (lean target with rationale and target page count) for operator sign-off, including consolidating the ignite.config.ts / advanced-config story into ONE advanced-config reference page, and the agent layer (llms.txt + contract-first reference normalization)
- Confirm the downstream-blocking tooling facts: whether Starlight has Mermaid wired (for the Lifecycle diagram) and how an llms.txt would be generated and served
- Drafted and queued downstream implementation briefs (IA restructure; per-surviving-page content trims; design-system styling; lifecycle diagram; agent layer) with dependsOn chains so restructure precedes per-page trims and the styling pass can run in parallel
- Every recommendation optimizes for BOTH a zero-experience developer (clear golden path, progressive disclosure, pleasant to read) and AI agents (single source of truth, predictable contract-first reference, no bloat or contradictions)
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .fas/state/spikes/v3-docs-ia-audit.md

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
