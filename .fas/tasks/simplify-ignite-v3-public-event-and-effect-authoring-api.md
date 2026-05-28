# Simplify Ignite v3 public event and effect authoring API

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Implement the Ignite Element side of the outside-in Freedom Air contract. Normal app code should not need to import EventDescriptor, FacadeEffectArgs, or other ignite-core internals to type DOM events, effects, snapshots, select, or emit. Preserve adapter-specific entrypoints and public API boundaries while improving inference and keeping execute/story.execute async semantics clear.

## Acceptance criteria
- Consumer code can declare events and effects from igniteCore without importing EventDescriptor or FacadeEffectArgs from ignite-core.
- Type tests cover inferred emit payloads, select snapshots, command helpers, execute, and story.execute behavior for the v3 authoring path.
- Docs and examples use the simplified public API and do not teach internal core contract imports for ordinary app authoring.
- The Freedom Air outside-in consumer contract compiles after removing app imports of `ignite-core` `EventDescriptor` and `FacadeEffectArgs`; its red-contract evidence is `.fas/state/verification/validate-task-1779990332.log` in `/Users/joseflores/Development/Freedom Air`.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/site/src/content/docs/concepts/events-and-commands.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx

## Scope Amendments
- 2026-05-28: Scope narrowed after architect/staff guidance and the senior-engineer checkpoint. Keep `packages/ignite-element/src/igniteCore/types.ts` and `packages/ignite-element/src/RenderArgs.ts` as no-edit reference evidence because the shared type migration was reverted to preserve core and adapter contracts. Implement the public v3 authoring bridge at the XState entrypoint instead. Evidence: `.fas/state/verification/validate-task-1779992176.log` passed format, lint, typecheck, and behavior-boundary checks after this approach.

- Type: scope-refresh-promotion
- Added at: 2026-05-28
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

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

## Verification evidence
- 2026-05-28: `../FAS/cli/fas verify --full` passed format, lint, typecheck, tests, architecture drift, behavior boundaries, and semantic index. Receipt: `.fas/state/verification/latest.log`.
- 2026-05-28: `pnpm run build` generated package artifacts for `ignite-element/xstate`; the full workspace build then hit an unrelated stale JSX runtime export assertion in `packages/ignite-element/scripts/verify-exports.mjs` (`j` expected but not emitted). XState artifact evidence was checked directly instead:
  - `packages/ignite-element/dist/types/xstate.d.ts` re-exports `IgniteCoreReturn`, declares the simplified `XStateConfig` and `igniteCore` overloads, and keeps `FacadeCommandFunction`/`FacadeCommandResult` as local imported type constraints rather than public xstate re-exports.
  - `node -e "import('ignite-element/xstate').then((m)=>{ console.log(Object.keys(m).sort().join('\n')); if (!('igniteCore' in m) || !('matchState' in m) || !('test' in m)) process.exit(1); if ('FacadeCommandFunction' in m || 'FacadeCommandResult' in m) process.exit(2); })"` passed from `packages/ignite-element`.
  - `pnpm pack --pack-destination /private/tmp/ignite-element-pack` passed for `ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element`; the `ignite-element` tarball included `dist/xstate.{es,cjs}.js` and `dist/types/xstate.d.ts`.
- 2026-05-28: Freedom Air downstream contract was verified in an isolated temp copy at `/private/tmp/freedom-air-contract.ySyJ9l` with freshly packed local Ignite tarballs substituted into `vendor/npm`:
  - `npm install` passed.
  - `npm run typecheck` passed.
  - `npm run build` passed.
  - `npm run verify` passed format, markdown lint, lint, and typecheck, then failed in tests because `@actor-core/runtime` could not resolve `dist/actor-system` from `actor-system-guardian.js`; this is outside the Ignite Element API contract and did not affect the downstream compile/build evidence.
