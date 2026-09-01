# Design: Internal projection runtime over behavior contracts

## Status

Accepted replacement direction for the Ignite Element v3 beta design window.
This document supersedes the earlier registry-oriented proposal.

## Why this changed

Ignite already has the right behavior boundary:

- `states` derives stable UI-facing state from the source snapshot.
- `getStates()` returns that derived state to headless consumers.
- `getSchema()` returns the compiled JSON-safe blueprint of commands, events,
  snapshot, and states.
- `execute()` and `canExecute()` keep intent and availability explicit.

## Authoring input and compiled blueprint

`igniteCore(config)` receives executable authoring input. Its config may contain
source factories or actors, callbacks, selectors, effects, and other values that
are meaningful only inside the running application. That authoring input is not
a serialization contract.

`runtime.getSchema()` is the sole public compiled, JSON-safe Ignite blueprint.
The blueprint describes the runtime's commands, declared events, current
snapshot, and derived states. "Blueprint" is Ignite vocabulary, not a claim that
the returned object is a formal JSON Schema document. Individual command input
descriptions may use JSON-Schema-like fragments, but the blueprint as a whole is
an Ignite discovery contract.

The blueprint deliberately excludes source actors and factories, effects,
callbacks, selectors, registries, projection bindings, committers, and
executable model-authored content. Ignite does not add a second
`getBlueprint()` method for the same contract.

The rejected design added a public projection registry and selection model on top
of those contracts. That widened the API surface, split ownership across config
and runtime, and encouraged projection-specific metadata to leak into
`igniteCore`.

The replacement keeps the behavior boundary intact and adds only one narrow
public seam: the callable value returned by `igniteCore(...)`. This document
names that callable `component`; it can be used either as
`component(tagName, renderer)` for DOM registration or as `component(target)`
for a first-party non-DOM projection target.

## Public contract

The public surface remains intentionally small:

- `igniteCore` keeps the current source, states, commands, events, and effects
  config shape.
- `component(tagName, renderer)` remains source-compatible.
- One additive overload is allowed: `component(target)`.
- `target` is a first-party opaque branded value, not a plain object, callback,
  registry key, or model-authored document.
- The one-argument overload returns only a disposable handle:
  `{ dispose(): void }`.
- `getSnapshot()`, `getStates()`, `getSchema()`, `canExecute()`, `on(...)`,
  `watchSnapshot(...)`, and `watchStates(...)` remain the focused public reads and
  subscriptions.

Focused reads are live and intentionally independent. Two separate getter calls
can observe different source revisions when a transition occurs between them;
they do not promise an atomic inspection bundle. Long-lived consumers should
use the public subscriptions and command results to remain synchronized.

Everything else stays private:

- no public `projections:` config,
- no public registry,
- no public `bind`, `inspect`, or `project` method,
- no public inspection type or `getBlueprint()` alias,
- no public `Projection<Format, Output>` generic,
- no behavior-presentation metadata threaded through adapters.

## Internal runtime model

Ignite's projection runtime is an internal substrate built around one private,
coherent inspection read. It captures one deterministic bundle for each
projection validation and commit attempt:

- snapshot,
- derived states,
- schema,
- `canExecute`,
- validated `ProjectionDocument` state,
- stable revision identity.

That private read feeds binders and committers:

- DOM rendering,
- accessible JSX mapping,
- terminal or text outputs,
- speech outputs,
- future first-party non-DOM targets.

Committers are imperative-shell adapters. They consume deterministic facts and
return facts such as success, unsupported capability, or explicit error. They
do not become the source of truth.

For each attempt, the projection document and behavior facts come from the same
captured revision. An asynchronous external commit is not transactional with
source transitions that occur after that capture. Coherent inspection remains
an implementation primitive rather than a public bootstrap convenience: there
is no public `inspect()` method or inspection-bundle type.

## ProjectionDocument state

Dynamic multi-channel output is represented as actor-owned validated
`ProjectionDocument` data, not as generated UI code.

`ProjectionDocument` is:

- durable source state,
- revisioned,
- stable-id based,
- validated before commit,
- shared across channels.

The document catalog is semantic and safe. Node families include:

- text,
- checklist,
- form,
- table,
- timeline,
- chart,
- code diff,
- decision log,
- command-backed action.

Validation rejects executable or environment-coupled content, including:

