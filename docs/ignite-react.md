# Design: `ignite-element/react` — schema-driven typed React wrapper

## Status

Proposed (design only — not implemented). **Additive** (new entrypoint + one
additive change to the `igniteCore` registration return type). Output of the
framework-interop gap-finder (see `v3-examples-track`). Part of
`docs/v3-api-consistency.md`.

## Context

The interop gap-finder confirmed ignite elements **are** consumable from
frameworks via the standard custom-element surface, but it is **imperative**:

- **Commands in** — reflected as element methods (`exposeCommands`,
  `IgniteElementFactory.ts`) → `el.increment()`; single-arg `setX(v)` commands
  also map to observed string attributes (`inferObservedAttributes`).
- **Events out** — dispatched as `CustomEvent`s on the host
  (`createComponentFactory.ts`) → `el.addEventListener(type, …)`.
- **State out** — only via emitted events.

A professional React integration therefore encapsulates this seam in a thin
wrapper so app code stays declarative. Two ways to get that wrapper:

- **(A) Hand-rolled wrapper per element** — works today, no new dependency, but
  every element pays a tax: a hand-written element interface, JSX declaration,
  event wiring, and ref plumbing that must be kept in sync by hand. It also does
  not scale across four frameworks.
- **(B) A schema-driven helper** — ignite already emits `getSchema()` (commands,
  events, shapes) for agents; that is exactly the metadata a wrapper needs. One
  helper, written once, turns any ignite element into an idiomatic typed React
  component — and the same approach regenerates Vue/Svelte/Angular wrappers.

