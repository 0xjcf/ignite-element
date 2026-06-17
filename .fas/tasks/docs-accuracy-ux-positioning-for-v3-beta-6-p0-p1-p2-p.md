# Docs accuracy + UX + positioning for v3 beta.6 (P0/P1/P2). P

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Docs accuracy + UX + positioning for v3 beta.6 (P0/P1/P2). P0 (CORRECTNESS — beta.6 behavior change): the shared-source ownership fix in 3.0.0-beta.6 changed cleanup semantics but the docs-site prose still teaches the OLD beta.5 default. New behavior: cleanup defaults to FALSE for shared (consumer-owned) sources — a live instance passed to igniteCore (started actor / store / observable / actor-web source) lives for the core's lifetime and is NOT released when the element refcount hits zero; isolated (ignite-created) sources keep per-element teardown. Adapters never stop/close a source they did not create (generalized ownsActor -> ownsSource; ActorWebAdapter no longer closes consumer-owned sources). Update to the new semantics and drop now-redundant 'cleanup: false' guidance (reframe 'cleanup: true' as the opt-in to refcount teardown for shared cores) in: docs/site/src/content/docs/concepts/the-ignite-model.mdx (~17,45,225,226); docs/site/src/content/docs/api/ignite-core.mdx (~32,40,45); docs/site/src/content/docs/guides/routing.mdx (~165); docs/site/src/content/docs/migration/v2.mdx (~19,89,90,96); docs/site/src/content/docs/getting-started/first-component.mdx (~87); docs/site/src/content/docs/guides/testing.mdx (~135). DO NOT edit archived docs/site/src/content/docs/2.x/** (frozen). P1 (UX): add a /guides/ index landing page — currently 404 (Starlight has no guides index; individual guides are live, e.g. /guides/routing/ = 200); add a landing page linking the seven guides. P2 (positioning + agent angle): (a) add a 'When to choose Ignite / Comparisons' page surfacing existing positioning from /overview/what-is-ignite-element/ (distribution layer vs framework; renderer-agnostic; no state-lib lock-in); (b) deepen getSchema() docs with example output and how agents/LLMs consume it for tool-calling/validation. CONSTRAINTS: respect docs guardrails — markdownlint, the Playwright AA-contrast check (docs/site/scripts/check-contrast.mjs), and the doc code-example typecheck (check-doc-examples.mjs; object-form effects, no manual igniteCore<...> args); verify with the docs build. Source of truth for new behavior: packages/ignite-element/src/IgniteElementFactory.ts (cleanup default), packages/ignite-adapters/src/adapters/{XStateAdapter,ActorWebAdapter}.ts (ownsSource), and TSDoc on igniteCore/createIgniteComponentFactory.ts + igniteCore/types.ts.

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
