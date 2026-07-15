# Dogfood provider-neutral external capability federation in the generic voice and text workbench

## Source
Created with `fas create-task` on 2026-07-14.

## Problem
Follow up the completed LLM-authored voice/text workbench with a provider-neutral capability layer. Keep the workbench generic across every supported semantic ProjectionDocument node; use source-backed shopping-price research and budget/chart composition as the golden-path acceptance scenario. Compose availability-scoped igniteTools(component) commands with reusable configured external capability providers, route every call to its owning runtime, preserve actor authorization and execution receipts, and do not add new igniteCore configuration, public inspect APIs, or self-authorizing model code. Dogfood the contract inside the example before recommending any public federation API.

## Acceptance criteria
- A model turn can see a collision-safe, availability-scoped manifest composed from the workbench component and one or more reusable external capability providers.
- External capability calls route to their owning provider and return structured success, unavailable, validation, timeout, and failure facts without granting the model arbitrary network or code execution.
- The generic workbench can still create and revise any supported semantic node composition; shopping-price lookup demonstrates sourced list, table, budget, and chart output without shopping-specific Ignite core behavior.
- When no web/product capability is configured, the model is explicitly grounded that lookup is unavailable and cannot promise future research.
- Deterministic headless tests use a fake capability provider; the optional live local path keeps credentials server-side and remains launchable through the example's single command.
- No new igniteCore surface ships from this task; any proposed public igniteTools federation API is an evidence-backed follow-up after dogfood.
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
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/capability-federation.ts
- examples/agents/voice-workbench/src/capability-federation.test.ts
- examples/agents/voice-workbench/src/web-search-capability.ts
- examples/agents/voice-workbench/src/web-search-capability.test.ts
- examples/agents/voice-workbench/server/brave-web-search.ts
- examples/agents/voice-workbench/server/brave-web-search.test.ts
- examples/agents/voice-workbench/vite.config.test.ts
- examples/agents/voice-workbench/src/agent-loop.test.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/src/contrast.test.ts
- examples/agents/voice-workbench/vite.config.ts
- .fas/memory/integrations.md
- examples/agents/voice-workbench/.env.example
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md
- examples/agents/voice-workbench/src/parity.test.tsx

## Scope Amendments
- Type: execution-scope-refinement
- Added at: 2026-07-14T14:00:00Z
- Trigger: Architect and staff-engineer boundary review found the generated seven-file scope incomplete and included unrelated domain/session/launcher files.
- Reason: Federation, server adapter, Vite boundary, UI source-link proof, and focused tests are required; domain.ts, session.ts, and dev-with-mlx.mjs need no behavior changes.
- Added paths: examples/agents/voice-workbench/src/capability-federation.ts, examples/agents/voice-workbench/src/capability-federation.test.ts, examples/agents/voice-workbench/src/web-search-capability.ts, examples/agents/voice-workbench/src/web-search-capability.test.ts, examples/agents/voice-workbench/server/brave-web-search.ts, examples/agents/voice-workbench/server/brave-web-search.test.ts, examples/agents/voice-workbench/vite.config.test.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/src/styles.ts, examples/agents/voice-workbench/src/contrast.test.ts, examples/agents/voice-workbench/vite.config.ts
- Evidence source: fas_staff_engineer handoff
- Evidence: fas_staff_engineer handoff | .fas/state/agent-execution.json | Exact execution brief locks example-local provider federation, Brave server adapter, combined MLX manifest, offline grounding, generic sourced projections, and four incremental commits.
- Accuracy signal: high: confirmed against current voice-workbench host and test boundaries
- Follow-up needed: Do not promote a public igniteTools federation API until this dogfood produces review evidence.

- Type: review-closeout-documentation
- Added at: 2026-07-14T16:15:00Z
- Trigger: Final reviewer required a durable integration contract entry for the new Brave capability boundary.
- Reason: Record ownership, credential isolation, request/evidence limits, error-as-data behavior, offline degradation, and provider-quality limitations before closeout.
- Added paths: .fas/memory/integrations.md
- Evidence source: fas_reviewer handoff
- Evidence: fas_reviewer handoff | .fas/state/agent-execution.json | No source defects; integration memory and fresh verification receipts are the only remaining no-ship concerns.
- Accuracy signal: high: confirmed against f48f292c and final QA/SRE approvals
- Follow-up needed: Use dogfood evidence before considering any public igniteTools federation API.

- Type: review-follow-up
- Added at: 2026-07-14T16:35:00Z
- Trigger: Operator placed BRAVE_SEARCH_API_KEY in the example-local .env.local and requested restart readiness.
- Reason: Vite config currently reads process.env before Vite env files are loaded; explicitly load the example-local env directory while preserving server-only secret handling.
- Added paths: examples/agents/voice-workbench/.env.example, examples/agents/voice-workbench/vite.config.ts, examples/agents/voice-workbench/vite.config.test.ts, examples/agents/voice-workbench/README.md
- Evidence source: operator restart request
- Evidence: operator restart request | examples/agents/voice-workbench/vite.config.ts | Add loadEnv-based resolution, committed placeholder .env.example, regression coverage, and launch documentation. Never read or commit .env.local.
- Accuracy signal: high: verified current Vite config reads only process.env and root ignore covers *.local
- Follow-up needed: Re-run focused example verification and refresh review evidence.

