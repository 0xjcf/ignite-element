# Design: Internal projection runtime over behavior contracts

## Status

Accepted replacement direction for the Ignite Element v3 beta design window.
This document supersedes the earlier registry-oriented proposal.

## Why this changed

Ignite already has the right behavior boundary:

- `view` derives stable UI-facing state from the source snapshot.
- `getView()` returns that derived state to headless consumers.
- `getSchema()` returns JSON-serializable commands, events, snapshot, and view.
- `execute()` and `canExecute()` keep intent and availability explicit.

The rejected design added a public projection registry and selection model on top
of those contracts. That widened the API surface, split ownership across config
and runtime, and encouraged projection-specific metadata to leak into
`igniteCore`.

The replacement keeps the behavior boundary intact and adds only one narrow
public seam: the existing callable `igniteCore(...)` value can be used either as
`component(tagName, renderer)` for DOM registration or as `component(target)`
for a first-party non-DOM projection target.

## Public contract

The public surface remains intentionally small:

- `igniteCore` keeps the current source, view, commands, events, and effects
  config shape.
- `counter(tagName, renderer)` remains source-compatible.
- One additive overload is allowed: `counter(target)`.
- `target` is a first-party opaque branded value, not a plain object, callback,
  registry key, or model-authored document.
- The one-argument overload returns only a disposable handle:
  `{ dispose(): void }`.

Everything else stays private:

- no public `projections:` config,
- no public registry,
- no public `bind`, `inspect`, or `project` method,
- no public `Projection<Format, Output>` generic,
- no behavior-presentation metadata threaded through adapters.

## Internal runtime model

Ignite's projection runtime is an internal substrate built around one coherent
inspection read. Every DOM and non-DOM consumer must start from the same
deterministic bundle:

- snapshot,
- derived view,
- schema,
- `canExecute`,
- validated `ProjectionDocument` state,
- stable revision identity.

That read feeds private binders and committers:

- DOM rendering,
- accessible JSX mapping,
- terminal or text outputs,
- speech outputs,
- future first-party non-DOM targets.

Committers are imperative-shell adapters. They consume deterministic facts and
return facts such as success, unsupported capability, or explicit error. They
do not become the source of truth.

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
form, and table data islands. At URI-bearing keys, strings and dense arrays use
a deterministic, non-invoking coercion model: nested arrays are joined with
commas, null contributes an empty segment, and other JSON scalar or object
elements contribute a fixed blocker. The completed candidate is checked for
executable schemes and executable HTML or SVG data URLs without calling
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
- Behavior-presentation metadata embedded into `igniteCore` commands or adapter
  config.
- Raw model-authored JSX, HTML, or JavaScript as runtime projection output.
- Committers that own truth instead of consuming actor-owned state.

## Decision

Ignite's projection runtime is now defined as:

- a private coherent inspection primitive,
- a private `Projection<Format, Output>` substrate,
- actor-owned validated `ProjectionDocument` state,
- command-backed semantic actions,
- request-driven speech with stable utterance identity,
- and exactly one narrow public non-DOM overload through an opaque target.
