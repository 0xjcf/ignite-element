# example/app (showcase): headless agent runtime on a non-web projection — drive a REMOTE actor-web actor (location transp

## Source
Created with `fas create-task` on 2026-06-21.

## Problem
example/app (showcase): headless agent runtime on a non-web projection — drive a REMOTE actor-web actor (location transparency) through the ignite agent runtime with NO web UI, rendering to an embedded/console surface; demonstrate canExecute dynamic tool availability gating the agent's actions. Proves ignite components are agent-drivable and renderer-agnostic beyond the DOM. Depends on igniteTools + canExecute + actor-web remote source

## Automation admission
- Expected operator value: Improves operator leverage around "example/app (showcase): headless agent runtime on a non-web projection — drive a REMOTE actor-web actor (location transparency) through the ignite agent runtime with NO web UI, rendering to an embedded/console surface; demonstrate canExecute dynamic tool availability gating the agent's actions. Proves ignite components are agent-drivable and renderer-agnostic beyond the DOM. Depends on igniteTools + canExecute + actor-web remote source" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- examples/apps/headless-agent-showcase/** (new — remote actor-web source + console/embedded projection + agent driver + canExecute gating + README; not published)
- (refine during planning; needs a remote/transport actor-web source and a non-DOM render target)

## Scope Amendments
- 2026-06-21: realize this concretely as a CLI app under examples/apps/ (the "release-agent" shape from the design discussion): a remote release/deploy actor-web actor, an agent loop via igniteTools, canExecute-gated tools (build->deploy->promote/rollback), transport-aware availability, console output (no DOM). This IS the "cli example to apps" the owner asked for. Pair note: the component's OWN UI surface (if a dashboard is shown alongside) must be authored source-native (derive from destructured view/command args — snapshot.can/.matches for disabled, actor.send via commands), NOT via execute/canExecute — those are the headless/agent surface only. See the two-surface DX rule in memory.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- igniteTools (build first) + canExecute (task-1781798486122, currently design-blocked — unblock before this app) + actor-web remote/transport source.
- Builds on the agent-runtime dogfood example (the simpler proof) — do that first, then extend to remote + headless console + canExecute here.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
