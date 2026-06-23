# docs(examples): replace deprecated getState()/watch() with getSnapshot()/watchSnapshot() in the example READMEs

## Source
Created with `fas create-task` on 2026-06-23.

## Problem
CodeRabbit (PR #65) flagged that the example app READMEs document the deprecated v3 agent-runtime API. examples/adapters/xstate/README.md (and likely the other example READMEs) still use getState() and watch(), renamed to getSnapshot() and watchSnapshot() (the canonical v3 runtime accessors); the typed read-model is getView()/watchView(). Examples now live at TOP-LEVEL examples/ (relocated out of packages/ignite-element/src/examples in PR #65). Verify authoritative method names against packages/ignite-element/src/types/agent.ts (IgniteAgentRuntime) and packages/ignite-element/src/runtime/agent.ts before editing. Documentation only — do not change example source/config. After editing, run the repo-root biome (packages/ignite-element/node_modules/.bin/biome format examples/) and markdownlint if present.

## Automation admission
- Expected operator value: Improves operator leverage around "docs(examples): replace deprecated getState()/watch() with getSnapshot()/watchSnapshot() in the example READMEs" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- No example README references getState( or watch( as runtime accessors; all use getSnapshot/watchSnapshot/getView/watchView as appropriate
- Docs-only: no example source or config files changed
- Biome format clean over examples/
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
- examples/adapters/xstate/README.md
- examples/adapters/redux/README.md
- examples/adapters/mobx/README.md
- examples/apps/spa-router/README.md
- examples/apps/form-with-validation/README.md
- examples/frameworks/react/README.md
- examples/frameworks/vue/README.md
- examples/frameworks/svelte/README.md

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
