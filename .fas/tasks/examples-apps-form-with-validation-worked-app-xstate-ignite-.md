# examples/apps: form-with-validation worked app (XState + ignite-jsx)

## Source
Created with `fas create-task` on 2026-06-20.

## Problem
Build a runnable, idiomatic form-with-validation worked app under packages/ignite-element/src/examples/apps/form-with-validation, mirroring the apps/spa-router scaffolding (vite + source aliases to local ignite-element and the scoped @ignite-element packages; pin xstate to the workspace version 5.32.1; ignite-jsx renderer driven by the tsconfig jsxImportSource exactly like spa-router — no per-file pragma, no esbuild jsx config). A <signup-form> custom element backed by an XState v5 machine. Functional core: a pure validation module (required / email-format / min-length) and a form machine (context = field values + per-field errors + touched + submit status/error; events SET_FIELD, BLUR_FIELD, SUBMIT; states editing -> submitting (fromPromise mock async submit) -> success, with a submit failure returning to editing carrying submitError; a canSubmit guard from validateAll). The ignite element uses igniteCore with commands derived from the INJECTED actor (setField/blurField/submit/reset), source-native actor.send, view via ({ context }), and an ignite-jsx view: labeled inputs, inline per-field error messages shown once a field is touched or after a submit attempt, a submit button disabled until valid and while submitting, and a success state. Renderer = ignite-jsx (owner directive). Keep minimal and headless-testable: pure validation.test.ts + formMachine.test.ts + a form.headless.test.ts exercising the ignite headless runtime (execute/getView/on/execute().events), mirroring spa-router's test style (example tests are typecheck-gated only; the vitest run set excludes src/examples/**, so run them directly to confirm green). Add the new example tsconfig to the packages/ignite-element package.json typecheck chain. Dark theme matching the other examples; component styles injected into the shadow root via form.css?raw. Precedent: apps/spa-router (structure/tsconfig/vite aliases/headless tests) and the xstate adapter examples (igniteCore idioms). FIRST of the worked-apps set, decomposed from task-1781805264107.

## Acceptance criteria
- The <signup-form> element renders via ignite-jsx and is verified live in the preview (props/validation/submit flow)
- The form machine and validation are pure (functional core, no I/O) with passing validation.test.ts, formMachine.test.ts, and form.headless.test.ts
- Commands derive from the injected actor and use source-native xstate; view is ({ context }); idiomatic XState v5 (setup/createMachine/assign/guards/fromPromise)
- The example tsconfig is added to the package typecheck chain and the full verify passes
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
- packages/ignite-element/src/examples/apps/form-with-validation/package.json
- packages/ignite-element/src/examples/apps/form-with-validation/vite.config.ts
- packages/ignite-element/src/examples/apps/form-with-validation/tsconfig.json
- packages/ignite-element/src/examples/apps/form-with-validation/index.html
- packages/ignite-element/src/examples/apps/form-with-validation/src/env.d.ts
- packages/ignite-element/src/examples/apps/form-with-validation/src/validation.ts
- packages/ignite-element/src/examples/apps/form-with-validation/src/validation.test.ts
- packages/ignite-element/src/examples/apps/form-with-validation/src/formMachine.ts
- packages/ignite-element/src/examples/apps/form-with-validation/src/formMachine.test.ts
- packages/ignite-element/src/examples/apps/form-with-validation/src/form.tsx
- packages/ignite-element/src/examples/apps/form-with-validation/src/form.css
- packages/ignite-element/src/examples/apps/form-with-validation/src/form.headless.test.ts
- packages/ignite-element/src/examples/apps/form-with-validation/README.md
- packages/ignite-element/package.json

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
