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

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- docs/projection-runtime.md
- docs/accessibility-by-default.md
- docs/site/src/content/docs/api/headless-runtime.mdx
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

## Implementation plan

- Audit current getSchema semantics and document it as the compiled runtime blueprint.
- Reconcile projection-runtime and headless docs so coherent inspection is explicitly private implementation machinery.
- Update the workbench brief to require evidence from existing getters and subscriptions before proposing any new observation method.
- Run focused validation and close with no product source change if the existing API is sufficient.

## Verification plan

- Run focused getSchema, headless runtime, projection runtime, and export tests.
- Run documentation checks and the relevant example/workbench contract validation.
- Run fas validate-task; reserve full verification for the final epic closeout.

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
