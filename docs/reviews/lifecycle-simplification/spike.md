# Lifecycle simplification spike

## Disposition

Slice A is implemented in this local candidate. Slice B's independent hook
runtimes remain unimplemented pending the specific construction-safety decision
below. This is not a release or acceptance receipt.

Authority: the Operator's 2026-09-18 lifecycle spike/implementation prompt,
using beta commit `af0de5696b60922aacbbcc895879adcc72851357`
(tree `59c9d85da7bda8bb5cceb1765f7aeb57727da3ad`) as the verified baseline.
The prompt explicitly permits completing the independently safe slice if a
material public-contract decision blocks private hooks.

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
their existing move-safe true-disconnect cleanup. Headless operations and hooks
keep their existing runtime selection. Actor-Web neutral factories still do not
grant native close authority; its host-owned factory remains distinct.

The original unsupported-configuration reproduction is retained in the external
review packet, with its historical failing result. It is not rerun as a passing
candidate test. Candidate tests use supported configuration and separately
verify the migration error.

## B. Decision needed before private hook implementation

A synchronous initial `ctx` requires construction of the private source during
render. An executable spike verifies:

- `createActor(machine)` provides an initial snapshot before `start()`, but
  already runs the machine's context initializer.
- Actor invocation and entry actions begin at `start()`, and invocation cleanup
  runs at `stop()`.
- Redux construction can run reducer initialization immediately.
- A MobX factory can install an `autorun` immediately. Deferring Ignite's own
  observation does not undo a user constructor's external effects.

Required caller-facing restriction: independent hook construction must be safe
to repeat and discard without cleanup. Factories, context initializers,
projections and command setup must not perform I/O, install external
subscriptions, or create resources requiring release during render. A factory
must return a fresh source, not a singleton. This restriction has been presented
to the Operator; it has not been silently treated as approved.

If approved, the proposed internal mechanism is a private binding per hook,
with construction/read separated from activation at committed subscription.
Committed runtimes would register with the reusable core's terminal lifetime;
abandoned inert allocations would not become owned active runtimes. A bounded
internal release deferral could distinguish synchronous Strict Mode subscription
replay from genuine detachment. Genuine remount would create a fresh binding,
while retained commands would remain bound to the old runtime and reject after
its release. Core argument replacement would release the old binding, not
retarget it. The explicit headless runtime would remain separate.

That mechanism is design only. Strict Mode replay, suspended/abandoned private
renders, private command identity, startup races, per-runtime effects, terminal
release of all private hooks, and React Native independent lifecycle are not
implemented or proven by this candidate. Existing shared-hook/native-host tests
do not establish those properties.

The alternative is to defer private hooks while preserving the synchronous
shared-source hook. Loading/null/Suspense, new caller wrappers, or a lifecycle
flag would change the approved target and are not introduced here.

Classification: `blocking_public_contract` for proceeding with slice B without
that decision. It does not block review of the independently safe slice A.
