# Design: View/effects context canonicalization — uniform `{ snapshot }`

## Status

Implemented. **Breaking.** Part of `docs/v3-api-consistency.md`.

## Context

The `view` (and effect) context is built by spreading the snapshot onto the context
object (`createProjectionFactory`: `{ ...snapshot, snapshot }`). Two problems:

1. **Two paths to the same data** — `ctx.count` *and* `ctx.snapshot.count` both work
   → ambiguous, fragile to refactor, unclear which is "the" path.
2. **Shape differs per adapter** — what you destructure depends on the adapter's
   snapshot:
   - xstate: `view: ({ snapshot }) => snapshot.context.x`
   - redux / mobx: `view: ({ snapshot }) => snapshot.x` (the snapshot *is* the state)
   - actor-web: `view: ({ snapshot }) => …` (reads `snapshot.context` and `snapshot.transport`)

   So the **arg shape is heterogeneous** across adapters — a consumer learns a
   different destructure per source, which undercuts "swap the source without
   rewriting views."

## Decision

The callback receives a single uniform arg: **`{ snapshot }`** (no spread). One arg
shape on every adapter; one path to data:

```ts
view: ({ snapshot }) => ({ on: snapshot.matches("on") });            // xstate
view: ({ snapshot }) => ({ count: snapshot.count });                 // mobx / redux
view: ({ snapshot }) => ({                                            // actor-web
  status: snapshot.context.status,
  connected: snapshot.transport.state === "connected",
});
```

`snapshot`'s *internal* shape stays adapter-specific (that is your state model, and
inherent) — but the **arg shape is uniform**, the data path is single (`snapshot.*`),
and it matches the runtime's `getSnapshot()` vocabulary (author == observe).

### Before → after

```ts
// before — spread + per-adapter destructure + dual path
view: ({ context }) => ({ route: context.route })                    // xstate
//   also worked: ({ snapshot }) => ({ route: snapshot.context.route })  ← ambiguity

// after — uniform { snapshot }, single path
view: ({ snapshot }) => ({ route: snapshot.context.route })
```

## Impact

Breaking for consumers who destructure top-level fields (`{ context }`, or spread
state fields) — they move to `snapshot.*`. Confirm the **effects** context is already
`{ snapshot, prevSnapshot, … }` (no spread) so the two callbacks match. Ship with a
changeset + migration note; land with the other breaking items
(`docs/v3-api-consistency.md`).

## Alternatives considered

- **Keep the spread, document the canonical path** — rejected: ambiguity remains.
- **Force a uniform `{ context }` wrapper on all adapters** — rejected: redux/mobx
  have no `context`; artificial.
- **Provide both `{ snapshot, context }` explicitly** — rejected: re-introduces the
  dual path.

## Open questions

- No deprecated convenience alias in v3 beta; the cutover removes the spread.
- Headless `getView()` uses the same projection path as element rendering.
