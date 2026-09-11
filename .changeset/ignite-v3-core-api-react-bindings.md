---
"ignite-element": major
"@ignite-element/core": major
"@ignite-element/adapters": minor
---

Replace source-backed runtime getters with keyed discovery/state reads and derived-state
watching. Add terminal disposal for unregistered owning cores, preserving caller-owned
sources and the registered-core barrier. Remove command helpers and inferred metadata;
ordinary commands retain typing, receiver, arity, return and promise identity. Tools
use explicit application input definitions and availability predicates.

Add the neutral prepared-core React/React Native hook at `ignite-element/react`.
Move the existing custom-element wrapper to `ignite-element/react/web` and DOM-host
Actor-Web factory construction to `ignite-element/actor-web/web`. Preserve source-native
observations, per-element provisioning, and optional-peer isolation.

This changeset is unconsumed and does not establish publication. Authentic neutral
Actor-Web source consumption additionally depends on the separately reviewed upstream
source-only entrypoint; the already-published runtime package does not contain that fix.
