# Cut v3.0.0-beta.9 after executable narrative dogfood

## Source
Created with `fas create-task` on 2026-07-18.

## Problem
After the Voice Workbench narrative dogfood, ergonomics audit, Story API naming verdict, and scoped dist-tag hardening complete, close and merge the beta line, run the inert beta dry run, publish all four fixed packages at 3.0.0-beta.9, push the release commit and annotated package tags, verify registry versions and beta/latest dist-tags, deploy and smoke-test the beta documentation, and record the operator receipts. This is a prerelease checkpoint; do not exit Changesets pre mode and do not move ignite-element latest away from 2.2.2.

## Acceptance criteria
- The exact merged beta head passes full verification and the inert release dry run.
- All four fixed packages publish at 3.0.0-beta.9 and their beta dist-tags resolve to beta.9.
- ignite-element latest remains 2.2.2 until the stable cut.
- Release commits and annotated tags are pushed and the beta documentation is deployed and smoke-tested.
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
- .changeset/pre.json
- packages/ignite-element/package.json
- packages/ignite-core/package.json
- packages/ignite-adapters/package.json
- packages/ignite-renderer/package.json
- pnpm-lock.yaml
- packages/ignite-element/CHANGELOG.md
- packages/ignite-core/CHANGELOG.md
- packages/ignite-adapters/CHANGELOG.md
- packages/ignite-renderer/CHANGELOG.md
- examples/agents/voice-workbench/vite.config.ts
- examples/agents/voice-workbench/vite.config.test.ts

## Scope Amendments
- Type: ci-failure-follow-up
- Added at: 2026-07-18
- Trigger: PR #94 GitHub Actions example runtime timeout
- Reason: Voice Workbench integration tests pass locally but five exceeded Vitest's 5000ms default under CI runner contention; the PR cannot merge until the example owns a bounded CI-safe timeout.
- Added paths: examples/agents/voice-workbench/vite.config.ts, examples/agents/voice-workbench/vite.config.test.ts
- Evidence source: GitHub Actions
- Evidence: GitHub Actions | https://github.com/0xjcf/ignite-element/actions/runs/29655301133/job/88108402221 | Five existing integration tests timed out at 5000ms while neighboring tests completed between roughly 3s and 5s; no product assertions failed.
- Accuracy signal: The exact failing suite passes locally and CI reported only default-timeout expirations, so the amended paths are limited to the example test config and its contract test.
- Follow-up needed: None; verify the full Voice Workbench suite and FAS full lane before pushing.

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
