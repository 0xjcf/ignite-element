# Native events and effects — unreleased contract

The Operator retained optional `events` and `effects`, superseding the earlier
consultation's blanket-removal recommendation. Historical consultation receipts
remain historical and are not rewritten. This is a candidate after beta.13,
not a claim about published artifacts.

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
