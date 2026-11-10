# Projection ownership and the headless runtime

## Status

The approved v3 simplification removes `createProjectionDocumentTarget`,
`createProjectionSpeechTarget`, and the one-argument `core(target)` overload.
This supersedes the earlier opaque-target design. No replacement public API is added.

## Public contract

The canonical flow remains:

`source → source-native snapshot → derived states → renderer view`

- Construct behavior with `igniteCore({ source, states, commands, events, effects })`.
- Register DOM presentation with `core("element-name", renderer)`.
- Read derived state with `get("states")`; observe it with `watch`.
- Express intent through commands and `execute`; receive outward facts through `on`.
- Keep explicit tool schemas in application code. `get("schema")` remains a minimal
  immutable catalogue with unknown schemas represented by null.
- Release an observation with its unsubscribe handle. Owning core disposal is separate.
  Neither operation shuts down a borrowed source.

No public target, registry, inspection bundle, or additional binding API is needed.
The source-free root registrar retains its existing DOM registration contract.

## Application document delivery

Semantic documents, component catalogs, and backend- or model-driven views are
application patterns. Ignite does not scan source snapshots for specially named
`documents`, `projection`, or `speech` fields. An application explicitly projects
what its consumer needs and validates untrusted data at its own boundary.

For example, voice-workbench's private `observeWorkbenchDocuments` observes the
ordinary derived view, copies and validates its artifact catalog, and delivers the
first artifact. It retains revision deduplication, serialized asynchronous delivery,
error reporting and retry on a subsequent notification. Disposing it unsubscribes;
the application still owns source shutdown. It uses supported `ignite-element/tools`
validation, never private framework imports.

```ts
const documents = observeWorkbenchDocuments(component, (document) => {
  source.send({ type: "DOCUMENT_COMMITTED", document: {
    id: document.id, title: document.title, revision: document.revision,
  } });
});
// At the application boundary:
documents.dispose();
```

The helper and artifact types belong to the example, not the published Ignite API.
Its parser retains descriptor-based plain-data copying, explicit semantic node
allowlists, command/payload validation, and executable-content/URI rejection.
Raw model-authored JSX, JavaScript, handlers, imports, and DOM references remain
untrusted. Minimal discovery is not a substitute for an explicit input schema or
source authorization.

## Speech ownership

Voice-workbench's existing source-native speech statechart issues correlated port
requests. The application driver owns browser speech I/O, cancellation and cleanup.
Acknowledgement follows an accepted delivery receipt; unrelated source updates do
not speak again. Explicit replay creates another source-owned attempt. Observation
cleanup alone does not cancel application work or stop its source.

## Retained DOM resources

Canvas refs, keyed identity, hosts/use, cleanup and accessible DOM descriptions
remain presentation-owned. Removing target delivery does not change these contracts.
The broader retained `commit` design remains a separate pre-stable proposal; it is
not introduced by this removal.

## Bundle work

This stage removes the target-only validation, inspection and binding paths from
the package. Internal dependency separation is a later stage. The callable core
still includes DOM registration, so a smaller headless bundle is not evidence that
all presentation dependencies have been separated.