- Type: live-acceptance-gap
- Added at: 2026-07-14T18:05:50Z
- Trigger: Live Whole Foods Sarasota shopping-price prompt completed with generic store links while the accepted artifact retained only plain checklist labels.
- Reason: A sourced-research turn must materialize evidence-backed per-item facts in the semantic artifact, or explicitly represent that item prices were not found; completion copy must not overstate research.
- Added paths: examples/agents/voice-workbench/src/agent-loop.ts, examples/agents/voice-workbench/src/agent-loop.test.ts, examples/agents/voice-workbench/src/workbench-agent.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/README.md
- Evidence source: operator live browser acceptance
- Evidence: operator live browser acceptance | /Users/joseflores/Library/Application Support/CleanShot/media/media_Iz45mVTFcF/CleanShot 2026-07-14 at 14.05.50@2x.png | Prompt requested eggs, bread, butter, coffee, and milk prices. Search returned store/flyer pages, response claimed price information was found, and the artifact contained only unpriced checklist labels.
- Accuracy signal: high: directly reproduced in the live configured workbench
- Follow-up needed: TDD the generic evidence-to-artifact completion contract; prefer existing semantic node composition and only expand checklist item shape if current schema already supports generic secondary text or architecture review justifies it.

- Type: operator-review-correction
- Added at: 2026-07-14T22:03:00-04:00
- Trigger: The live responding modal still displayed a one-pass "Model proposing commands" pipeline after the actor had already accepted artifact revision 1 and the next completion request was pending.
- Reason: The MLX loop is iterative; the modal must project the latest authoritative actor outcome and the pending model or capability round instead of implying that actor validation has not occurred.
- Added paths: examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx
- Evidence source: operator live browser acceptance
- Evidence: operator live browser acceptance | /Users/joseflores/Library/Application Support/CleanShot/media/media_qguyteeJXI/CleanShot 2026-07-14 at 21.58.24@2x.png | The current actor fact was artifact-created revision 1 while the modal still showed model proposal active and actor validation pending.
- Accuracy signal: high: directly visible in the configured workbench and reproduced by the JSX projection test
- Follow-up needed: The next right-rail task should expose finer-grained live model, capability, and actor phases without adding imperative view state.

- Type: generated-context-projection-alignment
- Added at: 2026-07-14T22:08:00-04:00
- Trigger: FAS closeout classified five ignored project memory projections as task-reference changes after implementation scope was already fully aligned.
- Reason: Treat the ignored FAS memory projections as explicit reference context for closeout provenance; they are not product source changes and must not be committed.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: fas validate-task closeout readiness
- Evidence: fas validate-task closeout readiness | .fas/state/closeout-readiness/latest.json | Implementation scope remained 23 planned and 23 implemented with zero unexpected or missing files; only ignored .fas/memory references held closeout.
- Accuracy signal: high: confirmed by git status --ignored and closeout planAlignmentSummary
- Follow-up needed: FAS should classify ignored memory projections as generated context without requiring explicit product scope.

- Type: verification-discovered-test-dependency
- Added at: 2026-07-14T22:10:00-04:00
- Trigger: Full verification reproduced a stale production-parity assertion for the corrected responding-modal title.
- Reason: Update the existing parity contract to assert the truthful iterative-turn status instead of the removed one-pass authoring label.
- Added paths: examples/agents/voice-workbench/src/parity.test.tsx
- Evidence source: fas verify --full
- Evidence: fas verify --full | .fas/state/verification/latest.log | src/parity.test.tsx expected Authoring the semantic artifact after the projection changed to Completing the authorized turn.
- Accuracy signal: high: reproduced with the isolated parity test
- Follow-up needed: none

## Implementation plan
- Add a pure, collision-safe provider federation core and deterministic fake-provider tests.
- Add a server-owned Brave Web Search adapter and same-origin Vite capability route without exposing credentials.
- Federate component and external tools through the MLX loop with correlated fact and receipt feedback plus explicit offline grounding.
- Present sourced generic tables and accessible charts, document the one-command flow, and retain every existing semantic ProjectionDocument node.

## Verification plan
- Run focused Vitest red-green lanes for federation, adapters, MLX loop, host wiring, and projections.
- Run the voice-workbench test, browser test, typecheck, and build lanes.
- Run launcher regression coverage and manual acceptance with and without BRAVE_SEARCH_API_KEY.
- Run fas validate-task and .fas/scripts/verify.sh --full.

## Risks
- Live Brave availability and credentials are optional; deterministic fake-provider tests and the no-provider path remain authoritative.
- Tool-name collisions or stale availability could misroute calls; rebuild and validate the owner index each model round.
- Untrusted source URLs must render safely and external facts must never directly mutate actor state.

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
