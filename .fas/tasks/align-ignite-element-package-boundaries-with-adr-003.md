# align ignite-element package boundaries with ADR-003

## Source
Updated with `fas edit-task` on 2026-04-19.

## Problem
Align ignite-element package ownership with ADR-003 so ignite-element is the sole assembly/authoring surface, ignite-core becomes contract-only, ignite-adapters become adapter-integration-only, and FAS workflow/boundary enforcement reflects the actual package-family model. Keep ignite-element itself standalone and keep ignite-element/xstate, ignite-element/redux, and ignite-element/mobx stable while removing old advanced authoring APIs from ignite-core and ignite-adapters now.



## Acceptance criteria
- ignite-core contains only contract-level primitives and no longer owns projection/effect assembly
- ignite-element owns the only assembly path and keeps ignite-element/xstate, ignite-element/redux, and ignite-element/mobx stable
- ignite-adapters no longer own authoring or projection assembly and legacy ignite-store artifacts remain non-authoritative
- FAS workflow surfaces, task metadata, and architecture enforcement reflect the post-refactor package boundaries
- pnpm test, pnpm typecheck, pnpm build, pnpm docs:build, fas validate-task, and .fas/scripts/verify.sh --full pass
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Implementation plan
- Normalize FAS workflow surfaces for Codex 6-agent execution, set the task mode to 6-agent, and ensure review artifacts point to review-summary.md
- Move projection and effect assembly ownership out of ignite-core and keep only adapter-neutral contracts, event/effect typing, and small utilities there
- Make ignite-element the sole assembly path by consolidating IgniteCore.ts, createComponentFactory.ts, and igniteCore entry wrappers into one internal assembly stack and wiring public adapter subpaths directly from ignite-adapters factories and types
- Reduce ignite-adapters to adapter factories, source guards, source-specific config/types, and command-actor typing while removing projection-authoring builders
- Update architecture rules, package docs, legacy docs, and migration notes to match the breaking cleanup for advanced consumers


## Verification plan
- Run fas validate-task after each major phase
- Run targeted package tests and typechecks while refactoring core, element, and adapters
- Add or update coverage for ignite-element/xstate, ignite-element/redux, and ignite-element/mobx package entry behavior and migrate tests away from legacy internal wrappers
- Run pnpm test, pnpm typecheck, pnpm build, pnpm docs:build, and .fas/scripts/verify.sh --full before final review
- Finish with readonly QA, SRE, and reviewer passes using Codex subagents

## Risks
- Moving assembly out of ignite-core can break advanced consumers if exports or migration notes are incomplete
- Consolidating element assembly paths can regress headless runtime behavior or DOM event timing if tests are not retargeted carefully
- Boundary rules can drift from the real codebase if .fas-config.json or .fas/architecture-rules.json are updated before the code move is complete
- The repo currently has dirty ADR/FAS files in scope and they must be incorporated rather than overwritten


## Dependencies
- docs/adr-003-shared-arc.md
- docs/shared-architecture-model.md
- .fas-config.json
- .fas/architecture-rules.json
- AGENTS.md
- CLAUDE.md
- .fas/WORKFLOW.md
- packages/ignite-core
- packages/ignite-adapters
- packages/ignite-element


## Open questions
- Treat the breaking cleanup of old ignite-core and ignite-adapters authoring APIs as approved for this task
- Leave autonomyPolicy.runtimeMode unchanged in this task unless implementation uncovers a direct blocker


## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/review-summary.md`
- Workflow: `.fas/state/workflows/`