**Decision: ship (B).** It removes per-element boilerplate, reuses the
agent-drivability investment, and is the differentiated interop story (ignite
*gives* you idiomatic React, you don't hand-write it).

## Decision

### 1. Registration returns a typed component handle (additive prerequisite)

Today `igniteCore(config)` returns a **registrar**, and a registrar can register
**many** tags (the xstate example registers `my-counter-xstate`,
`shared-display-xstate`, `gradient-tally`, … from one core). So the tag binds at
**registration**, not on the registrar — which is why `igniteReact` cannot take a
bare registrar and must not need a separate `tagName`.

So `register(tagName, render)` returns a typed handle instead of `void`:

```ts
interface IgniteComponent<Commands, Events> {
  readonly tagName: string;
  getSchema(): IgniteSchema;        // already exists at the core level
  // phantom Commands/Events carry the compile-time types igniteReact infers from
}
```

This is additive (callers ignoring the return are unaffected) and is useful
beyond React — a typed per-element handle can also sharpen the test DSL and agent
ergonomics. Sites: the registrar from
`igniteCore/createIgniteComponentFactory.ts` and the handle type in
`igniteCore/types.ts`.

### 2. `igniteReact(component)` — no `tagName`, no hand-written types

```ts
function igniteReact<Commands, Events>(
  component: IgniteComponent<Commands, Events>,
): React.ForwardRefExoticComponent<
  IgniteReactProps<Commands, Events> & React.RefAttributes<CommandHandle<Commands>>
>;
```

Usage:

```tsx
// counter.ignite.ts — authored as today; registration now returns a handle
export const Counter = igniteCore({
  source: counterMachine,
  view: ({ snapshot }) => ({ count: snapshot.context.count, label: snapshot.context.label }),
  commands: ({ actor }) => ({
    increment: () => actor.send({ type: "INC" }),
    decrement: () => actor.send({ type: "DEC" }),
    setLabel: (label: string) => actor.send({ type: "SET_LABEL", label }),
  }),
  events: (event) => ({ countChanged: event<{ count: number }>() }),
})("my-counter", ({ count, label }) => <>{label}: {count}</>);

// Counter.react.ts — the whole wrapper
import { igniteReact } from "ignite-element/react";
import { Counter as CounterEl } from "./counter.ignite";
export const Counter = igniteReact(CounterEl);

// App.tsx — idiomatic React, fully typed; the ref is the typed CommandHandle
// import { type IgniteReactRef } from "ignite-element/react";
// const ref = useRef<IgniteReactRef<typeof CounterEl>>(null);
// <Counter ref={ref} label="Visitors" onCountChanged={(e) => setCount(e.count)} />
```

### 3. Inference rules

From the handle's `Commands` / `Events` generics + `getSchema()` at runtime:

- **Commands** → the imperative **ref API** (`CommandHandle<Commands>` —
  `increment()`, `decrement()`, `setLabel(label)`). Type the `useRef` with the
  public `IgniteReactRef<typeof Handle>` — it derives that `CommandHandle` from
  the handle, so the ref stays in sync with the element's commands with no
  hand-written shape. (`React.ComponentRef<typeof ReactCounter>` resolves to
  `never` for the synthesized `forwardRef` component, so `IgniteReactRef` is how
  you name the ref type.)
- **Single-arg `setX` commands** → optional **props** (`label?: string`), set as
  string attributes (mirrors `inferObservedAttributes`).
- **Events map** → `on<Event>` **callback props**
  (`onCountChanged?: (e: { count: number }) => void`), receiving the DOM event
  detail directly.
- Unmapped props → attribute/property passthrough.

### 4. Wrapper internals (sketch)

```tsx
export function igniteReact(component) {
  const eventTypes = component.getSchema().events.map((event) => event.type);
  return forwardRef(function IgniteReact(props, ref) {
    const elRef = useRef(null);
    const { handlers, attrs } = splitProps(props, eventTypes);
    useEffect(() => {                                   // wire events, clean up
      const el = elRef.current;
      const offs = eventTypes.map((type) => {
        const cb = handlers[toHandlerName(type)];       // "countChanged" → "onCountChanged"
        if (!cb) return () => {};
        const l = (e) => cb(e.detail);
        el.addEventListener(type, l);
        return () => el.removeEventListener(type, l);
      });
      return () => offs.forEach((off) => off());
    });
    useImperativeHandle(ref, () => bindCommands(elRef, component.getSchema().commands));
    return createElement(component.tagName, { ref: elRef, ...attrs });
  });
}
```

Target **React 19**; the wrapper pattern works under React 18 too (commands are
methods, events are `CustomEvent`s — both go through the ref/listener regardless,
so the 18-vs-19 difference is minor).

## Impact

- **Additive** — new `ignite-element/react` entrypoint (with `react` as a peer of
  that entrypoint only) + registration return `void` → handle. No change to
  `igniteCore`'s config or to existing elements.
- **Event detail shape** — the wrapper forwards `event.detail` directly. On the
  host `CustomEvent`, `detail` is the bare payload (effects emits) / the whole
  member (source emits) — **not** the `{ type, payload }` envelope (that exists
  only inside `execute().events` / `record()`, which the wrapper never uses; see
  `createComponentFactory.ts:126` and `runtime/agent.ts:180`). Keep one normalize
  seam so the future flat event-shape change (`docs/event-shape.md`) is a one-line
  update.
- **Generalizes** — the same handle + `getSchema()` drives Vue/Svelte/Angular
  wrappers as follow-up entrypoints.

## Alternatives considered

- **(A) Hand-rolled per-element wrapper** — rejected as the primary: per-element
  boilerplate + drift; does not scale to four frameworks. (Still the fallback for
  consumers who don't want the helper; document it in the guide.)
- **`@lit/react` `createComponent`** — rejected: it needs the element **class**
  (`elementClass`), but ignite defines elements through registrars and exports no
  class. The registrar/handle model is the ignite-native fit.
- **Pass `tagName` to `igniteReact`** — rejected: redundant once registration
  returns a tag-aware handle.
- **Bake the tag into `igniteCore` (1:1 core↔tag)** — rejected: breaks the
  one-registrar-many-tags capability the examples rely on.

## Open questions / next steps

- The hard part is the **TS inference**: mapping the `Events` map to `on<Event>`
  callback props, `Commands` to the ref API, and single-arg `setX` to props.
  Spike the type-level mapping early.
- Implement step 1 (registration → typed handle) first; everything else builds on
  it.
- Build `ignite-element/react` (entrypoint, `package.json` exports, build wiring,
  tests), then the React demo consuming it; extend
  `guides/host-app-integration.mdx` (don't duplicate).
- Sequence in **Phase 1** (`docs/v3-stable-roadmap.md`) so the demo showcases it
  and the handle change lands before the breaking cutover.

## Related

- `docs/v3-api-consistency.md`, `docs/event-shape.md`, `docs/v3-stable-roadmap.md`
- Memory: `v3-examples-track`, `expose-source-native-api`, `agent-runtime-api-naming`
