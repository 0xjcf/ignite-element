# Harden projection runtime helper ownership and benchmark inspection caching

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Follow up on PR #92 non-blocking review feedback. Evaluate a shared projection-target shell helper that preserves hidden immutable branding, frozen target identity, and WeakMap-backed configuration; evaluate centralizing command metadata/schema helpers so registration and coherent projection inspection cannot drift; benchmark repeated projection inspection before adding any schema/revision cache, and cache only if evidence shows material hot-path cost while preserving dynamic canExecute, document, speech, snapshot, and view semantics. This task blocks no v3 roadmap work.

## Automation admission

- Expected operator value: Improves operator leverage around "Harden projection runtime helper ownership and benchmark inspection caching" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria

- Projection document and speech target construction either shares one well-tested private shell helper or records why the existing duplication is safer.
- Command metadata and schema construction have one private source of truth without changing public exports or command behavior.
- A repeatable benchmark or focused measurement establishes whether projection inspection schema generation is a meaningful hot-path cost.
- Caching is added only when measurement justifies it and invalidation preserves dynamic snapshot, view, availability, documents, and speech behavior.
- Focused lifecycle, target-authenticity, schema, projection-runtime, type, and export tests pass.
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

- packages/ignite-element/src/runtime/projectionTargets.ts
- packages/ignite-element/src/runtime/commands.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/internal/projectionBinding.ts
- packages/ignite-element/src/tests

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
