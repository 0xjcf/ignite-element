# additive (agent API): add igniteTools(component) — derive an LLM tool manifest from getSchema().commands (name + input s

## Source
Created with `fas create-task` on 2026-06-21.

## Problem
additive (agent API): add igniteTools(component) — derive an LLM tool manifest from getSchema().commands (name + input schema), route tool_use into runtime.execute(name, payload), surface events + getView() as observations; the agent analog of igniteReact (getSchema-driven, adapter-agnostic, SDK-neutral core + optional Anthropic-shaped helper). Phase-1 additive; best after typed-view (typed tool inputs) + schema.view (grounding); composes with canExecute for dynamic tool gating. Design doc docs/ignite-tools.md

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
- packages/ignite-element/src/agent-tools.ts (new — igniteTools(component): { tools, invoke } from getSchema())
- packages/ignite-element/src/index.ts + package.json exports (new `ignite-element/tools` entrypoint, mirroring `ignite-element/react`)
- packages/ignite-element/src/types/agent.ts (tool-manifest types derived from Commands / getSchema)
- packages/ignite-element/src/tests/*.test.ts + src/tests/types/*.types.test.ts (manifest shape, tool_use -> execute routing, typed inputs)
- docs/ignite-tools.md (design) + a docs/site agent-runtime page note
- .changeset (additive minor; "ignite-element")
- SDK-neutral core returns { tools, invoke }; optional Anthropic-shaped mapping helper — keep @anthropic-ai/sdk an OPTIONAL peer (not a hard dep), mirroring react's optional peer
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
