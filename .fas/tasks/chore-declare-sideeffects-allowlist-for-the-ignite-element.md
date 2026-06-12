# chore: declare sideEffects allowlist for the ignite-element 

## Source
Created with `fas create-task` on 2026-06-12.

## Problem
Pre-stable-v3 audit finding F7. packages/ignite-element/package.json has no sideEffects declaration while src/index.ts:1 performs a side-effectful 'import "./internal/setupDomPolyfill"'. Sibling packages declare it (@ignite-element/core and /adapters: false; @ignite-element/renderer: an allowlist array). Consequence today: bundlers cannot tree-shake the main package; latent risk: a future 'sideEffects: false' cleanup would silently drop the DOM polyfill and break SSR/Node consumers. Add an allowlist mirroring the renderer package's pattern — verify the built dist chunk layout first so the glob matches the chunk that actually carries the polyfill side effect (check dist/ output names for the es/cjs builds before choosing the glob).

## Acceptance criteria
- sideEffects allowlist added to packages/ignite-element/package.json covering the polyfill chunk in both es and cjs builds
- a bundler-level test or assertion proves the polyfill survives tree-shaking
- entrypoints test lane stays green
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
- Scope unknown.

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
