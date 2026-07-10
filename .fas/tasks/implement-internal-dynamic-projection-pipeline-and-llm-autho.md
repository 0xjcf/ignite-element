# Implement internal dynamic projection pipeline and LLM-authored artifacts

## Source

Created with `fas create-task` on 2026-07-09.

## Problem

Replace the superseded ProjectionRequest/ProjectionSpec registry and command-presentation-metadata approach with a clean behavior-first architecture. Preserve the existing igniteCore configuration, DOM registrar, and headless runtime surface. Build a private coherent inspection primitive plus internal generic Projection<Format, Output>, binding, and committer machinery. Add only the minimal callable projector overload and opaque first-party projection value contract needed to let the same igniteCore value project without a tag into non-DOM outputs. Model dynamic agent output as validated ProjectionDocument data stored in actor state; an LLM receives igniteTools command schemas and authors or patches projection documents through commands such as upsertProjection rather than generating JSX or executable code. The model's final text or structured speech field becomes speech output, while accessible JSX, terminal, and agent committers consume the same semantic document without requiring a DOM. Reconcile the committed projection/accessibility docs before source implementation and treat the discarded implementation as non-authoritative.

## Acceptance criteria

- igniteCore keeps its existing source/view/commands/events/effects configuration with no projections option, projection registry, public bind/inspect/project method, behavior presentation metadata, or projection generics threaded through adapters.
- The existing counter(tagName, renderer) custom-element API remains source-compatible; any non-DOM callable overload is narrow, returns a disposable handle, and does not require a tag, JSX, ShadowRoot, or DOM.
- The internal projection contract is open and generic over format/output; behavior view remains projection input rather than a projection variant.
- Projection documents are validated declarative data with stable ids and safe semantic nodes such as text, checklist, form, table, timeline, chart, code diff, decision log, and command-backed action; raw generated JSX, JavaScript, event handlers, imports, and DOM references are rejected.
- An LLM can create and incrementally patch projection documents through igniteTools-exposed commands, and validated actor state remains the durable source of truth.
- Model-authored final text or a structured speech field can drive a speech projection through an injected/mockable committer without requiring DOM; microphone recognition and provider/model loops remain adapter concerns.
- Accessible JSX rendering maps semantic projection nodes to native elements and validates command-backed actions against command existence and current availability.
- Deterministic tests cover inspection coherence, projection validation, state persistence, committer routing/lifecycle, unsupported environments, and scripted model-authored projection flows before live-provider validation.
- The accepted replacement architecture is reflected in docs/projection-runtime.md, docs/accessibility-by-default.md, and the site guide before implementation closeout.
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
- docs/projection-runtime.md
- docs/accessibility-by-default.md
- docs/site/src/content/docs/guides/accessibility-first.mdx
- packages/ignite-element/package.json
- packages/ignite-element/scripts/verify-exports.mjs
- packages/ignite-element/src/internal/projectionBinding.ts
- packages/ignite-element/src/internal/projectionDocument.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/createComponentFactory.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/runtime/projectionTargets.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/types/projectionTargetBrand.ts
- packages/ignite-element/src/tools/core.ts
- packages/ignite-element/src/tests/projection-runtime.test.ts
- packages/ignite-element/src/tests/projection-binding.test.ts
- packages/ignite-element/src/tests/createProjectionFactory.test.ts
- packages/ignite-element/src/tests/projection-target-guard.test.ts
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-adapters/src/adapters/XStateAdapter.ts
- packages/ignite-element/src/tests/adapters/XStateAdapter.test.ts

## Scope Amendments

- Type: architecture-reset
- Added at: 2026-07-09
- Trigger: User rejected the provisional registry and command-presentation-metadata API after reviewing the implementation blast radius.
- Reason: Restart from a clean tree around LLM-authored validated projection documents, private projection machinery, and minimal igniteCore public change.
- Evidence source: architecture discussion
- Evidence: architecture discussion | .fas/tasks/implement-internal-dynamic-projection-pipeline-and-llm-autho.md | Old task task-1783610917796 was superseded before implementation; all provisional source changes were restored.
- Accuracy signal: high
- Follow-up needed: Reassess affected-file scope after planner architecture output and before TDD implementation.

- Type: review-driven dependency expansion
- Added at: 2026-07-10
- Trigger: Public XState projection accessor probes
- Reason: XState context spread invokes documents and speech accessors before Ignite projection validation; descriptor-preserving construction is required for the accepted public fail-closed contract.
- Added paths: packages/ignite-adapters/src/adapters/XStateAdapter.ts, packages/ignite-element/src/tests/adapters/XStateAdapter.test.ts
- Evidence source: FAS QA/SRE/final reviewer
- Evidence: FAS QA/SRE/final reviewer | .fas/state/review-summary.md | Reviewer approved exactly two added paths and a 29-path expected envelope.
- Accuracy signal: Public built-runtime reproductions plus descriptor-preserving prototype
- Follow-up needed: Re-run QA, SRE, reviewer, and refresh final ChangeSet after implementation.

## Implementation plan

- First reconcile the committed projection/accessibility design documents and add a decision record that supersedes registry, selection, and behavior-presentation metadata.
- Write failing contract/type/runtime tests for projection-document validation, the callable non-DOM projection lifecycle, coherent runtime reads, actor-owned document updates, and model-authored speech/text routing.
- Implement the smallest private inspection, Projection<Format, Output>, binding, and committer substrate without exporting generic plumbing or threading projection types through adapter configs.
- Implement validated ProjectionDocument create/patch semantics and command-backed actions as deterministic core logic; keep actor state authoritative.
- Integrate the existing custom-element/JSX path without changing counter(tagName, renderer), then add the narrow non-DOM callable overload and injected/mockable speech/text committer proven by tests.
- Adapt igniteTools-facing commands and scripted model fixtures so the LLM authors projection data through validated commands rather than executable code.
- Run focused verification after each planned commit and leave the downstream workbench, broad testing DSL, rendered validation, and final docs sweep to their queued tasks.

## Verification plan

- Run TDD red receipt before production implementation.
- Run focused core/runtime/type/igniteTools tests after each commit-plan step.
- Run fas validate-task before batch snapshot.
- Use the epic shared verify --full and CodeRabbit committed review only after the final epic task.

## Risks

- A universal public projection union or registry would recreate the rejected API growth.
- A one-argument callable overload can accidentally conflate isolated element factories with one headless runtime instance unless lifecycle ownership is explicit.
- Reactive speech can repeat or interrupt unexpectedly; changed, requested, and event-driven commit semantics must be explicit and testable.
- Projection documents can expose private state or create unsafe actions unless selection, validation, redaction, and command availability remain authoritative.
- Provider/model, microphone, and durable MLX lifecycle must not leak into igniteCore.

## Dependencies

- Supersedes task-1783610917796, whose uncommitted implementation was discarded before any source commit.
- Blocks task-1783610933373.

## Open questions

- Which minimal opaque public projection value constructor, if any, is required for the callable overload while keeping bind/inspect/registry private?
- What exact lifecycle policy distinguishes persistent outputs such as JSX/terminal from temporal outputs such as speech: changed, requested, or event-driven?
- Should the first reusable ProjectionDocument node catalog ship in the package during this task or begin as an internal contract proven by the queued workbench before final export?

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
