# additive (agent API): add igniteTools(component) — derive an LLM tool manifest from getSchema().commands (name + input s

## Source
Created with `fas create-task` on 2026-06-21.

## Problem
igniteTools PR 1 of 3 — hexagonal CORE + PORT + FAKE dialect (TDD; NO provider SDK). Build: (1) FUNCTIONAL CORE (pure) — buildManifest(getSchema()) -> NeutralManifest [{name,description,inputSchema,gated}]; resolveCall(name,input) -> Result<Route,ToolError> (validate input vs inputSchema + canExecute gating; ERRORS AS VALUES, never throw). (2) The PORT ToolDialect { toToolDefs(manifest); parseToolCalls(resp); toToolResult(result) }. (3) The IMPERATIVE SHELL invoke(toolCall) -> Promise<Result<{snapshot,events},ToolError>> (the single execute() side-effect; may reach a remote actor). New entrypoint `ignite-element/tools`; igniteTools(component, dialect?) — neutral core usable directly, a dialect shapes tools/parse/result. TDD against a FAKE component + FAKE dialect (zero LLM calls). DDD: pure core / shell-only I/O / errors-as-values. NO provider SDK here — real adapters are PR 2 (anthropic) + PR 3 (openai, covers Codex + Ollama via OpenAI-compat). Hexagonal design: docs/ignite-tools.md. Builds on typed-view + getSchema().view (DONE); composes with canExecute (gating).

## Automation admission
- Expected operator value: Improves operator leverage around "additive (agent API): add igniteTools(component) — derive an LLM tool manifest from getSchema().commands (name + input schema), route tool_use into runtime.execute(name, payload), surface events + getView() as observations; the agent analog of igniteReact (getSchema-driven, adapter-agnostic, SDK-neutral core + optional Anthropic-shaped helper). Phase-1 additive; best after typed-view (typed tool inputs) + schema.view (grounding); composes with canExecute for dynamic tool gating. Design doc docs/ignite-tools.md" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/agent-tools.ts (NEW — igniteTools(component, dialect?): core buildManifest/resolveCall + shell invoke; the ToolDialect port type; a FAKE dialect for tests)
- packages/ignite-element/src/types/agent.ts (NeutralManifest / NeutralToolCall / NeutralToolResult / ToolError / ToolDialect types, derived from Commands + getSchema)
- a Result<T,E> errors-as-values type (reuse if one exists; else a small util — refine during planning)
- packages/ignite-element/src/index.ts + package.json exports (NEW `ignite-element/tools` entrypoint, mirroring `ignite-element/react`)
- packages/ignite-element/src/tests/*.test.ts + src/tests/types/*.types.test.ts (core + port via a FAKE dialect + FAKE component; typed manifest from getSchema; zero LLM calls)
- .changeset (additive minor; "ignite-element")
- NO provider SDK in PR 1 (real adapters = PR 2 anthropic / PR 3 openai)
- (refine during planning)

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
- Soft: typed-view (task-1781971975611) for typed tool inputs/observations; getSchema().view task for view grounding in the manifest. Buildable today against getSchema() (untyped), but lands cleanest after both.
- Composes with canExecute (task-1781798486122) for dynamic tool gating (mark tools available/unavailable per snapshot) — optional, not a hard blocker.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
