# Docs accuracy + UX + positioning for v3 beta.6 (P0/P1/P2). P0 (CORRECTNESS — beta.6 behavior change): the shared-source ownership fix in 3.0.0-beta.6 changed cleanup semantics but the docs-site prose still teaches the OLD beta.5 default. New behavior: cleanup defaults to FALSE for shared (consumer-owned) sources — a live instance passed to igniteCore (started actor / store / observable / actor-web source) lives for the core's lifetime and is NOT released when the element refcount hits zero; isolated (ignite-created) sources keep per-element teardown. Adapters never stop/close a source they did not create (generalized ownsActor -> ownsSource; ActorWebAdapter no longer closes consumer-owned sources). Update to the new semantics and drop now-redundant 'cleanup: false' guidance (reframe 'cleanup: true' as the opt-in to refcount teardown for shared cores) in: docs/site/src/content/docs/concepts/the-ignite-model.mdx (~17,45,225,226); docs/site/src/content/docs/api/ignite-core.mdx (~32,40,45); docs/site/src/content/docs/guides/routing.mdx (~165); docs/site/src/content/docs/migration/v2.mdx (~19,89,90,96); docs/site/src/content/docs/getting-started/first-component.mdx (~87); docs/site/src/content/docs/guides/testing.mdx (~135). DO NOT edit archived docs/site/src/content/docs/2.x/** (frozen). P1 (UX): add a /guides/ index landing page — currently 404 (Starlight has no guides index; individual guides are live, e.g. /guides/routing/ = 200); add a landing page linking the seven guides. P2 (positioning + agent angle): (a) add a 'When to choose Ignite / Comparisons' page surfacing existing positioning from /overview/what-is-ignite-element/ (distribution layer vs framework; renderer-agnostic; no state-lib lock-in); (b) deepen getSchema() docs with example output and how agents/LLMs consume it for tool-calling/validation. CONSTRAINTS: respect docs guardrails — markdownlint, the Playwright AA-contrast check (docs/site/scripts/check-contrast.mjs), and the doc code-example typecheck (check-doc-examples.mjs; object-form effects, no manual igniteCore<...> args); verify with the docs build. Source of truth for new behavior: packages/ignite-element/src/IgniteElementFactory.ts (cleanup default), packages/ignite-adapters/src/adapters/{XStateAdapter,ActorWebAdapter}.ts (ownsSource), and TSDoc on igniteCore/createIgniteComponentFactory.ts + igniteCore/types.ts.

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Current HEAD already contains the beta.6 shared-source cleanup documentation and the /guides/ index. Complete the remaining docs-only P2 scope: add a dedicated overview page for “When to choose Ignite / Comparisons”, wire it into the sidebar and overview entry point, and deepen the agent-facing getSchema() documentation with concrete schema output plus tool-calling, validation, and canExecute guidance. Do not edit archived docs under docs/site/src/content/docs/2.x/**, runtime source, adapter source, test files, or docs scripts unless verification proves they are broken.


## Acceptance criteria
- The new When to choose Ignite / Comparisons page exists under overview and is discoverable from the Overview sidebar.
- The What is Ignite Element overview links readers to the new decision/comparison page.
- The Headless runtime getSchema section includes concrete schema output and explains agent/LLM usage for tool selection, payload shaping, validation, canExecute checks, execute results, and observers.
- Command metadata and Build for agents docs provide supporting links/context without duplicating the canonical getSchema contract.
- Archived docs, runtime/source/adapter files, test files, and docs scripts remain untouched unless verification proves a defect.
- Docs guardrails pass: markdownlint, docs code-example check, docs build, contrast check, and fas validate-task.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/overview/when-to-choose-ignite.mdx
- docs/site/src/content/docs/overview/what-is-ignite-element.mdx
- docs/site/astro.config.mjs
- docs/site/src/content/docs/api/headless-runtime.mdx
- docs/site/src/content/docs/api/command-metadata.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx

## Scope Amendments
- Type: narrow-current-head-docs-scope
- Added at: 2026-07-07
- Trigger: Architect and staff handoffs found stale generated commit plan after PR87 merged.
- Reason: The original task included P0 cleanup docs and P1 guides index work already present in current HEAD; remaining work is P2 docs positioning and agent-facing getSchema guidance.
- Added paths: docs/site/src/content/docs/overview/when-to-choose-ignite.mdx, docs/site/src/content/docs/overview/what-is-ignite-element.mdx, docs/site/astro.config.mjs, docs/site/src/content/docs/api/headless-runtime.mdx, docs/site/src/content/docs/api/command-metadata.mdx, docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- Evidence source: fas_architect and fas_staff_engineer handoffs
- Evidence: fas_architect and fas_staff_engineer handoffs | .fas/state/commit-plan.json | Generated plan targeted packages/ignite-element/src/tests/IgniteCore.test.ts and docs/site/scripts/check-contrast.mjs, while actual remaining scope is docs content/sidebar files.
- Accuracy signal: Current docs contain beta.6 cleanup semantics and docs/site/src/content/docs/guides/index.mdx exists.
- Follow-up needed: Regenerate active task scope and commit plan before spawning fas_senior_engineer.

## Implementation plan
- Add a dedicated overview/when-to-choose-ignite.mdx comparisons page focused on decision criteria and positioning.
- Add sidebar discoverability and a concise link from the existing overview page.
- Deepen the canonical getSchema() docs and supporting agent-runtime/command-metadata pages without duplicating runtime contracts.

## Verification plan
- fas validate-task
- pnpm lint:md
- pnpm --filter docs-site run check:docs
- pnpm --filter docs-site run check:contrast
- pnpm docs:build
- .fas/scripts/verify.sh --full at branch closeout

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
