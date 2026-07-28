# Shared Architecture Model

This document explains ADR-003 and shows how to read the shared-architecture
contract against the evidence available in this repository.

## Status

Draft

## Reading Guide

ADR-003 is the normative contract. This companion document does three narrower
jobs:

- show the grounded current-state mapping supported by this repository
- separate current facts from inferred or target-state alignment work
- keep explanatory topology sketches from being mistaken for compliance truth

The normative source-native provisioning, host boundary, and feature-disposal
contract for this repository lives in
[`docs/source-native-provisioning.md`](./source-native-provisioning.md). The
normative Ignite-side Actor-Web evidence-consumption contract lives in
[`docs/actor-web-evidence-governed-projections.md`](./actor-web-evidence-governed-projections.md).

### Legend

- `Current fact`: supported by files, package structure, or workflow surfaces in
  this repository
- `Target state`: desired alignment or follow-up work that still needs explicit
  confirmation in the relevant repository
- `Explanatory only`: useful model or sketch, but not proof by itself

## ADR-003 Layer Summary

ADR-003 defines six adjacent layers:

1. Intent
2. Deterministic decision
3. Workflow and lifecycle
4. Imperative execution over time
5. Projection
6. Product composition

The key reading rule is that repos and package families may span adjacent
layers. The model is about ownership boundaries, not a forced one-repo-per-layer
layout.

## Grounded Current State In This Repository

### Ignite package-family mapping

This repository directly grounds the following package families:

- `ignite-core`
- `ignite-adapters`
- `ignite-renderer`
- `ignite-element`

| Package family | Current fact | Adjacent layers touched here | Does not own |
| --- | --- | --- | --- |
| `ignite-core` | contract primitives plus adapter-neutral helpers for state, commands, events, effects, and render args | intent, deterministic decision | adapter-specific integration, renderer strategy, projection assembly, product composition |
| `ignite-adapters` | translation between Ignite contracts and external runtime sources, normalized into stable runtime facts | deterministic decision, workflow and lifecycle, imperative execution over time | canonical business policy, renderer ownership, projection assembly, product composition |
| `ignite-renderer` | renderer registration and renderer-specific runtime utilities | projection | workflow policy, orchestration topology, product grammar |
| `ignite-element` | projection, assembly, runtime host coordination, and public Web Component/headless runtime surface | imperative execution over time, projection, product composition | ecosystem orchestration topology, provider/model ownership, repo-external composition authority |

The accepted target for application-owned `createFeature({ ports, setup })`
composition does not move this ownership into Ignite. It standardizes how
consumers arrive at the already-bound source before they call `igniteCore(...)`.

### Why the Ignite mapping is grounded

The package family split is explicit in this repository:

- `packages/ignite-core`
- `packages/ignite-adapters`
- `packages/ignite-renderer`
- `packages/ignite-element`

The package metadata also supports the ownership split:

- `@ignite-element/core` describes adapter-neutral primitives
- `@ignite-element/adapters` describes advanced state-library adapter
  integrations
- `@ignite-element/renderer` describes advanced renderer and runtime utilities
- `ignite-element` describes the default public package for building
  state-driven Web Components with Ignite

### Explanatory topology sketch

The sketch below is explanatory only. It shows one way to read the current
package boundaries without claiming that dependency direction alone proves the
architecture.

```text
consumer intent
  -> ignite-core contracts
  -> ignite-adapters normalize runtime facts
  -> ignite-element projects and assembles
  -> ignite-renderer executes a renderer strategy
```

The sketch is useful because it highlights contract flow and assembly flow. It
is not compliance truth on its own.

## Current Fact Vs Target State For Adjacent Repositories

### `ignite-element`

Current fact:

- this repository owns the grounded package-family mapping in ADR-003
- `ignite-element` is the public projection and assembly surface in this
  workspace
- `ignite-element` exposes optional integration surfaces, including actor-web
  entrypoints, without claiming ownership of external orchestration
- current callback surfaces still expose physical `host` access as compatibility
  behavior

Target state:

- keep ADR-003 and the local package map aligned as the repo evolves
- make any future cross-repo adoption language explicit, bounded, and evidenced
- keep the accepted source-native provisioning contract and current compatibility
  host access clearly separated, per
  [`docs/source-native-provisioning.md`](./source-native-provisioning.md)

### `actor-web`

Current fact from this repository:

- Ignite supports an optional actor-web adapter and subpath entrypoint
- that support proves compatibility, not that this repo can declare actor-web's
  present-fact ownership model
- current evidence only proves a loose source-compatibility floor plus a
  neutral `schemaVersion: 1` runtime event envelope, not an authoritative
  receipt, admission, checkpoint, or reconciliation fixture

Target state:

- actor-web can adopt explicit ADR-003 language for orchestration/runtime
  participation in its own repository
