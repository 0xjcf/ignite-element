# Shared Architecture Model

This document explains ADR-003 and shows how to read the shared architecture contract against the evidence available in this workspace.

## Status

Draft

## Reading Guide

ADR-003 is the normative contract. This companion document does two narrower jobs:

- show the grounded current-state mapping that can be supported from this repository
- separate inferred or target-state alignment work from repository-local facts

### Legend

- `Grounded current state`: supported by files, package structure, or workflow surfaces in this workspace
- `Inferred cross-repo mapping`: plausible interpretation of the broader stack, but not confirmed here as present fact
- `Target state`: desired alignment or follow-up work that still needs explicit confirmation in the relevant repository

## ADR-003 Layer Summary

ADR-003 defines six adjacent layers:

1. Intent
2. Deterministic decision
3. Workflow and lifecycle
4. Imperative execution over time
5. Projection
6. Product composition

The key reading rule is that repos and package families may span adjacent layers. The model is about ownership boundaries, not a forced one-repo-per-layer diagram.

## Grounded Current State In This Workspace

### Ignite package-family mapping

This repository directly grounds the following package families:

- `ignite-core`
- `ignite-adapters`
- `ignite-renderer`
- `ignite-element`

| Package family | Primary ownership | Adjacent layers touched here | Does not own |
| --- | --- | --- | --- |
| `ignite-core` | deterministic decision primitives plus shared contracts for state, commands, events, and effects | intent, deterministic decision | adapter-specific integration, renderer strategy, projection assembly, product composition |
| `ignite-adapters` | integration between Ignite contracts and external sources such as Redux, MobX, and XState | deterministic decision, workflow and lifecycle, imperative execution over time | canonical business policy, renderer ownership, projection assembly, product composition |
| `ignite-renderer` | render-strategy registration and renderer/runtime utilities | projection | workflow policy, orchestration topology, product grammar |
| `ignite-element` | public Web Component assembly surface, runtime host coordination, and renderer-aware element registration built on the other Ignite families | imperative execution over time, projection, product composition | ecosystem orchestration topology, repo-external composition ownership, authority to redefine ADR-003 |

### Why the Ignite mapping is grounded

The package family split is explicit in this repository:

- `packages/ignite-core`
- `packages/ignite-adapters`
- `packages/ignite-renderer`
- `packages/ignite-element`

The package metadata and exports also support the ownership split:

- `ignite-core` describes adapter-neutral primitives
- `ignite-adapters` describes state-library adapter integrations and depends on `ignite-core`
- `ignite-renderer` describes renderer and runtime utilities
- `ignite-element` depends on all three families and presents the default public package

### Grounded observations about FAS surfaces in this workspace

This repository contains FAS workflow surfaces such as `.fas/WORKFLOW.md`, `.fas/AGENTS.md`, task packets, and verification scripts. That grounds one narrow statement:

- this workspace is operated with explicit workflow and lifecycle guidance that matches ADR-003's lifecycle concerns

It does not, by itself, ground the full present-fact ownership model of the separate `FAS` repository.

## Grounded Current-State Reading Of The Layers

### Intent

Grounded current state:
- Ignite exposes explicit commands and events rather than hiding requests in renderer mutations

### Deterministic decision

Grounded current state:
- `ignite-core` owns the core contracts used to describe state, commands, events, and effects

### Workflow and lifecycle

Grounded current state:
- adapters and runtime-facing package surfaces expose lifecycle distinctions such as shared versus isolated scope
- FAS workflow files in this repository encode explicit task phases and verification stages

### Imperative execution over time

Grounded current state:
- adapter integrations and the `ignite-element` runtime host deal with subscriptions, runtime setup, and cleanup

### Projection

Grounded current state:
- `ignite-element` owns projection assembly and turns source snapshots into render/runtime-facing surfaces
- `ignite-renderer` turns those projected surfaces into renderer-specific execution

### Product composition

Grounded current state:
- `ignite-element` assembles the lower-level package families into the public Web Component surface for this repository

## Inferred Cross-Repo Mapping

The sections below are intentionally not stated as current fact for the broader ecosystem. They are the best-fit reading of ADR-003 from this workspace, but they require confirmation in those repositories.

### `editor-save-loop`

Inferred cross-repo mapping:
- likely serves as a compact example of the same layered shape, especially around explicit lifecycle and isolated side effects

Not yet grounded here:
- whether it should be described as the proof of the architecture
- the exact ownership boundaries it declares for projection, orchestration, and composition

### `FAS`

Inferred cross-repo mapping:
- likely primary ownership: workflow policy, task lifecycle, and artifact handling
- likely does not own: product composition, renderer projection, or repo-local UI assembly

Not yet grounded here:
- the full repo-level split between deterministic policy, orchestration runtime, and presentation surfaces inside the separate `FAS` codebase

### `actor-web`

Inferred cross-repo mapping:
- likely primary ownership: orchestration topology and long-lived runtime coordination
- likely does not own: canonical workflow policy, low-level projection primitives, or design-system composition

Not yet grounded here:
- whether it owns topology as present fact
- where its boundaries stop relative to workflow policy and projection

### `Blueprint`

Inferred cross-repo mapping:
- likely primary ownership: product composition and design-system level assembly
- likely does not own: workflow policy, runtime orchestration, or low-level decision and lifecycle primitives

Not yet grounded here:
- whether it is the present-fact owner of composition for the ecosystem
- which composition boundaries remain inside `ignite-element` versus move into `Blueprint`

## Target-State Alignment Notes

If the broader stack adopts ADR-003 consistently, the alignment should look like this:

- each repository states its primary ownership and explicit `does not own` boundaries
- no repository claims orchestration, projection, and composition ownership by implication alone
- no dependency chain is treated as architecture truth without direct evidence
- topology diagrams remain explanatory, not compliance truth by themselves

## Open Questions And Follow-Ups

- Should `editor-save-loop` be described as a worked example, a seed model, or something weaker once its repository is reviewed directly?
- What does the separate `FAS` repository claim as the boundary between policy, lifecycle control, and runtime execution?
- Does `actor-web` explicitly own orchestration topology, or does it share that boundary with another runtime layer?
- Which composition responsibilities, if any, belong to `Blueprint` rather than remaining inside `ignite-element` or another product layer?
- Do we want a later cross-repo appendix once each repository has confirmed its own ADR-003 adoption language?
