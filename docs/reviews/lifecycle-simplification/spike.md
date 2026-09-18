# Lifecycle simplification spike

## Disposition

Slices A and B are implemented in this local candidate. The Operator explicitly
accepted construction safety on 2026-09-18 while preserving synchronous `ctx`
and the existing public API. This is not a release or acceptance receipt.

Authority: the Operator's 2026-09-18 lifecycle spike/implementation prompt,
using beta commit `af0de5696b60922aacbbcc895879adcc72851357`
(tree `59c9d85da7bda8bb5cceb1765f7aeb57727da3ad`) as the verified baseline.
The subsequent instruction authorizes continuing slice B with that requirement.

## A. Remove optional shared teardown

The old optional path stopped a cached adapter after the final element and
runtime lease left. The next acquisition received that same terminally stopped
wrapper. With no activated effects, XState, Redux, MobX and Actor-Web reproduced
frozen views. Active shared effects prevented that optional teardown, which
explained why superficially similar tests passed.

The candidate rejects any supplied `cleanup` key before source acquisition,
including `true`, `false`, `undefined`, inherited properties and accessors.
It removes the property from public types, the early teardown branch, view and
runtime counters, temporary runtime leases, and the effect-activity check used
only for early teardown. Redux's generic fallback also rejects the removed key.
There is no hidden replacement flag.

Shared element disconnect releases only that view's handles. Application-level
observation and activated effects survive zero-view intervals until terminal
core disposal. Native ownership is unchanged. Independent custom elements keep
their existing move-safe true-disconnect cleanup. Explicit headless operations retain their own runtime. Actor-Web neutral factories still do not
grant native close authority; its host-owned factory remains distinct.

The original unsupported-configuration reproduction is retained in the external
review packet, with its historical failing result. It is not rerun as a passing
candidate test. Candidate tests use supported configuration and separately
verify the migration error.

## B. Accepted construction safety and private hooks

A synchronous initial `ctx` requires construction of the private source during
render. An executable spike verifies:

- `createActor(machine)` provides an initial snapshot before `start()`, but
  already runs the machine's context initializer.
- Actor invocation and deferred entry actions begin at `start()`, and invocation cleanup
  runs at `stop()`.
- Redux construction can run reducer initialization immediately.
- A MobX factory can install an `autorun` immediately. Deferring Ignite's own
  observation does not undo a user constructor's external effects.

Accepted caller-facing restriction: independent hook construction must be safe
to repeat and discard without cleanup. Factories, context initializers, reducer
initialization, projections and command setup must not perform external work,
install external subscriptions, or acquire resources requiring release during
render. A factory must return a fresh source, not a singleton.

Redux Toolkit 2.12.0 `configureStore` invokes the middleware configuration
callback, builds the enhancer chain, and calls Redux 5.0.1 `createStore` during
construction. Redux runs its initialization dispatch; `applyMiddleware` calls
each middleware initializer with the store API. Enhancer construction therefore
also falls under the accepted restriction. These callbacks are not deferred by
Ignite. Instrumented tests establish that middleware/enhancer construction may
repeat in abandoned renders, with no Ignite subscription or command dispatch;
committed commands still use enhanced dispatch. Unsafe factory-created external
work is an application contract violation, not something Ignite can undo.

Each hook memoizes a private binding keyed by core identity. It allocates an
inactive source, projection, commands and immutable snapshot during render.
Those allocations have no root-owned retention or source subscription. A fresh
projection owner per binding keeps abandoned effect bookkeeping collectible.

XState's private path constructs an unstarted actor, reads its initial snapshot,
and delegates to the existing XState adapter on committed activation. That
adapter borrows this actor; the private binding separately owns actor shutdown.
This preserves ordinary adapter, element and explicit headless acquisition.
Redux and MobX use their existing lazy-observation adapters unchanged.

Component retention is recorded in `useInsertionEffect`, before descendant
layout effects and callback refs. This hook only records ownership and marks
attachment; it does not activate sources, read the DOM or schedule React updates.
Layout/external-store subscriptions activate observation, or a command called
from a descendant layout effect/ref activates it on first use after attachment.
Neither path acquires a second runtime.

Activity hiding disconnects layout/passive subscriptions but retains component
ownership, source state and command identity. Already-active source resources
(including XState invocations) continue while hidden; React recipients disconnect
and independent projection effects are suppressed. Initially hidden content is
constructed inertly until visible subscription or explicit committed command use.
This deliberately preserves opaque source state without snapshot cloning or
restarting a stopped actor. Strict Mode effect replay retains the same runtime.

Actual insertion cleanup on removal/core replacement marks commands unavailable
immediately and queues resource release outside the insertion phase. The
microtask defers teardown; absence of subscriptions is no longer evidence of
removal. Genuine unmount drains observation/effects and stops the owned XState
actor; Redux/MobX release observation without invented native shutdown methods.
A new mount starts fresh. Core disposal drains retained hidden bindings too and
remains terminal. Retained commands never target a replacement runtime. Cleanup
failures still attempt every release.

This is a deliberate library-level use of `useInsertionEffect` for retention
bookkeeping. React recommends it for CSS-in-JS libraries; its prohibition on
state updates is preserved here. The React 19.2.7 implementation and public
adapter regressions distinguish insertion cleanup on deletion from Activity's
layout/passive disconnection. The packed native host separately verifies commit
ordering and ordinary lifecycle on React 19.1.0; it does not establish native
Activity or physical-device support. See [React Activity](https://react.dev/reference/react/Activity)
and [useInsertionEffect](https://react.dev/reference/react/useInsertionEffect).

The binding caches snapshots between notifications. Subscribe-time replay closes
the render-to-subscribe race. Independent queued effects are suppressed after
unsubscription; effects keep their existing post-source-processing microtask
timing, with no React commit or exactly-once business-work guarantee. Native and
effect events observed through core `on`/`execute` belong to the separate
headless runtime, not an aggregate of mounted hooks.

Shared hooks keep their existing prepared store and subscription-only unmount.
Actor-Web does not opt into the new private-hook mechanism. The public hook
signature, source entrypoints and source-free root remain unchanged. The added
private binding registry and deferred release exist only to reconcile
synchronous snapshots, abandoned renders, replay and terminal ownership.

See `validation.md` and the external candidate receipt for executable evidence,
versions, limitations and exact candidate identity. Navigator identified LC-01/LC-02 in the first combined candidate;
this successor corrects them and awaits re-review; the construction-safety architecture decision is accepted.
