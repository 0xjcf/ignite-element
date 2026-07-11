# BREAKING (v3 beta): adopt object-form igniteTest command steps and artifact intent vocabulary

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Complete the v3-beta command-call cutover before the voice/text workbench. Replace positional igniteTest.when(commandName, input?) plus IgniteAgentRuntime.execute(commandName, input?) and IgniteStory.execute(commandName, input?) with the single canonical object envelope { command, input? }. Remove positional support rather than deprecating it. Preserve a command-discriminated mapped union: required command inputs are required and typed, optional first inputs remain optional, and no-argument commands omit input. Keep events on the distinct flat { type, ...fields } fact shape; keep canExecute(commandName), on(eventName, handler), adapter send({ type }), trace schemas, projection validation, and tool-router internals semantically unchanged. Provider adapters may translate provider { name, arguments } calls into Ignite { command, input }.

## Acceptance criteria

- igniteTest uses when({ command: "commandName", input }) and supports when({ command: "noArgCommand" }) without positional overloads.
- IgniteAgentRuntime.execute and IgniteStory.execute use the same { command, input? } envelope without positional overloads.
- One shared exported IgniteCommandCall mapped union preserves required, optional, and no-input inference and remains visible from every public adapter entrypoint.
- Events remain flat { type, ...fields } facts; command calls do not accept a type discriminator.
- canExecute(commandName), on(eventName, handler), adapter send({ type }), story trace schemas, ProjectionDocument validation, and tool-router internals retain their established semantics.
- igniteTools translates its neutral/provider call into runtime.execute({ command, input }) without changing provider-facing NeutralToolCall naming.
- All package tests, self-contained examples, generated showcase strings, and documentation migrate atomically to object-form command calls.
- Focused type tests assert Parameters<typeof runtime.execute>[0], Parameters<typeof story.execute>[0], invalid command names/inputs, and positional-call rejection.
- No getBlueprint, public inspect implementation, projection registry, binding, or second authoring DSL is added in this PR; the dependent getSchema contract task owns the documentation and dogfood validation.
- Full package, node, export, example typecheck/runtime, e2e where applicable, docs, and FAS verification lanes pass.
- TDD: failing runtime/type evidence is recorded before implementation and every production change is covered.
- The task remains tracked and dependency-reachable in the FAS queue.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Replace positional `when(commandName, input?)`, runtime
  `execute(commandName, input?)`, and story `execute(commandName, input?)`
  signatures with the single object-form command call
  `{ command, input? }`.
- Model the step as a command-name discriminated union so TypeScript requires
  `input` exactly when the selected command requires it.
- Translate provider-neutral `{ name, arguments }` tool calls at the adapter
  boundary into Ignite's `{ command, input }` envelope.

## Alternatives considered

- Keep positional arguments: rejected because command intent and input become
  ambiguous at call sites.
- Support both positional and object forms: rejected because v3 is still in
  beta and compatibility overloads would preserve the ambiguity.
- Use `{ name, input }`: rejected because `command` distinguishes Ignite's
  executable intent from provider-facing tool names.
- Use `{ type, ...fields }`: rejected because that shape is reserved for
  emitted event facts, not command invocations.

## Affected files

- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/testing.md
- docs/site/src/content/docs/api/testing-dsl.mdx
- examples
- README.md
- docs/can-execute.md
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/tests
- packages/ignite-element/tests
- packages/ignite-element/README.md
- docs
- packages/ignite-element/src/tools
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/xstate.ts
- docs/api/README.md
- docs/ignite-tools.md
- docs/site/src/content/docs/api/headless-runtime.mdx
- docs/site/src/content/docs/guides/accessibility-first.mdx
- docs/site/src/content/docs/guides/actor-web.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- docs/site/src/content/docs/guides/routing.mdx
- docs/site/src/content/docs/overview/ignite-for-ai-agents.mdx
- examples/adapters/xstate/README.md
- examples/adapters/xstate/xstateAgentRuntimeShowcase.tsx
- examples/apps/form-with-validation/src/form.tsx
- examples/apps/spa-router/README.md
- .changeset/object-command-call-envelope.md

## Scope Amendments

- Type: scope-expansion
- Added at: 2026-07-11
- Trigger: repo-wide positional igniteTest.when search after implementation
- Reason: Acceptance requires all documentation to migrate in the same breaking change; these two examples still used the removed positional form.
- Added paths: README.md, docs/can-execute.md
- Evidence source: senior engineer verification handoff
- Evidence: senior engineer verification handoff | README.md | README.md:294 and docs/can-execute.md:136 contain positional scenario.when calls.
- Accuracy signal: Both snippets target igniteTest scenario.when, not unrelated execute or selector APIs.
- Follow-up needed: Migrate both snippets in a docs-only incremental commit and rerun docs/search gates.

