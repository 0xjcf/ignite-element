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
and delegates to the existing XState adapter when subscription commits. That
adapter borrows this actor; the private binding separately owns actor shutdown.
This preserves ordinary adapter, element and explicit headless acquisition.
Redux and MobX use their existing lazy-observation adapters unchanged.

A private layout-phase subscription activates before consumer layout effects can
issue source commands. React's external-store subscription then observes the
same binding; neither lease acquires a second runtime. Committed bindings
register cleanup with the reusable core's terminal lifetime. Synchronous Strict Mode subscription replay reclaims the same live
runtime before an internal microtask release. No stopped actor is restarted.
Genuine unmount drains observation/effects and stops the owned XState actor;
Redux/MobX release their observation without inventing native shutdown methods.
An actual new mount gets fresh state. Commands remain bound to their original
runtime and reject while unmounted and after disposal. Core replacement never
retargets retained commands. Cleanup failures still attempt every release.

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
versions, limitations and exact candidate identity. Navigator review remains
pending; the construction-safety architecture decision is accepted.