- once confirmed there, this companion can link to that adoption instead of
  speaking from inference
- Ignite's consumer requirements for those future fixtures stay documented in
  [`docs/actor-web-evidence-governed-projections.md`](./actor-web-evidence-governed-projections.md)

### `FAS`

Current fact from this repository:

- this repo is operated with FAS workflow artifacts such as task packets,
  planning state, commit plans, and verification scripts
- that grounds FAS as a workflow participant around this repository, not as a
  present-fact owner of Ignite runtime behavior
- FAS evidence bindings remain separate from Actor-Web receipts and Ignite Story
  traces, even when they correlate through shared identifiers

Target state:

- FAS can confirm its own workflow-policy, lifecycle, projection, and runtime
  boundaries in its own repo-local ADRs
- this document can then cite those boundaries instead of inferring them here

### `fas-local`

Current fact from this repository:

- no permanent fas-local ownership claim is grounded here
- when the broader stack is discussed from this repository, fas-local should be
  described only as a possible local runtime host or execution target

Target state:

- fas-local can define its own execution-host boundaries in its own repository
- until that happens, it should not be described here as the permanent kernel
  owner of the ecosystem

## Grounded Current-State Reading Of The Layers

### Intent

Current fact:

- Ignite exposes explicit commands and declared events rather than hiding
  requests in renderer mutations

### Deterministic decision

Current fact:

- `ignite-core` owns the core contracts and adapter-neutral helpers used to
  describe state, commands, events, effects, and render args

### Workflow and lifecycle

Current fact:

- adapters and runtime-facing package surfaces expose lifecycle distinctions
  such as shared versus isolated scope
- FAS workflow files in this repository encode explicit task phases and
  verification stages for repo operation
- application-owned feature disposal is an accepted target documented separately
  in [`docs/source-native-provisioning.md`](./source-native-provisioning.md)

### Imperative execution over time

Current fact:

- adapter integrations and the `ignite-element` runtime host deal with
  subscriptions, setup, cleanup, and headless runtime execution
- when Actor-Web is composed, execution-time reauthorization and durable truth
  stay in Actor-Web rather than moving into Ignite

Target state:

- source-native binding remains outside Ignite and is standardized around the
  accepted `createFeature({ ports, setup })` boundary

### Projection

Current fact:

- `ignite-element` turns source snapshots, commands, effects, and schema
  metadata into a stable projected surface
- `ignite-renderer` consumes that projected surface to execute a renderer
  strategy
- Actor-Web receipts, Ignite Story traces, and FAS evidence bindings remain
  separate provenance-bearing artifacts that must be joined explicitly

Target state:

- effects are documented as outward post-render facts rather than a generic
  imperative escape hatch
- retained Canvas/Cytoscape lifecycle stays in presentation-owned ref or commit
  code rather than projection or effect ownership

### Product composition

Current fact:

- `ignite-element` assembles the lower-level package families into the public
  Web Component surface for this repository

## Cross-Repo Topology Notes

Any broader ecosystem topology shown from this repository must stay labeled as
current fact or target state per participant.

Explanatory only sketch:

```text
Current fact here:
  FAS workflow surfaces -> this repo's planning/verification usage
  actor-web adapter -> optional integration surface
  ignite-element -> grounded projection/assembly package family

Target state elsewhere:
  actor-web -> explicit runtime/orchestration ownership in its own repo
  FAS -> explicit workflow-policy ownership in its own repo
  fas-local -> explicit local execution-host ownership in its own repo
```

That sketch is intentionally about evidence posture, not dependency direction.

## Target-State Alignment Notes

If the broader stack adopts ADR-003 consistently, the alignment should look like
this:

- each repository states its primary ownership and explicit `does not own`
  boundaries
- no repository claims orchestration, projection, or composition ownership by
  implication alone
- no dependency chain is treated as architecture truth without direct evidence
- topology diagrams remain explanatory, not compliance truth by themselves
- optional integrations remain additive rather than mandatory runtime
  dependencies
- source-native provisioning remains consumer or source-library composition, not
  `igniteCore(...)` configuration
- no projected capability, `canExecute`, or accepted `send` path is described
  as authoritative execution success

## Open Questions And Follow-Ups

- Should this repository later link directly to FAS, actor-web, or fas-local
  adoption ADRs once those repos confirm their boundaries?
- Do we want a bounded cross-repo appendix later, once those adoption records
  exist, instead of carrying target-state notes in each repo?
- Are there any remaining local docs that still imply dependency truth where the
  contract only supports explanatory topology?
- Once `createFeature({ ports, setup })` ships, should this companion add a
  short current-fact receipt section that points back to
  [`docs/source-native-provisioning.md`](./source-native-provisioning.md)?