- raw JSX,
- JavaScript,
- imports,
- event handlers,
- DOM references,
- arbitrary executable strings passed off as UI.

### Projection data trust boundary

Projection documents are rebuilt as canonical JSON-like data before validation
or commit. Arbitrary business data is preserved only in the documented action,
form, and table data islands. The URI-bearing keys are `action`, `formaction`,
`href`, `src`, and `xlink:href`. At those keys, strings and dense arrays use a
deterministic, non-invoking coercion model: nested arrays are joined with
commas, null contributes an empty segment, and other JSON scalar or object
elements contribute the fixed blocker `#`. The completed candidate rejects
`javascript:`, `vbscript:`, `data:text/html`,
`data:application/xhtml+xml`, and `data:image/svg+xml` without calling
application coercion hooks.

This validation begins after an adapter has acquired source state. Redux passes
store state through directly. MobX observable evaluation through `toJS`,
Actor-Web snapshot and `toJSON` callbacks, and custom adapter source callbacks
remain trusted programmatic boundaries outside the canonical projection-data
contract. XState snapshots are flattened with property descriptors so
projection-bearing accessors are preserved for fail-closed inspection rather
than invoked by Ignite's adapter.

## Command-backed actions

Action nodes never carry closures. They reference existing runtime commands by
name and are validated against the runtime contract:

1. the command must exist in `getSchema().commands`,
2. any payload must satisfy the declared schema,
3. commit-time execution must still respect current availability through
   `canExecute`.

This keeps actions grounded in the same command system that already powers
`execute()`.

## LLM authorship flow

LLMs do not generate JSX, DOM fragments, or executable projection code.

Instead:

1. `igniteTools` exposes the runtime schema as tools,
2. the model issues explicit domain commands such as `upsertProjection` or
   `patchProjection`,
3. those commands write validated `ProjectionDocument` state,
4. Ignite committers consume the resulting durable document.

That keeps provider/model contracts outside `igniteCore` while still letting a
model author or patch projection content.

## Speech is request-driven

Persistent projections such as DOM, terminal, or text summaries are
change-driven and should only re-commit when the inspected revision changes.

Speech is different:

- speech is request-driven, not change-driven,
- authored text or structured speech is first written to durable state,
- each utterance has a stable identity,
- a speech committer acknowledges each utterance at most once,
- rebinding or rereading state must not replay acknowledged speech.

Microphone handling and provider loops remain outside core. Ignite only consumes
validated state and commits it through an injected speech-capable target.

## Lifecycle rules

The non-DOM overload follows existing runtime ownership semantics:

- shared source:
  - sessions reuse the shared runtime access path,
  - disposing one session releases only that binding,
  - consumer-owned shared sources stay alive;
- isolated source:
  - each session owns its own adapter subscription path,
  - disposing tears down only that session.

DOM and non-DOM sessions can coexist on the same `igniteCore` value.
Non-DOM sessions must not depend on `customElements`, `ShadowRoot`, or DOM
globals.

## Accessibility relationship

Accessible DOM rendering is one committer over the same validated semantic
document. Ignite does not solve accessibility by adding a second callback DSL or
by asking models to write DOM directly. The runtime owns behavior facts and
validated semantic documents; rendered DOM owns final browser accessibility
semantics.

## Rejected approaches

- Public `ProjectionRequest` / `ProjectionSpec` / registry selection.
- Public `project()` / `bind()` / `inspect()` methods.
- A public inspection-bundle type or `getBlueprint()` alias.
- Behavior-presentation metadata embedded into `igniteCore` commands or adapter
  config.
- Raw model-authored JSX, HTML, or JavaScript as runtime projection output.
- Committers that own truth instead of consuming actor-owned state.

## Decision

The public boundary is:

- executable authoring input through `igniteCore(config)`,
- `getSchema()` as the sole compiled JSON-safe Ignite blueprint,
- focused live getters, availability reads, command execution, and
  subscriptions,
- and exactly one narrow non-DOM overload through an opaque target.

The private projection boundary is:

- a private coherent inspection primitive,
- a private `Projection<Format, Output>` substrate,
- actor-owned validated `ProjectionDocument` state,
- command-backed semantic actions,
- and request-driven speech with stable utterance identity.

No public `inspect()` method, inspection-bundle type, registry, or
`getBlueprint()` alias crosses that boundary.
