# Retained complex interfaces

## Status and decision

Accepted on 2026-07-11 for the Ignite Element v3 beta design window. This is a
pre-stable architecture contract and the normative input to the retained-interface
implementation epic.

Ignite will add three generic, additive presentation capabilities:

1. callback refs that acquire an actual DOM element once and return its cleanup;
2. an `igniteCommit` JSX directive that commits each presented snapshot to that
   element; and
3. per-`igniteCore` commit scheduling with synchronous, microtask, and animation
   frame policies.

The renderer will also honor JSX keys so node identity, focus, selection, and
imperative resources survive keyed insertions and moves. Scheduling coordinates
both the presentation commit and post-commit effect release. It does not
coalesce source notifications, commands, events, telemetry facts, or actor
transitions.

This task changes documentation only. It adds no public API or package
changeset. The downstream tasks implement and verify the accepted contract
before the v3 stable merge.

## Current v3 beta gaps

The current source already provides useful seams, but it does not yet implement
the contract in this document.

| Surface | Current beta evidence | Gap closed by this design |
| --- | --- | --- |
| JSX keys | `IgniteJsxElement` and the JSX runtime carry `key`, but `NormalizedNode` has no key field and normalization omits it. [types.ts:15-19](../packages/ignite-renderer/src/renderers/jsx/types.ts#L15-L19), [jsx-runtime.ts:11-24](../packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts#L11-L24), [renderer.ts:23-32](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L23-L32), [renderer.ts:148-155](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L148-L155) | Retain private key metadata and reconcile fully keyed sibling lists by identity. |
| Child reconciliation | Children are patched by array position; incompatible or reordered nodes can be replaced. [renderer.ts:159-216](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L159-L216), [renderer.ts:234-328](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L234-L328) | Preserve compatible keyed nodes across insertion, removal, and reorder while leaving the unkeyed positional path intact. |
| Node refs | Both old- and new-prop loops explicitly skip `ref`, including the initial element creation path through `patchProps`. [renderer.ts:330-348](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L330-L348), [renderer.ts:406-465](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L406-L465) | Treat a typed callback ref as renderer-owned acquisition metadata instead of a DOM property. |
| Presentation cadence | Every active adapter notification updates current state and calls `renderTemplate()` synchronously; `renderTemplate()` immediately renders and records `rendered`. [IgniteElement.ts:173-186](../packages/ignite-element/src/IgniteElement.ts#L173-L186), [IgniteElement.ts:221-231](../packages/ignite-element/src/IgniteElement.ts#L221-L231) | Preserve this default and allow opt-in latest-snapshot presentation coalescing. |
| Effect ordering | Effects use a separate adapter subscription. They capture every adjacent snapshot pair and queue a microtask on the assumption that the same notification rendered synchronously. [effects.ts:78-123](../packages/ignite-element/src/runtime/effects.ts#L78-L123) | Coordinate presentation completion with effect eligibility so scheduled modes cannot release effects before their coalesced DOM commit. |
| Move-safe host lifecycle | Disconnect teardown is already deferred by one microtask and canceled when the element reconnects, distinguishing a same-tick move from a true disconnect. [IgniteElement.ts:21-58](../packages/ignite-element/src/IgniteElement.ts#L21-L58), [IgniteElement.ts:105-160](../packages/ignite-element/src/IgniteElement.ts#L105-L160) | Put retained-resource cleanup and scheduled-work cancellation behind the same true-disconnect decision. |
| Render strategy lifecycle | The strategy contract already has private `attach`, `render`, and optional `detach` methods, and Ignite JSX owns a concrete attach/detach implementation. [RenderStrategy.ts:1-5](../packages/ignite-renderer/src/renderers/RenderStrategy.ts#L1-L5), [IgniteJsxRenderStrategy.ts:40-53](../packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts#L40-L53), [IgniteJsxRenderStrategy.ts:72-113](../packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts#L72-L113) | Reuse that private boundary; do not add a second public renderer lifecycle. |
| Projection targets | First-party targets are opaque document or speech committers backed by private configuration, and document commits use projection identity and delivery facts. [projectionTargets.ts:14-52](../packages/ignite-element/src/runtime/projectionTargets.ts#L14-L52), [projectionTargets.ts:79-133](../packages/ignite-element/src/runtime/projectionTargets.ts#L79-L133), [projectionBinding.ts:159-260](../packages/ignite-element/src/internal/projectionBinding.ts#L159-L260) | Keep artifact delivery separate from DOM node/resource ownership. Retained nodes are not a new projection-target kind. |
| Headless loading | The package polyfill supplies only minimal `HTMLElement` and `customElements` fallbacks; it does not fabricate `document` or animation-frame globals. [setupDomPolyfill.ts:1-35](../packages/ignite-element/src/internal/setupDomPolyfill.ts#L1-L35) | Resolve presentation clocks and DOM operations only after a real DOM strategy attaches. |

## Ownership boundaries

| Concern | Owner | Contract |
| --- | --- | --- |
| Authoritative snapshot and transition history | Source runtime | Every source notification remains real and ordered. Presentation coalescing cannot rewrite history. |
| Actor lifecycle, topology, transport startup/status, multi-actor coordination | Actor-Web or the source adapter | Ignite consumes snapshots/read models and command access. The current Actor-Web adapter explicitly keeps Actor-Web as runtime owner. [actor-web.ts:106-108](../packages/ignite-element/src/igniteCore/actor-web.ts#L106-L108) |
| Fixed-step simulation, game loop, physics, match truth | Consumer domain/runtime | Never moved into Ignite, callback refs, effects, or the presentation scheduler. |
| View derivation and DOM presentation boundary | Ignite | Derive a view from the latest selected snapshot, reconcile DOM, run retained callbacks, and record the presented lifecycle. |
| DOM identity, key matching, callback bookkeeping | Ignite JSX renderer | Private renderer state decides reuse, move, replacement, acquisition, and cleanup. |
| Canvas context, editor/map/video instance, observer, and listener implementation | Consumer presentation code | Acquired by `ref`, updated by `igniteCommit`, released by the returned cleanup. It is not source truth. |
| Presentation-only interpolation | Consumer presentation code | May run in a retained resource loop, but must interpolate from authoritative snapshots and must stop in ref cleanup. |
| Commands and source-emitted events | Existing Ignite/source contracts | Delivered without scheduler coalescing. A renderer policy cannot suppress or merge them. |
| Effects | Existing Ignite effect runtime plus the private presentation coordinator | Effects remain consequence-oriented and keep exact adjacent snapshot pairs within the current attached generation. They run only after the applicable presentation commit; unreleased pairs never cross a generation boundary. |
| Advisory or agent policy | Owning behavior/runtime layer | Never becomes renderer or scheduler authority. |
| Accessibility | Semantic DOM authored by the consumer and reconciled by Ignite | A canvas or other retained surface must have native controls, labels, status, and alternatives where required; retained pixels are not the semantic contract. |

## Chosen public contract

The exact public types are:

```ts
export type IgniteNodeCleanup = () => void | PromiseLike<void>;

export type IgniteNodeRef<T extends Element = Element> = (
  node: T,
) => void | IgniteNodeCleanup;

export type IgniteNodeCommit<T extends Element = Element> = (
  node: T,
) => void;

export type IgniteCommitScheduling =
  | "sync"
  | "microtask"
  | "animation-frame";
```

`ref` and `igniteCommit` are reserved JSX directives. Neither is written as a
DOM property or attribute. `key` remains JSX identity metadata and is also never
written to the DOM.

`IgniteNodeCleanup`, `IgniteNodeRef`, and `IgniteNodeCommit` are exported from:

- `ignite-element/jsx` for ordinary application code; and
- `@ignite-element/renderer/jsx` for advanced renderer consumers.

The ordinary entrypoint already re-exports the renderer JSX surface, so both
paths can expose the same type identities rather than parallel wrappers.
[ignite-element JSX index:1](../packages/ignite-element/src/jsx/index.ts#L1),
[renderer JSX index:1-9](../packages/ignite-renderer/src/renderers/jsx/index.ts#L1-L9)

`IgniteCommitScheduling` is declared on and exported from the root
`ignite-element` public type surface. This is the canonical import:

```ts
import type { IgniteCommitScheduling } from "ignite-element";
```

The first-party adapter entrypoints `ignite-element/xstate`,
`ignite-element/redux`, `ignite-element/mobx`, and `ignite-element/actor-web`
re-export that same type identity as a convenience; they do not redeclare
adapter-specific scheduling unions. `@ignite-element/renderer` does not export
the scheduling type because the component/effect coordinator, not the renderer,
owns the policy.

Every first-party `igniteCore` adapter config accepts one additive option:

```ts
commitScheduling?: IgniteCommitScheduling;
```

The option belongs on the existing `igniteCore({ ... })` configuration object,
next to `view`, `commands`, `events`, `effects`, and `cleanup`. Those options are
currently collected by the common component factory. [createIgniteComponentFactory.ts:26-62](../packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts#L26-L62),
[createIgniteComponentFactory.ts:101-125](../packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts#L101-L125)

It does **not** add a callable overload, registration argument, global
`ignite.config` setting, or renderer registry option. A renderer-only setting
could not coordinate the separate effect subscription. A global setting would
also make unrelated cores share a latency policy.

### JSX usage

```tsx
import type { IgniteNodeRef } from "ignite-element/jsx";

const retainCanvas: IgniteNodeRef<HTMLCanvasElement> = (canvas) => {
  const context = canvas.getContext("2d");
  if (!context) return;

  const observer = new ResizeObserver(() => resizeCanvas(canvas));
  observer.observe(canvas);

  return () => {
    observer.disconnect();
    stopPresentationLoop(context);
  };
};

const pong = igniteCore({
  source: tableSource,
  commitScheduling: "animation-frame",
  view: ({ snapshot }) => ({ frame: snapshot.context.frame }),
});

const PongView = ({ frame }: { frame: Frame }) => (
  <section>
    <canvas
      key="playfield"
      ref={retainCanvas}
      igniteCommit={(canvas) => drawFrame(canvas, frame)}
    />
    <output aria-live="polite">{describeFrame(frame)}</output>
  </section>
);
```

The ref callback is intentionally defined with stable identity. Recreating it
inside every view call is a ref change and therefore requests cleanup and
reacquisition. `igniteCommit` may close over the presented view because it is
invoked for that presentation.

### Public semantics

- A ref receives an actual element and never receives `null`.
- A ref may return one cleanup function. Returning anything else registers no
  cleanup.
- Ref acquisition is tied to the pair `(DOM node, ref function identity)`.
- `igniteCommit` runs after successful DOM reconciliation and after the ref
  phase completes.
- `igniteCommit` runs once per **presented snapshot**, not once per source
  notification that was coalesced into that presentation.
- A stable node with a stable ref does not reacquire its retained resource on
  ordinary updates.
- All callback failures are contained and reported. They never roll back an
  already-committed DOM tree or skip unrelated callbacks.

## Private renderer and coordinator contract

The following remain private implementation details:

- normalized key/ref/commit metadata;
- the node-to-ref-cleanup registry;
- keyed child maps and move operations;
- callback traversal queues;
- presentation sequence and generation counters;
- pending microtask and animation-frame handles;
- exact effect-pair queues and presentation eligibility markers;
- clock injection and deterministic flush helpers; and
- strategy attach/detach coordination.

`RenderStrategy` may gain private cross-package coordination needed by
`IgniteElement`, but this task does not make renderer lifecycle or scheduler
objects public. The current strategy boundary is already sufficient as the
ownership seam. [RenderStrategy.ts:1-5](../packages/ignite-renderer/src/renderers/RenderStrategy.ts#L1-L5)

## Lifecycle conformance matrix

In the table, "cleanup" means invoke the previously registered cleanup after
consuming its registry entry. Invocation order is guaranteed; completion of an
async cleanup is not awaited.

| Scenario | DOM identity | Cleanup | Ref setup | `igniteCommit` | Scheduled work | Effects |
| --- | --- | --- | --- | --- | --- | --- |
| Initial mount | Create one node. | None. | Once, after node creation and prop reconciliation. | Once for the presented snapshot, after all ref setup in the commit. | Current generation remains active. | Initial adapter seeding remains a baseline, not a change effect. Later pairs wait for commit. |
| Stable update, stable ref | Preserve node. | None. | None. | Once for each presented snapshot. | A scheduled mode may supersede an older pending presentation. | Every captured pair in the current attached generation remains queued in notification order until its presentation commits. |
| Same node, changed ref identity | Preserve node. | Invoke old cleanup once. | Invoke new ref once after old cleanup invocation. | Once after the new ref phase. | Pending presentation uses only the newest metadata. | Release after the resulting presentation. |
| Node or tag replacement | Create replacement; old identity ends. | Invoke old subtree cleanups before removal, deepest child first. | Acquire the new subtree parent first, then descendants in DOM order. | Invoke for the new subtree in DOM order after setup. | Stale callbacks from the old generation are invalidated. | Pairs included in the replacement commit release afterward. |
| Key change | Treat as replacement even when tag matches. | Once for the old keyed identity. | Once for the new keyed identity. | Once for the new presented node. | Old keyed work is invalidated. | Release after replacement commit. |
| Compatible keyed reorder | Move and preserve the exact node. | None. | None. | Once for the presented snapshot after its move and prop patch. | Work follows identity, not the old index. | Release after the reordered DOM is committed. |
| Same-tick host DOM move | Preserve strategy tree and nodes because deferred disconnect is canceled. | None. | None. | Run only if reconnect schedules a presentation; never because of teardown/reacquisition. | Keep the generation; do not cancel for the transient disconnect. | Already eligible effects remain ordered; no effect is invented for the move. |
| True disconnect | End presentation identity for the attached tree. | Consume and invoke every active cleanup once, deepest child first, then detach the strategy. | None. | None after invalidation. | Increment generation; cancel rAF; stale microtasks become no-ops. | Discard every unreleased pair in the ending generation whose presentation never committed. No pair survives to reconnect or runs against detached DOM. |
| Reconnect after true disconnect | Attach strategy before rendering; create/recover the new strategy tree. | No second call for old cleanups. | Acquire refs for the new tree once. | Once after the reconnect presentation. | Start a new generation from the latest source snapshot. | Start with an empty effect-pair queue; only pairs captured in the new generation may wait for the reconnect commit. |
| Source replacement | Presentation state is rebound to the replacement source. | Retained DOM cleanup follows whether the existing strategy tree is reused or replaced. | Reacquire only when node/ref identity changes. | Invoke only for a snapshot presented from the replacement source. | Invalidate the old generation before subscribing to the replacement source. | Discard every unreleased old-source pair whose presentation never committed; never combine pairs across sources. |
| Strategy replacement or explicit detach | Old strategy identity ends; new strategy attaches before render. | Clean old retained subtree before old `detach`. | Acquire only after new `attach` and DOM creation. | Invoke only on the new strategy's committed tree. | Invalidate old generation and pending handles. | Discard every unreleased pair from the old strategy generation; only new-generation pairs may release after the new strategy commits. |

Cleanup-before-setup is an invocation guarantee, not an await guarantee. This
prevents a slow observer/editor shutdown from blocking DOM progress while still
giving consumers deterministic ownership transfer.

## Callback and error conformance

| Case | Required behavior |
| --- | --- |
| Ref setup returns cleanup | Store exactly one cleanup for the node/ref pair. Consume the stored entry before invoking it so reentrancy cannot double-call it. |
| Ref setup throws | Report the error; store no cleanup; continue remaining refs and commits. Do not roll back DOM. |
| Ref setup returns an accidental thenable | It is not a cleanup. Observe rejection through the common reporter so it cannot become unhandled; store no cleanup. |
| Cleanup returns `PromiseLike<void>` | Observe fulfillment/rejection, but do not await it before setup, removal, detach, or other cleanups. |
| Cleanup throws or rejects | Report once and continue setup, DOM removal, strategy detach, adapter teardown, and sibling cleanup. |
| `igniteCommit` throws | Report once; do not roll back DOM, tear down the ref, or suppress unrelated commits. |
| `igniteCommit` returns an accidental thenable | The return value has no commit meaning. Observe rejection through the common reporter and otherwise ignore it. |
| Host has an error handler | Use `host.handleError(error)` first, then `host.onError(error)`; otherwise use `console.error`. This matches the existing effect reporter precedence. [effects.ts:32-61](../packages/ignite-element/src/runtime/effects.ts#L32-L61) |
| Multiple callbacks fail | Report each failure and finish the deterministic traversal. Cleanup is deepest-child-first; setup and commit are parent-first DOM order. |

The runtime must assimilate thenables defensively with `Promise.resolve(value)`
inside error containment. It must not call a user-provided `.then` more than the
Promise assimilation requires, and it must not let a hostile thenable corrupt
callback bookkeeping.

## Keyed reconciliation contract

| Input shape | Matching rule | Result |
| --- | --- | --- |
| No sibling has a key | Existing positional reconciliation. | Source-compatible unkeyed behavior. |
| Every material sibling has one unique non-null key | Match by key plus compatible node kind, element tag, and namespace. | Patch and move the existing DOM node; preserve focus, selection, listeners, ref cleanup, canvas/WebGL context, and other retained state. |
| Key exists but kind/tag/namespace is incompatible | Identity is not compatible. | Invoke old cleanup and replace with a newly acquired node. |
| Key changes | Old key is removed and new key inserted. | Replacement semantics even when the tag is unchanged. |
| Keyed insertion | New key has no old match. | Create, setup, and commit only the inserted node; move/reuse other matches. |
| Keyed removal | Old key has no new match. | Cleanup and remove only the missing keyed node. |
| Duplicate keys | Invalid keyed list. | Emit a development diagnostic and deterministically replace the whole sibling list. Never guess a winner. |
| Mixed keyed and unkeyed siblings | Invalid keyed list. | Emit a development diagnostic and deterministically replace the whole sibling list. Never combine identity models. |
| Keyed component/fragment does not normalize to exactly one material node | Invalid keyed slot. | Emit a development diagnostic and replace the whole sibling list; range identity is outside this contract. |

Key metadata survives JSX normalization but never becomes a property or
attribute. The current JSX runtime already passes key separately from props,
which is the compatible authoring shape. [jsx-runtime.ts:11-24](../packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts#L11-L24)

Whole-list replacement for invalid keyed input is deliberately conservative. It
is deterministic, easy to diagnose, and cannot silently attach a retained
resource to the wrong business identity.

## Commit scheduling

Effect-pair preservation is generation-scoped, not lifetime-scoped. Within one
attached presentation generation, every pair through a successful commit is
preserved in notification order. True disconnect, source replacement, and
strategy replacement end that guarantee: any unreleased pair whose presentation
never committed is discarded before the next generation starts.

| Mode | Presentation behavior | Coalescing boundary | Effect behavior |
| --- | --- | --- | --- |
| `sync` | Default. Commit every active source notification synchronously, preserving current DOM timing. | None. | Each exact adjacent snapshot pair in the current generation becomes eligible after its synchronous commit and runs in the existing post-commit microtask phase. |
| `microtask` | Schedule one presentation microtask and commit the latest pending snapshot. | All current-generation notifications before that microtask begins. | Preserve every exact current-generation pair through the committed sequence; release them in order only after the coalesced commit. Discard an uncommitted batch if its generation ends first. |
| `animation-frame` | Schedule at most one presentation for the next animation frame and commit the latest pending snapshot. | All current-generation notifications before that frame callback claims its batch. | Preserve every exact current-generation pair through the committed sequence; release them in order only after the frame commit. Discard an uncommitted batch if its generation ends first. |

If `requestAnimationFrame` is unavailable in a real attached DOM environment,
`animation-frame` falls back to the private microtask clock and retains
latest-snapshot semantics. Headless use does not schedule presentation at all.

### Normative notification and commit order

For every mode, the private presentation coordinator follows this order:

1. Receive every adapter notification in source order and assign a monotonic
   sequence within the current presentation generation.
2. Update source-facing current snapshot state immediately. Command handling,
   source-emitted events, and telemetry facts remain outside the presentation
   coalescer and are never dropped or merged.
3. Capture the exact `(prevSnapshot, snapshot)` effect pair in the current
   generation's FIFO queue. The adapter's initial seeded notification remains
   only the baseline.
4. Replace the pending presentation candidate with the latest snapshot and
   schedule or run the mode's presentation flush.
5. At flush start, verify that the host is attached and the generation is
   current. Atomically claim the latest snapshot and all same-generation effect
   pairs through its sequence.
6. Derive the view and reconcile the DOM for that claimed snapshot.
7. Complete cleanup and ref setup generated by reconciliation, containing every
   callback failure.
8. Invoke `igniteCommit` for retained nodes, then record `rendered` exactly once
   for the actual presentation. The current implementation records `rendered`
   immediately after strategy render; the coordinator preserves that relative
   position after retained callbacks are added. [IgniteElement.ts:173-186](../packages/ignite-element/src/IgniteElement.ts#L173-L186)
9. Only after steps 6-8 succeed far enough to establish the presented DOM,
   enqueue the post-commit effect microtask and release all claimed exact pairs
   in notification order with existing effect error containment.
10. Notifications that arrive reentrantly after the claim belong to the next
    batch in the same generation. Schedule them under the same mode. True
    disconnect, source replacement, and strategy replacement end the generation:
    cancel rAF handles, make already queued microtasks and callbacks no-ops, and
    discard every unreleased pair whose presentation did not commit. Reconnect
    starts with an empty effect-pair queue; no pair crosses the boundary or runs
    against detached DOM.

Coalescing changes the DOM observation available to effects: every released
effect in the committed current-generation batch keeps its exact snapshot pair,
but several pairs may observe the one latest DOM tree produced for their batch.
The API does **not** promise snapshot-exact historical DOM for coalesced
notifications. Consumers that require a consequence for every source transition
must use the effect's snapshot arguments or source events, not scrape DOM
history.

A render/view/reconciliation failure is reported and does not release that
batch's effects against an uncommitted DOM. The latest still-current snapshot
may be retried by a later notification in the same generation; if disconnect or
replacement ends the generation first, its unreleased pairs are discarded.
Reconnect starts a new queue from its new baseline. The coordinator does not
roll source state back.

## Deterministic clocks and tests

Clock control is private and injectable at the presentation coordinator:

```ts
interface IgnitePresentationClock {
  queueMicrotask(callback: () => void): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
}
```

Production resolves these functions lazily from `globalThis` only after a DOM
strategy attaches. Tests inject a clock with separate deterministic operations:

- `flushPresentationMicrotasks()`;
- `flushAnimationFrame(timestamp)`;
- `flushEffectMicrotasks()`;
- inspection of requested/canceled frame handles; and
- inspection of notification, presentation, ref, commit, lifecycle, and effect
  sequence logs.

Every attach, true disconnect, source replacement, and strategy replacement
increments a generation. Non-cancelable microtasks compare their captured
generation before touching DOM or releasing effects. Animation-frame work is
both canceled when possible and generation-guarded. Test helpers must expose the
separate presentation and effect phases so tests cannot pass by indiscriminately
draining all jobs.

Required deterministic cases include burst coalescing, latest-snapshot
correctness, exact effect-pair order, reentrant notifications, disconnect before
flush, reconnect, strategy replacement, callback failures, async cleanup, rAF
cancellation, and the unchanged synchronous path.

## SSR and headless safety

- Importing common types or creating a headless `igniteCore` must not read
  `document`, `Element`, `requestAnimationFrame`, or `cancelAnimationFrame`.
- The `Element` generic is type-only. Ref and commit callbacks run only when a
  real renderer has produced a real DOM element.
- `getSchema()`, `getView()`, commands, events, and non-DOM projection targets do
  not create a presentation coordinator or schedule frames.
- Clock resolution is lazy and feature-detected through `globalThis` after
  strategy attachment.
- No DOM means no synthetic ref acquisition or `igniteCommit` call. Ignite does
  not fabricate retained resources for SSR.
- A stale callback captured before detach is generation-guarded and cannot touch
  a later DOM tree.
- This contract does not add hydration, DOM serialization, or a server canvas.

The current minimal DOM polyfill is therefore not expanded to pretend that a
document or animation frame exists. [setupDomPolyfill.ts:8-35](../packages/ignite-element/src/internal/setupDomPolyfill.ts#L8-L35)

## Rejected alternatives

| Alternative | Decision |
| --- | --- |
| Callback refs without `igniteCommit` | Rejected. A stable ref must not reacquire on every snapshot merely to draw or update an editor. Acquisition and per-presentation commit are distinct phases. |
| `igniteCommit` without cleanup-returning refs | Rejected. It provides updates but no deterministic ownership for observers, contexts, editor models, listeners, or loops. |
| Pass `null` to refs on teardown | Rejected. A returned cleanup is typed, local to the acquisition, and cannot be confused with setup. |
| Await async cleanup before DOM progress | Rejected. It can deadlock or stall reconciliation. Invoke in order, observe rejection, and continue. |
| Treat retained drawing as an Ignite effect | Rejected. Effects are consequences of source changes and currently run in a separate post-render subscription. Drawing is part of presentation commit, including initial presentation. [effects.ts:63-123](../packages/ignite-element/src/runtime/effects.ts#L63-L123) |
| Renderer-only scheduler wrapper | Rejected. It cannot gate the independently subscribed effects runtime and would break render-before-effect ordering. |
| Global or renderer config scheduling | Rejected. Latency belongs to one core's presentation contract, and global policy cannot coordinate ownership safely. |
| Public lifecycle/resource object protocol | Rejected for v3. Callback refs plus one commit directive satisfy acquisition, update, replacement, and cleanup with less API surface. Private bookkeeping may use objects internally. |
| Retained-node projection target | Rejected. Document/speech targets deliver revisioned channel artifacts; DOM node identity is renderer-local and must not widen projection inspection into a public state owner. |
| Canvas/WebGL/editor-specific core API | Rejected. The primitive must work for any element-backed imperative presentation resource. |
| Generic multi-source owner or `InteractionPlan` | Rejected. Ignite consumes one existing source contract; it does not become transition, topology, or advisory authority. |
| Game loop or physics scheduler in Ignite | Rejected. The public scheduler coalesces presentation commits only. Authoritative simulation remains in the source runtime. |
| Heuristic/partial keyed matching for duplicate or mixed lists | Rejected. Guessing can move retained state to the wrong identity. Diagnose and replace the entire invalid list deterministically. |

## Compatibility and changesets

This architecture is additive by default and intentionally lands before v3
stable:

- `sync` is the default, so components that do not opt in keep current render
  cadence and post-render effect timing.
- Unkeyed children keep positional reconciliation.
- Existing `igniteCore` call and component registration shapes gain no overload.
- `ref` changes from silently ignored metadata to the supported callback
  contract. Unsupported ref values remain ignored with a development diagnostic.
- `key` begins doing what JSX authors expect for fully keyed lists.
- `igniteCommit` becomes a reserved directive. Any beta consumer that used that
  exact name as a custom-element property must rename it; today it would pass
  through the generic property/attribute path because only `children` and `ref`
  are reserved. [renderer.ts:406-465](../packages/ignite-renderer/src/renderers/jsx/renderer.ts#L406-L465)

Changeset plan:

| Slice | Package changeset |
| --- | --- |
| This architecture task | None; documentation-only. |
| Typed refs and lifecycle | Minor for `@ignite-element/renderer` and `ignite-element`, covering new JSX types/directives and re-exports. |
| Keyed reconciliation | Minor for `@ignite-element/renderer`; include `ignite-element` if its re-exported declarations or user-facing behavior notes change. |
| Commit scheduling | Minor for `ignite-element`; no renderer changeset unless a public renderer declaration changes. |
| Stress example, Mesh Pong validation, final docs | No package changeset unless implementation discovers and explicitly approves an API correction. |

Each implementation slice must land its own tests and changeset. Do not combine
the lifecycle, key, and scheduler packages into one opaque pre-stable change.

## Downstream epic mapping

The live dependency graph remains sequential; the epic/read model does not
replace `dependsOn`/`blocks` execution edges.

| Task | Uses this decision | Required proof |
| --- | --- | --- |
| `task-1783719632720` — architecture | Accept this document. | Source citations, focused docs check, commit-plan alignment, architecture review. |
| `task-1783719649309` — typed refs and move-safe lifecycle | Implement exact ref/cleanup/commit semantics and reuse true-disconnect plus strategy attach/detach. | TDD for mount, stable update, ref change, replacement, same-tick move, true disconnect, reconnect, async cleanup, and errors. |
| `task-1783719665018` — keyed reconciliation | Carry key metadata through normalization and implement the keyed table without changing the unkeyed path. | TDD for insert/remove/reorder, focus, selection, event handlers, retained context identity, duplicate/mixed fallback, and diagnostics. |
| `task-1783719681572` — commit scheduling | Add `commitScheduling`, the presentation/effect coordinator, clocks, generations, and exact ordering above. | Fake-clock TDD for every mode, coalescing, effects, reentrancy, cancellation, disconnect/reconnect, and sync compatibility. |
| `task-1783719697500` — retained canvas stress example | Exercise only the generic shipped APIs with deterministic authoritative snapshots and separate presentation interpolation. | DPR/resize/input/visibility/resource cleanup, semantic DOM, telemetry, browser/accessibility checks, and `test:examples`/`test:full`. |
| `task-1783719721452` — Actor-Web Mesh Pong validation | Inspect a pinned Actor-Web revision read-only and map its existing source/read-model contract to Ignite. | Stable canvas identity, scheduled commits, real transport status, authoritative fixed-step snapshots, ownership classification, and separately queued Actor-Web follow-ups. No Actor-Web source edit in this task. |
| `task-1783719740973` — stable documentation | Replace architectural examples with the final shipped syntax and publish decision guidance. | Docs build, example typecheck, accessibility, export verification, and links to the pinned validation brief. |

Mesh Pong is downstream evidence, not a framework mode or implementation
dependency. Validation must not add an Ignite-specific topology wrapper,
hard-code transport facts, repair lifecycle in application DOM code, or move
simulation/controller/advisory authority into Ignite.

## Acceptance checklist

- [x] Exact public types, option placement, export placement, and private
  bookkeeping boundary are recorded.
- [x] Ownership explicitly excludes game loops, physics, Actor-Web transport
  startup, multi-actor lifecycle truth, and advisory policy from Ignite.
- [x] Lifecycle coverage includes initial mount, stable commits, ref change,
  replacement, key change/reorder, same-tick moves, true disconnect, reconnect,
  strategy replacement, callback errors, and async cleanup.
- [x] Key behavior covers unique fully keyed lists, unkeyed positional behavior,
  incompatibility, insertion/removal, duplicate keys, mixed keys, and metadata
  privacy.
- [x] Scheduling preserves every source notification and every exact effect pair
  through a successful commit within the current attached generation while
  coalescing only presentation work to the latest snapshot; true disconnect and
  source/strategy replacement discard unreleased uncommitted pairs before a new
  generation or reconnect begins.
- [x] Effect ordering states the coalesced-DOM limitation and preserves
  post-commit error containment.
- [x] Deterministic clocks, generation cancellation, reentrancy, SSR, and
  headless safety are specified.
- [x] Compatibility, per-package changesets, verification lanes, downstream
  dependency order, and read-only Mesh Pong validation are specified.
- [x] This slice is documentation-only, so it adds no production behavior and
  has no TDD or changeset artifact. Every downstream production slice requires a
  failing test first and coverage for every production change.
