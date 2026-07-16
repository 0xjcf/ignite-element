# Integration Contracts

## XState projection and lifecycle contract

- Recorded: 2026-07-10
- Task: `task-1783650880370`
- Accepted implementation: `266605fa395af14bb9d8309433d38d7aa93b0943`

Ignite's XState adapter preserves the source snapshot as descriptor data before
deriving the extended snapshot. Enumerable snapshot descriptors are retained,
enumerable context descriptors take precedence, and the final `context` data
property keeps the original context identity. Accessors are not invoked while
constructing the extended snapshot.

Snapshot subscription setup is transactional. A failed initial read,
descriptor conversion, listener delivery, or source subscription rolls back the
new registration without disturbing existing listeners. Synchronous source
callbacks are buffered during installation so each successful registration
receives one initial snapshot.

Listener notification uses a snapshot of registrations plus live membership
checks. Additions are excluded from the in-progress update, removals before
their turn are skipped, and a nested source update takes a fresh listener
snapshot.

`stop()` marks the adapter stopped and releases listener closures before any
fallible source cleanup. It then attempts source unsubscribe, final snapshot
capture, and Ignite-owned actor stop exactly once in that order. Shared actors
remain consumer-owned. The first cleanup failure is propagated unchanged via
the core `failInvariant` helper; later failures are logged with their cleanup
stage. Repeated stop calls and stale subscription handles cannot retry source
cleanup.

Projection target binding installs its watcher before scheduling initial work.
Failed setup balances shared runtime access and leaves no effective queued
commit. Successful setup produces one initial evaluation regardless of zero,
one, or multiple synchronous subscription callbacks. Disposal becomes inert
before unsubscribe and cancels queued work even if unsubscribe throws.

## Voice workbench external capability federation

- Recorded: 2026-07-14
- Task: `task-1784038488251`
- Accepted implementation: `f48f292c38bf024e2713ab4ce33dc57c66ca5ccf`

The voice and text workbench dogfoods provider-neutral capability federation
inside the example host. Component commands remain owned by
`igniteTools(component)`. Configured external capabilities contribute a
separate availability-scoped manifest, and a collision-safe owner index routes
each tool call only to the runtime that declared it. This contract does not add
an `igniteCore` option or public federation API.

The concrete live adapter is Brave Web Search behind Vite's server boundary.
`BRAVE_SEARCH_API_KEY` is read only by the server plugin and sent upstream in
the `X-Subscription-Token` header. Browser code receives only a boolean
availability flag and calls the same-origin capability route. When the key is
absent, `searchWeb` is omitted and MLX is explicitly grounded that internet
access is unavailable.

Search is bounded to one batch of 1-8 queries, at most five results per query,
24 accepted sources total, and a 16 KiB request body. Query, source, URL,
description, provider, and retained receipt fields are length-limited before
entering model context or presentation state. Batched upstream requests share
an abort controller; timeout or the first provider failure aborts remaining
siblings and returns structured facts instead of throwing.

Success, unavailable, validation, timeout, provider failure, upstream status,
and duplicate-tool collisions remain bounded facts. Sanitized receipts persist
only in the workbench presentation turn and are rendered in the authorized-turn
proof panel; they never mutate `ConversationSession` artifacts. Brave result
quality and exact retailer-price precision remain provider limitations. Public
API promotion requires separate dogfood evidence and planning.

## Voice workbench native product-pricing integration

- Recorded: 2026-07-15
- Task: `direct-1784141422843`
- Accepted semantic implementation: `041e20099773473c36bb40327b5581fcb3c35ab3`

Product pricing is an example-private domain integration, not a generic Ignite
runtime capability. The domain policy admits a retailer, location, and ordered
subject list. The server then performs bounded, store-scoped Whole Foods native
discovery and applies the versioned `whole-foods-candidate-v1` deterministic
ranking policy. Generic `searchWeb` remains unavailable for applicable pricing
turns; zero-retry Brave discovery is eligible only after a decoded HTTP-200
native miss.

The provider caches selected product identities only, with a 300-second TTL,
64-entry LRU, and in-flight coalescing. Prices are never cached: every request
uses one fresh, deduplicated, store-scoped offer batch. Native and offer payloads
are size-bounded and decoded fail-closed. Fetch and body consumption share one
deadline, and every owned in-flight entry is settled and removed on failure.

The browser persists only bounded presentation proof: at most eight subject rows
with allowlisted cache, native, Brave, selection, and sourced-or-unverified price
status. Display conditions and labels are derived in the Ignite view callback;
the generic renderer remains unchanged. Promotion beyond this local example
requires a provider disable or circuit breaker plus latency and error telemetry.

The domain registry also exposes an optional, example-private artifact
materialization hook. For an applicable product-pricing turn, the pack derives a
canonical checklist, selection disclosure, and price table only from the latest
admitted policy decision followed by exactly one successful, ordered
`priceProducts` fact. Missing, duplicated, reordered, or mismatched evidence fails
closed and leaves the model proposal unchanged. Generic domains therefore retain
model-owned semantic selection, while product pricing demonstrates where a domain
can deterministically enforce artifact UX without moving policy into Ignite or its
renderer.

## Voice workbench result-quality and provider-eligibility boundary

- Recorded: 2026-07-15
- Task: `direct-1784167123747`

Runtime readiness, capability execution, artifact commitment, and shopper result
quality are independent facts. The product-pricing boundary now returns stable,
bounded reason codes for ambiguous candidates, low-confidence candidates,
missing products, unavailable offers, invalid provider responses, and provider
unavailability. `igniteCore.view` combines those facts with the admitted request
to derive requested, matched, and verified counts, per-item issue rows, and next
actions. JSX maps the prepared read model and does not infer business status,
parse source URLs, or reinterpret null table cells.

The recursive architecture is behaviorally present but structurally
transitional. Pure policy, authorization, materialization, projection, and
result-quality decisions form the functional core. Same-origin fetch, Whole
Foods requests, Brave discovery, retries, and caching form the imperative shell.
`price-capability.ts` and `server/product-pricing/whole-foods.ts` still combine
multiple layers; a follow-up architecture slice should separate `core`, `ports`,
`capabilities`, and `adapters` without adding a generic Ignite policy API.

DoorDash `dd-cli` v0.2.0 was evaluated and intentionally not integrated. Its
waitlist access terms limit current use to personal transactions, restrict
retention and analysis of accessed pricing data, and include transaction effects.
That is incompatible with this persistent open-source example without written
authorization and an explicit human checkout policy. DoorDash's public retail
inventory/pricing surface is a merchant feed, not a consumer product-query API.
No DoorDash binary, credential, catalog fact, checkout command, or provider code
belongs in this task.
