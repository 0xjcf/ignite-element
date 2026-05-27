# harden migration and architecture utility scripts from CodeRabbit review

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group CodeRabbit script hardening findings: validate --report arguments in migrate-emit-to-effects, remove the too-small command parameter regex cap without introducing backtracking risk, make brace matching ignore strings/comments/templates/regex where practical, and prevent architecture-rule source walking from following symlink cycles. Source: CodeRabbit scripts domain review run against origin/main after commit 3a082b3.

## Acceptance criteria

- migrate-emit-to-effects fails clearly when --report is missing a path or is followed by another flag.
- Migration command detection handles long/destructured command parameter lists and braces inside common JavaScript syntax without corrupting output.
- architecture rule scanning skips symlinks or tracks real paths to avoid cycles.
- Add or strengthen focused script tests or fixtures where repo test surfaces exist, then run pnpm run lint, pnpm run typecheck, pnpm test, and fas verify --full.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- scripts/migrate-emit-to-effects.mjs
- scripts/check-architecture-rules.mjs
- scripts/__tests__/script-hardening.test.js

## Scope Amendments
- Type: test-scope-promotion
- Added at: 2026-05-26
- Trigger: Focused coverage required for script hardening acceptance criteria
- Reason: Add node-side tests for migrate-emit-to-effects CLI/scanner behavior and architecture symlink traversal without widening production source scope.
- Added paths: scripts/__tests__/script-hardening.test.js
- Evidence source: implementer handoff
- Evidence: implementer handoff | scripts/__tests__/script-hardening.test.js | Covers --report validation, long/destructured commands, expression-body command objects, and symlink traversal.
- Accuracy signal: test file directly exercises changed scripts
- Follow-up needed: none

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
