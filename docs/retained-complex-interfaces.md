# Retained complex interfaces

## Status and decision

Accepted on 2026-07-11 for the Ignite Element v3 beta design window. This is a
pre-stable architecture contract and the normative input to the retained-interface
implementation epic.

Ignite will support retained imperative presentation surfaces through the
existing two-stage component API:

```tsx
const component = igniteCore({ source, view, commands, events, effects });

component("pong-game", ({ frame }) => (
  <canvas
    ref={retainCourt}
    commit={(canvas) => drawPong(canvas, frame)}
  />
));
```

Ignite JSX reserves two generic directives:

- `ref` acquires the rendered element and may return its cleanup; and
- `commit` receives that element after reconciliation and ref acquisition. The
  current projection remains an ordinary lexical value captured by the callback.

Neither directive becomes a DOM property or attribute. This design adds no
configuration, overload, canvas helper, or framework-owned scheduler. Consumers
that need microtask or animation-frame coalescing own it inside the retained
resource until canvas and Mesh Pong dogfood justify a separate framework decision.

This task changes documentation only. Production behavior and package changesets
belong to the downstream implementation slices.

## Alignment with the current v3 beta API

| Surface | Current beta evidence | Accepted change |
| --- | --- | --- |
| Component registration | The value returned by `igniteCore` retains the existing `(elementName, renderer)` callable signature, while a separate one-argument overload binds an opaque non-DOM projection target. [types.ts:97-149](../packages/ignite-element/src/igniteCore/types.ts#L97-L149) | Keep `component("name", renderer)` unchanged. Do not add a registration stage or core option. |
| Runtime and registration on one value | DOM registration validates a string name plus renderer, returns the component handle, and the agent runtime is assigned onto that same callable. [IgniteElementFactory.ts:1077-1105](../packages/ignite-element/src/IgniteElementFactory.ts#L1077-L1105), [IgniteElementFactory.ts:1294-1303](../packages/ignite-element/src/IgniteElementFactory.ts#L1294-L1303) | The renderer callback continues to receive the existing projected render arguments. |
| JSX keys | JSX elements and the runtime carry `key`, but normalized renderer nodes omit it. [types.ts:15-19](../packages/ignite-renderer/src/renderers/jsx/types.ts#L15-L19), [jsx-runtime.ts:11-24](../packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts#L11-L24), [renderer.ts:23-32](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L23-L32) | Preserve key metadata privately and reconcile fully keyed sibling lists by identity. |
| Child reconciliation | Children are patched by array position; incompatible or reordered nodes can be replaced. [renderer.ts:159-216](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L159-L216), [renderer.ts:234-328](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L234-L328) | Preserve compatible keyed nodes across insertion, removal, and reorder while leaving the unkeyed positional path intact. |
| JSX directives | The renderer currently skips `ref`; every other non-child prop follows the generic property/attribute path. [renderer.ts:330-348](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L330-L348), [renderer.ts:406-465](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L406-L465) | Activate supported callback refs and reserve `commit` so both are renderer metadata and never DOM props. |
| Presentation cadence | Every active adapter notification updates current state and renders synchronously. [IgniteElement.ts:173-186](../packages/ignite-element/src/IgniteElement.ts#L173-L186), [IgniteElement.ts:221-231](../packages/ignite-element/src/IgniteElement.ts#L221-L231) | Keep this cadence. A consumer may coalesce its imperative drawing inside `commit` without changing source delivery. |
| Effect ordering | Effects use a separate subscription and defer through a microtask on the assumption that rendering occurred first. [effects.ts:78-123](../packages/ignite-element/src/runtime/effects.ts#L78-L123) | Finish reconciliation, ref acquisition, and `commit` inside the existing render before the current post-render effect phase. Do not create a second effect system. |
| Move-safe lifecycle | True-disconnect teardown is already deferred by one microtask and canceled by a same-tick reconnect. [IgniteElement.ts:21-58](../packages/ignite-element/src/IgniteElement.ts#L21-L58), [IgniteElement.ts:105-160](../packages/ignite-element/src/IgniteElement.ts#L105-L160) | Put retained cleanup behind the same true-disconnect decision so DOM moves preserve resources. |
| Strategy lifecycle | Render strategies already expose private attach, render, and optional detach operations. [RenderStrategy.ts:1-5](../packages/ignite-renderer/src/renderers/RenderStrategy.ts#L1-L5), [IgniteJsxRenderStrategy.ts:40-53](../packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts#L40-L53), [IgniteJsxRenderStrategy.ts:72-113](../packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts#L72-L113) | Reuse this internal boundary; add no public lifecycle object. |
| Projection targets | First-party non-DOM targets are opaque document or speech committers with private configuration and delivery identity. [projectionTargets.ts:14-52](../packages/ignite-element/src/runtime/projectionTargets.ts#L14-L52), [projectionTargets.ts:79-133](../packages/ignite-element/src/runtime/projectionTargets.ts#L79-L133), [projectionBinding.ts:159-260](../packages/ignite-element/src/internal/projectionBinding.ts#L159-L260) | Keep this overload separate. A retained DOM element is not another projection target. |

## Exact JSX contract

The directives are contextually typed on Ignite JSX intrinsic elements. They do
not require consumers to import new lifecycle types.

For an intrinsic element of type `T extends Element`, their effective callback
shapes are:

```ts
ref?: (node: T) => void | (() => void | PromiseLike<void>);
commit?: (node: T) => void;
```

These callback shapes are part of the JSX renderer contract, not additions to
the `igniteCore` configuration or headless runtime.

### Ref semantics

- `ref` receives the actual element and never receives `null`.
- A returned function is the one cleanup associated with the `(node, ref)` pair.
- Stable node plus stable ref identity does not reacquire on ordinary renders.
- A changed ref identity invokes the old cleanup, then acquires with the new ref.
- The runtime consumes a stored cleanup before invoking it, preventing reentrant
  double cleanup.
- Cleanup may return a promise-like value. Ignite observes rejection but does not
  await completion before reconciliation or detach continues.

Because callback identity is meaningful, retained acquisition callbacks should
normally be declared once outside the renderer callback rather than recreated on
every projection.

### Commit semantics

- `commit` receives only the reconciled element. Projection values are captured
  lexically by the callback created for that render.
- It runs after DOM props/children reconcile and after any required ref cleanup
  and acquisition for that element.
- It runs once for every presentation of that element, including initial mount
  and ordinary repeated projections.
- It never becomes an attribute, property, event listener, command, source event,
  or effect.
- A thrown error is contained and reported without rolling back the DOM,
  destroying the retained resource, or suppressing unrelated callbacks.
- A returned thenable has no commit meaning. Ignite only observes rejection so
  accidental async callbacks cannot create unhandled rejections.

## Consumer-owned scheduling

The framework remains synchronous. A high-frequency consumer can retain one
resource and coalesce its own presentation work:

```tsx
type CourtFrame = { ballX: number; ballY: number };

const court = {
  canvas: undefined as HTMLCanvasElement | undefined,
  latest: undefined as CourtFrame | undefined,
  frameId: undefined as number | undefined,
};

const retainCourt = (canvas: HTMLCanvasElement) => {
  court.canvas = canvas;

  return () => {
    if (court.frameId !== undefined) cancelAnimationFrame(court.frameId);
    court.canvas = undefined;
    court.latest = undefined;
    court.frameId = undefined;
  };
};

const scheduleCourtDraw = (canvas: HTMLCanvasElement, frame: CourtFrame) => {
  court.latest = frame;
  if (court.frameId !== undefined) return;

  court.frameId = requestAnimationFrame(() => {
    court.frameId = undefined;
    if (court.canvas === canvas && court.latest) drawPong(canvas, court.latest);
  });
};

const component = igniteCore({
  source: tableSource,
  states: (snapshot) => ({ frame: snapshot.context.frame }),
});

component("pong-game", ({ frame }) => (
  <section>
    <canvas
      key="court"
      ref={retainCourt}
      commit={(canvas) => scheduleCourtDraw(canvas, frame)}
    />
    <output aria-live="polite">{describeFrame(frame)}</output>
  </section>
));
```

Every source projection still reaches the renderer synchronously. The consumer
stores the latest presentation input and schedules drawing without changing
commands, events, effects, telemetry, or authoritative transition history. Its
returned ref cleanup owns cancellation.

Microtask coalescing follows the same pattern with a consumer-owned pending flag
and `queueMicrotask`. Ignite does not standardize that policy in this slice.

## Ownership boundaries

| Concern | Owner | Contract |
| --- | --- | --- |
| Authoritative snapshots and transitions | Source runtime | Every source notification remains real and ordered. DOM presentation cannot rewrite source history. |
| Actor lifecycle, topology, transport startup/status, and multi-actor coordination | Actor-Web or the source adapter | Ignite consumes snapshots/read models and command access. The current adapter explicitly leaves runtime ownership with Actor-Web. [actor-web.ts:106-108](../packages/ignite-element/src/igniteCore/actor-web.ts#L106-L108) |
| Fixed-step simulation, game loop, physics, and match truth | Consumer domain/runtime | Never moved into Ignite, refs, commits, effects, or DOM state. |
| View derivation and DOM reconciliation | Ignite | Invoke the existing renderer callback with projected values and reconcile its returned view. |
| DOM identity, key matching, ref bookkeeping, and callback ordering | Ignite JSX renderer | Private renderer state decides reuse, move, replacement, acquisition, commit, and cleanup. |
| Canvas context, editor/map/video instance, observer, listener, and local draw queue | Consumer presentation code | Acquire through `ref`, update through `commit`, and release through returned cleanup. |
| Commands and source-emitted events | Existing Ignite/source contracts | Delivered independently of retained presentation work. |
| Effects | Existing Ignite effect runtime | Remain consequence-oriented and post-render. They do not draw or own retained resources. |
| Advisory or agent policy | Owning behavior/runtime layer | Never becomes renderer or DOM authority. |
| Accessibility | Semantic DOM authored by the consumer and reconciled by Ignite | Retained pixels require native controls, labels, status, and alternatives where appropriate. |

## Lifecycle conformance matrix

"Cleanup" below means that Ignite removes the stored cleanup from its registry
before invoking it. Async cleanup invocation is ordered, but completion is not
awaited.

| Scenario | DOM identity | Ref cleanup/acquisition | `commit` |
| --- | --- | --- | --- |
| Initial mount | Create the node. | Acquire once after the node and ordinary props/children reconcile. | Run once after acquisition. |
| Stable repeated projection | Preserve the node. | No cleanup or reacquisition when ref identity is stable. | Run once for each presentation with the callback from that projection. |
| Same node, changed ref identity | Preserve the node. | Invoke old cleanup once, then invoke the new ref once. | Run after the new ref phase. |
| Node or tag replacement | End old identity and create replacement. | Invoke old subtree cleanup deepest-child-first; acquire the new subtree parent-first in DOM order. | Run for the new subtree after acquisition. |
| Key change | Treat as removal plus insertion even if tag matches. | Cleanup old keyed identity and acquire the new one. | Run for the new identity. |
| Compatible keyed reorder | Move and preserve the exact node. | No cleanup or reacquisition. | Run after move and prop reconciliation. |
| Same-tick host move | Preserve strategy tree because deferred disconnect is canceled. | No cleanup or reacquisition solely for the transient disconnect. | Run only for the normal presentation triggered by reconnect; no extra callback is invented for teardown. |
| True disconnect | End the attached presentation identity. | Invoke every active cleanup once, deepest-child-first, then detach strategy state. Consumer cleanup cancels local frames/microtasks. | Never run after true-disconnect invalidation. |
| Reconnect after true disconnect | Attach strategy before rendering the latest source projection. | Acquire refs for the new attached tree once; do not repeat old cleanup. | Run after the reconnect reconciliation/acquisition. |
| Source replacement | Rebind component presentation to the replacement source under existing source ownership rules. | Reacquire only if node or ref identity changes. | Never use a callback/projection captured from the replaced source. |
| Strategy replacement or detach | End old strategy identity; attach the replacement before rendering. | Cleanup the old retained subtree before detach; acquire only in the new attached tree. | Run only against the new strategy's reconciled nodes. |

## Callback and error conformance

| Case | Required behavior |
| --- | --- |
| Ref returns cleanup | Store exactly one cleanup for the node/ref pair. Consume it before invocation. |
| Ref throws | Report the error, store no cleanup, continue unrelated refs and commits, and do not roll back DOM. |
| Ref returns an accidental thenable | It is not cleanup. Observe rejection and store nothing. |
| Cleanup returns `PromiseLike<void>` | Observe fulfillment/rejection without awaiting it before setup, removal, detach, or sibling cleanup. |
| Cleanup throws or rejects | Report once and continue new acquisition, DOM removal, strategy detach, adapter teardown, and sibling cleanup. |
| Commit throws | Report once; do not roll back DOM, tear down the ref, or suppress unrelated commits. |
| Commit returns an accidental thenable | Ignore its value and observe rejection through the common reporter. |
| Host has an error handler | Use `host.handleError(error)` first, then `host.onError(error)`; otherwise use `console.error`, matching current effect error precedence. [effects.ts:32-61](../packages/ignite-element/src/runtime/effects.ts#L32-L61) |
| Multiple callbacks fail | Report each and finish deterministic traversal: cleanup deepest-child-first; acquisition and commit parent-first DOM order. |

## Keyed reconciliation contract

| Input shape | Matching rule | Result |
| --- | --- | --- |
| No sibling has a key | Existing positional reconciliation. | Source-compatible unkeyed behavior. |
| Every material sibling has one unique non-null key | Match key plus compatible node kind, tag, and namespace. | Patch and move the existing node; preserve focus, selection, listeners, ref cleanup, canvas/WebGL context, and other retained state. |
| Key exists but kind/tag/namespace is incompatible | Identity is incompatible. | Cleanup old node and replace/acquire a new one. |
| Key changes | Old key is removed and new key inserted. | Replacement semantics even when the tag is unchanged. |
| Keyed insertion/removal | Match all other keys. | Acquire only the inserted node; cleanup only the removed node. |
| Duplicate keys | Invalid keyed list. | Emit a development diagnostic and deterministically replace the whole sibling list. Never guess a winner. |
| Mixed keyed and unkeyed siblings | Invalid keyed list. | Emit a development diagnostic and deterministically replace the whole sibling list. Never combine identity models. |
| Keyed component/fragment does not normalize to one material node | Invalid keyed slot. | Diagnose and replace the sibling list; range identity is outside this contract. |

Keys remain private JSX identity metadata and never become DOM properties or
attributes. The current runtime already supplies keys separately from props.
[jsx-runtime.ts:11-24](../packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts#L11-L24)

## Effects, commands, and deterministic testing

The retained directives stay inside one synchronous presentation:

1. receive and store the source snapshot through the existing adapter path;
2. derive the renderer callback arguments;
3. reconcile DOM and keyed identity;
4. invoke required ref cleanup/acquisition;
5. invoke `commit` callbacks;
6. record the existing `rendered` lifecycle stage; and
7. allow the existing effect microtask to run afterward.

Commands and source-emitted events never pass through the renderer callbacks.
Consumer-owned draw coalescing may skip visual frames, but it cannot skip source
notifications, command delivery, events, or effects.

Framework tests use fake elements and controlled promise-like values to verify
callback order, exactly-once cleanup, move preservation, errors, and SSR safety.
The canvas example owns fake animation-frame/microtask clocks for its local draw
queue. No framework scheduler clock or flush API is added by the lifecycle task.

## SSR and headless safety

- Creating or using the headless runtime must not read `document`, `Element`, or
  animation-frame globals.
- Ref and commit callbacks run only after a DOM strategy creates a real element.
- `getSchema()`, `getStates()`, commands, events, and non-DOM projection targets do
  not acquire retained nodes or schedule presentation work.
- No DOM means no synthetic ref acquisition or commit callback.
- A stale callback captured before detach cannot run against a later tree.
- This contract adds no hydration, DOM serialization, server canvas, or global
  timer polyfill.

The existing minimal headless polyfill supplies only `HTMLElement` and
`customElements` fallbacks, not `document` or animation-frame globals.
[setupDomPolyfill.ts:8-35](../packages/ignite-element/src/internal/setupDomPolyfill.ts#L8-L35)

## Scheduling evidence gate

Framework-owned commit scheduling is deferred until after two consumers exercise
the simpler contract:

1. the in-repo retained canvas stress example; and
2. read-only validation against Actor-Web Mesh Pong.

The later verdict task may close with **no framework API**. It may propose a
separate implementation brief only when evidence shows all of the following:

- both consumers repeat materially equivalent scheduling and cancellation glue;
- consumer-owned queues cannot preserve the required renderer/lifecycle ordering;
- the framework can preserve synchronous default rendering, commands, events,
  effects, and source authority;
- the policy is local to component registration rather than core source config;
- deterministic tests can state coalescing, disconnect, reconnect, error, and
  reentrancy behavior without weakening the ref/commit contract; and
- measured commit reduction justifies the added public surface and compatibility
  burden.

Any proposal must be a new reviewed task. It cannot be smuggled into the ref,
key, canvas, or Mesh Pong slices.

## Rejected alternatives

| Alternative | Decision |
| --- | --- |
| Framework-prefixed commit directive | Rejected. The renderer can reserve generic `commit`, prevent DOM forwarding, and avoid extra ceremony. |
| New exported ref/cleanup/commit type family | Rejected for this slice. Contextual JSX typing expresses the element-specific callback contract without widening the root API. |
| Per-core scheduling configuration | Rejected. It expands source configuration and freezes cross-cutting ordering semantics before dogfood establishes a framework need. |
| Renderer scheduler in the lifecycle task | Rejected. Consumer-owned queues are sufficient to dogfood the primitive; scheduling remains an evidence verdict. |
| Drawing in effects | Rejected. Presentation must occur on initial mount and belongs to DOM commit, while effects remain consequences. [effects.ts:63-123](../packages/ignite-element/src/runtime/effects.ts#L63-L123) |
| Pass `null` to refs on teardown | Rejected. A returned cleanup is local, typed contextually, and unambiguous. |
| Await async cleanup before DOM progress | Rejected. Invoke in order, observe rejection, and continue so teardown cannot stall indefinitely. |
| Retained-node projection target | Rejected. Artifact targets deliver document/speech channels; DOM identity is renderer-local. |
| Canvas/WebGL/editor-specific core API | Rejected. The lifecycle must work for any element-backed imperative resource. |
| Generic multi-source state owner | Rejected. Ignite consumes existing source contracts and never becomes transition, topology, simulation, or advisory authority. |

## Compatibility and changesets

- The two-stage `igniteCore` and `component("name", renderer)` shapes are unchanged.
- The one-argument non-DOM projection-target overload remains separate.
- Ordinary unkeyed children retain positional reconciliation.
- Existing consumers that do not use `ref`, `commit`, or keys retain current
  synchronous presentation and effect timing.
- Supported callback refs change from ignored metadata to active lifecycle hooks.
- `commit` becomes a reserved JSX directive. A beta consumer using that exact
  custom-element property must rename it because it will no longer be forwarded.
- Fully keyed lists begin preserving identity as JSX authors expect.

| Slice | Package changeset |
| --- | --- |
| This architecture task | None; documentation-only. |
| Ref/commit lifecycle | Minor for `@ignite-element/renderer` and `ignite-element`, covering JSX declarations, reserved-directive behavior, lifecycle, and re-exports. |
| Keyed reconciliation | Minor for `@ignite-element/renderer`; include `ignite-element` if re-exported declarations or user guidance change. |
| Canvas example and Mesh Pong validation | None unless dogfood discovers and separately approves an API correction. |
| Scheduling verdict | None for a no-API verdict; any API proposal requires a new implementation task and its own changeset. |
| Final documentation | None unless final shipped syntax differs through an approved implementation correction. |

## Reconciled downstream graph

The live execution graph remains sequential:

| Order | Task | Uses this decision | Required proof |
| --- | --- | --- | --- |
| 1 | `task-1783719632720` — architecture | Accept this document. | Source citations, Markdown checks, plan alignment, architecture review. |
| 2 | `task-1783719649309` — ref/commit lifecycle | Implement contextual JSX directives and move-safe cleanup through existing rendering/lifecycle seams. | TDD for mount, repeated commit, ref change, replacement, same-tick move, true disconnect, reconnect, async cleanup, errors, and directive non-forwarding. |
| 3 | `task-1783719665018` — keys | Carry keys through normalization and implement the keyed table without changing the unkeyed path. | TDD for insert/remove/reorder, focus, selection, handlers, retained identity, invalid-key fallback, and diagnostics. |
| 4 | `task-1783719697500` — canvas dogfood | Exercise only the shipped ref/commit/key contract with a consumer-owned draw queue. | DPR/resize/input/visibility cleanup, semantic DOM, telemetry, fake clocks, browser/accessibility checks, and example lanes. |
| 5 | `task-1783719721452` — Mesh Pong validation | Inspect a pinned Actor-Web revision read-only and map its existing sources/read models to Ignite. | Stable context identity, authoritative fixed-step snapshots, real transport status, ownership classification, and separately queued Actor-Web follow-ups. |
| 6 | `task-1783719681572` — scheduling verdict | Compare both dogfood consumers against the evidence gate. | A documented no-API decision or a separately reviewed registration-level implementation brief; never a per-core option by assumption. |
| 7 | `task-1783719740973` — stable docs | Publish only final shipped syntax and the scheduling verdict. | Docs build, example typecheck, accessibility, export verification, and pinned validation links. |

The dependency edges are architecture → lifecycle → keys → canvas → Mesh Pong →
scheduling verdict → documentation. Epic/read-model grouping is additive and does
not replace `dependsOn`/`blocks`.

Mesh Pong is downstream evidence, not a framework mode or implementation
dependency. Validation must not add an Ignite-specific topology wrapper,
hard-code transport facts, repair lifecycle in application DOM code, or move
simulation/controller/advisory authority into Ignite.

## Acceptance checklist

- [x] The design uses the existing `igniteCore` return value and
  `component("name", renderer)` registration shape.
- [x] Generic `ref` and `commit` directives are exact, element-specific,
  lifecycle-safe, and never forwarded to DOM.
- [x] Lifecycle coverage includes mount, repeated commit, ref change, replacement,
  keyed moves, same-tick moves, true disconnect, reconnect, callback errors,
  async cleanup, source/strategy replacement, and SSR/headless execution.
- [x] Consumer-owned animation-frame/microtask scheduling is demonstrated without
  changing core configuration, source delivery, commands, events, or effects.
- [x] Framework scheduling is deferred to an evidence-gated post-dogfood verdict
  that may close with no API and can consider only a future registration-level
  policy.
- [x] Actor-Web retains transport, topology, actor, simulation, and advisory
  authority.
- [x] Compatibility, package changesets, deterministic verification, read-only
  Mesh Pong validation, and the reconciled seven-task dependency graph are
  recorded.
- [x] This slice changes documentation only, so no production TDD artifact or
  package changeset is required; every downstream production change remains
  test-first.
