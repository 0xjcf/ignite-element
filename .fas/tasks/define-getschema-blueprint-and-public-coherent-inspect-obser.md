# Define getSchema as the compiled blueprint and keep coherent inspection private

## Source

Created with `fas create-task` on 2026-07-11.

## Problem

Finalize and document the restrained headless discovery contract after the object-form command-call cutover. Treat igniteCore(config) as the executable authoring source and runtime.getSchema() as its only compiled JSON-safe blueprint. Do not add getBlueprint() or public inspect(). Keep the coherent inspection substrate private for atomic projection validation and channel commits. Validate that public consumers and the upcoming voice/text workbench can use getSchema(), getSnapshot(), getView(), canExecute(commandName), on(...), watchSnapshot(...), and watchView(...) without requiring a bundled inspection API. Projections remain the private headless interface-output machinery for validated document and speech facts consumed by DOM, terminal, voice, accessibility, and agent adapters.

## Acceptance criteria

- getSchema() is the only public compiled blueprint surface and no getBlueprint() API exists.
- No public inspect() method or inspection type is added.
- The private coherent inspection substrate remains internal and continues to support atomic projection validation and document/speech committers.
- Documentation distinguishes igniteCore authoring config, getSchema blueprint data, focused live getters, subscriptions, and private projection inspection.
- The getSchema blueprint remains JSON-safe and exposes no source actors, effects, callbacks, selectors, registries, bindings, committers, or executable model-authored content.
- Public command calls use { command, input? } and events remain { type, ...fields }.
- The voice/text workbench brief explicitly dogfoods getSchema, getView/getSnapshot, canExecute, and subscriptions before any future inspection API is reconsidered.
- The task may close with documentation and verification only when existing public APIs prove sufficient.
- Any future public coherent observation proposal requires concrete dogfood evidence of revision mismatch, repeated bootstrap-packet duplication, or inaccessible projection facts.
- Focused schema, pure-Node headless, projection validation, docs, and existing public API tests pass without expanding the runtime surface.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- State the public boundary in the two canonical runtime documents:
  `igniteCore(config)` is executable authoring input, while `runtime.getSchema()`
  is the sole public compiled JSON-safe blueprint.
- Enumerate the blueprint exclusion boundary: no source actors, effects,
  callbacks, selectors, registries, bindings, committers, or executable
  model-authored content.
- Keep coherent projection inspection private and explicitly reject
  `getBlueprint()` and a public `inspect()` surface unless later workbench
  evidence proves the focused getters and subscriptions insufficient.

## Alternatives considered

- Add `getBlueprint()`: rejected because it duplicates `getSchema()` and creates
  two public names for the same compiled contract.
- Publish coherent `inspect()`: rejected because current getters and
  subscriptions already cover public reads, while atomic projection inspection
  is internal validation and commit machinery.
- Change product source to encode the documentation decision: rejected because
  focused validation confirms the existing runtime and exports already satisfy
  the restrained contract.

## Affected files

- docs/projection-runtime.md
- docs/site/src/content/docs/api/headless-runtime.mdx

## Reference files

- docs/accessibility-by-default.md
- docs/site/src/content/docs/guides/accessibility-first.mdx
- .fas/tasks/build-voice-text-agent-control-center-workbench-example-for-.md

## Scope Amendments

- Type: scope-reduction
- Added at: 2026-07-11
- Trigger: owner challenged whether public inspect adds value beyond focused getters and subscriptions.
- Reason: Keep coherent inspection private unless dogfood proves a concrete consistency gap; this task now owns contract documentation and workbench validation only.
- Removed paths: packages/ignite-element/src/types/schema.ts, packages/ignite-element/src/types/agent.ts, packages/ignite-element/src/runtime/agent.ts, packages/ignite-element/src/internal/projectionBinding.ts, packages/ignite-element/src/IgniteElementFactory.ts, packages/ignite-element/src/index.ts, packages/ignite-element/src/xstate.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/actor-web.ts, packages/ignite-element/src/tests
- Accuracy signal: Existing public getters and subscriptions remain the target API; no product source implementation is planned.
- Follow-up needed: Reconsider a public coherent observation only from concrete workbench evidence.

### Validation-driven scope refinement

- Type: scope-reduction
- Added at: 2026-07-11
- Trigger: read-only validation found runtime behavior correct but canonical public docs incomplete.
- Reason: narrow the writable scope to the two canonical documents that omit the accepted blueprint boundary.
- Evidence: read-only validator passed 5 focused files and 120 tests, docs code-block typecheck, Markdown lint, and export verification.
- Added paths: none.
- Removed paths: docs/accessibility-by-default.md, docs/site/src/content/docs/guides/accessibility-first.mdx, .fas/tasks/build-voice-text-agent-control-center-workbench-example-for-.md
- Reference-only confirmations: accessibility docs contain no public inspection API claim, and the workbench brief already requires the focused-getter evidence gate.
- Constraint: no product source or export changes.
- Accuracy signal: exact file-and-line audit plus green focused runtime and documentation receipts.
- Follow-up needed: none for this task; reconsider public observation only from later workbench evidence.

## Implementation plan

- Update the projection-runtime contract to distinguish executable authoring configuration from the compiled `getSchema()` blueprint and record its exact exclusion boundary.
- Update the headless-runtime API reference to name `getSchema()` as the sole public compiled blueprint and explicitly reject `getBlueprint()` and public `inspect()`.
- Preserve coherent projection inspection as private implementation machinery; make no product source, type, export, accessibility-doc, or workbench-brief changes.
- Rerun the validator's focused runtime, docs, and export checks, then complete full verification and review.

## Verification plan

- Run focused getSchema, headless runtime, projection runtime, and export tests.
- Run documentation checks and the relevant example/workbench contract validation.
- Run `fas validate-task`.
- Run `.fas/scripts/verify.sh --full` before closing tracked changes. If full
  verification is intentionally waived, record the explicitly approved
  exemption before closeout.

## Risks

- Calling current snapshot/view values schema may overstate formal JSON-schema guarantees; document exact semantics.
- Projection internals may leak through examples unless docs keep artifacts as actor-owned validated facts.
- The task must not become a backdoor for adding inspect(), registries, or generalized projection APIs.

## Dependencies

- Depends on task-1783735005336, the object-form command-call cutover.
- Blocks task-1783613728381 so the workbench starts from the settled getSchema blueprint contract.

## Open questions

- Can the voice/text workbench bootstrap and remain synchronized using getSchema, getView/getSnapshot, canExecute, and subscriptions alone?
- Do any remote Actor-Web dogfood flows demonstrate a real cross-revision consistency defect?

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