- Type: scope-expansion
- Added at: 2026-07-11
- Trigger: owner requested command-call consistency across when and execute before PR 93 merges
- Reason: Ignite test scenarios, agent runtimes, and recorded stories all invoke commands and should share the canonical object call { command, input? }; event objects { type, ...fields } remain emitted facts and adapter messages, not command invocations.
- Added paths: packages/ignite-element/src/types/agent.ts, packages/ignite-element/src/runtime/agent.ts, packages/ignite-element/src/testing.ts, packages/ignite-element/src/tests, packages/ignite-element/tests, packages/ignite-element/README.md, examples, docs, README.md
- Evidence source: repo-wide public execute call inventory
- Evidence: repo-wide public execute call inventory | packages/ignite-element/src/types/agent.ts | IgniteAgentRuntime.execute and IgniteStory.execute remain positional, with consumers across package tests, examples, docs, and generated showcase strings.
- Accuracy signal: Only public Ignite runtime/story execute calls migrate; canExecute identity queries, event subscriptions, adapter send, and unrelated execute methods remain unchanged.
- Follow-up needed: Migrate types, runtime forwarding, tests, examples, and docs atomically in PR 93; rerun all self-contained example lanes and closeout reviews.

- Type: scope-expansion
- Added at: 2026-07-11
- Trigger: implementation inventory for canonical command envelope cutover
- Reason: The public execute signature and igniteTools translation require public barrel exports, tool-core normalization, and atomic migration of every self-contained example and documentation consumer.
- Added paths: packages/ignite-element/src/tools, packages/ignite-element/src/index.ts, packages/ignite-element/src/actor-web.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/xstate.ts, examples, docs
- Evidence source: commits 1a0d55f6 and 62ff15c5
- Evidence: commits 1a0d55f6 and 62ff15c5 | packages/ignite-element/src/tools/igniteTools.ts | Provider-neutral calls are validated and normalized to { command, input? } before direct runtime execution; all public callsites migrate atomically.
- Accuracy signal: Repo-wide stale-call searches are clean except intentional positional rejection type tests.
- Follow-up needed: Run refreshed plan alignment, downstream QA/SRE/reviewer, full verify, and CodeRabbit before pushing PR 93.

- Type: scope-refresh
- Added at: 2026-07-11
- Added paths: docs/api/README.md, docs/ignite-tools.md, docs/site/src/content/docs/api/headless-runtime.mdx, docs/site/src/content/docs/guides/accessibility-first.mdx, docs/site/src/content/docs/guides/actor-web.mdx, docs/site/src/content/docs/guides/agent-runtime-v3.mdx, docs/site/src/content/docs/guides/routing.mdx, docs/site/src/content/docs/overview/ignite-for-ai-agents.mdx, examples/adapters/xstate/README.md, examples/adapters/xstate/xstateAgentRuntimeShowcase.tsx, examples/apps/form-with-validation/src/form.tsx, examples/apps/spa-router/README.md

- Type: scope-expansion
- Added at: 2026-07-11
- Trigger: final reviewer release-metadata blocker
- Reason: The public v3-beta breaking command-envelope cutover requires a Changeset before downstream handoff.
- Added paths: .changeset/object-command-call-envelope.md
- Evidence source: final reviewer handoff
- Evidence: final reviewer handoff | .changeset/object-command-call-envelope.md | Records the ignite-element major release intent for the breaking object-form command APIs.
- Accuracy signal: Changesets status parses the file and reports the configured fixed package group at major.
- Follow-up needed: Root owns full verification, review refresh, and PR closeout.

## Implementation plan

- Add failing runtime and type tests for required-input, optional-input,
  no-input, invalid-command, and invalid-input object-form command calls.
- Replace the public `when` and `execute` signatures and implementations
  without retaining positional overloads.
- Migrate package tests, examples, and documentation in one breaking sweep.
- Re-run repository-wide search for positional `.when(...)` calls before
  closeout and confirm the voice/text workbench brief uses artifact intent.

## Verification plan

- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks

- A loose object type could weaken command-name/input inference; require a
  discriminated union derived from the command map.
- A compatibility overload would preserve two ways to express the same test
  step and undermine the v3 cleanup.
- Do not turn artifact vocabulary into built-in Ignite commands.

## Dependencies

- Depends on task-1783650880370.
- Blocks task-1783613728381.
- Blocks task-1783783535436.

## Open questions

- None captured at task creation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
