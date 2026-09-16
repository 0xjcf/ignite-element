# Native events and effects — published in beta.14

The Operator retained optional `events` and `effects`, superseding the earlier
consultation's blanket-removal recommendation. Historical consultation receipts
remain historical and are not rewritten. This contract is published in beta.14;
the public tarballs match the independently accepted stages.

The canonical progression is source, inline states, inline commands, renderer
`ctx`, then optional outward notifications. See the canonical
[event guide](./site/src/content/docs/guides/events.mdx) for complete examples,
ownership, timing, diagnostics, and the migration boundary.

Each public event has one production rule: native source occurrence or
effect-derived state notification. A native declaration remains valid for
discovery and component handlers; its effect emission is rejected when outward
types are precise. Public declarations must accept native payload fields.
Missing/broad type information permits only best-effort runtime diagnosis.

Migration: replace an effect that mirrors an existing native event with the
native declaration alone. If a separate state comparison matters, keep the
effect under its own meaningful event name. Do not add producer flags, event
buses, lifecycle hooks, or manual native-to-DOM forwarding.

The subsequent Operator amendment replaces per-projection effect evaluation
with one evaluator per core/source instance in beta.14. After
first activation a shared evaluator retains its comparison baseline through
zero-view gaps until terminal disposal; isolated instances own separate
evaluators. Consumers receive notifications rather than running the effect.
Queued source notifications are not a framework commit barrier. Effect errors
use the core's console fallback, not an arbitrary element error hook.

Move view-specific callbacks and baselines to actual framework lifecycle
facilities. No public authoring API changes or compatibility flag are added.
The earlier per-projection acceptance and beta.13 receipts remain historical.
