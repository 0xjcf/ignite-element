# ADR-003: Shared Architecture Contract

## Status

Proposed

## Context

The shared architecture discussion has drifted between a normative decision and
descriptive ecosystem sketches. That drift creates two problems:

- ownership boundaries become harder to review because multiple documents appear
  to define them
- repo-local facts, cross-repo inferences, and target-state aspirations get
  mixed together as if they had the same evidentiary weight

This repository directly grounds only part of the shared architecture:

- `ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element` are
  explicit package families in this workspace
- those package families already encode a layered boundary between contracts,
  runtime translation, renderer execution, and product-facing assembly

This repository does not directly ground present-fact ownership claims for
`FAS`, `fas-local`, or `actor-web`. Those systems may participate in the shared
architecture, but any mapping for them must stay labeled as inferred or
target-state until their own repositories confirm the contract.

## Decision

ADR-003 is the single normative shared-architecture source for this repository.

The contract defines six adjacent layers:

1. Intent
2. Deterministic decision
3. Workflow and lifecycle
4. Imperative execution over time
5. Projection
6. Product composition

These layers describe responsibilities, not a one-repo-per-layer topology.
Repositories and package families may span adjacent layers when the boundary is
explicit and reviewable. They must not claim non-adjacent responsibilities by
implication.

### Law Of Least Inference

Prefer explicit contracts, explicit lifecycle, and explicit ownership over
architectural inference.

Default rule:

- if a boundary can be made explicit through contracts, events, adapters, or
  repository-local evidence, do that instead of inferring it from topology,
  naming, or package adjacency

Escape clause:

- inference is acceptable when it is the narrowest reasonable way to preserve
  correctness, latency, or cost, provided the document or code path names the
  inference as such and does not present it as grounded present fact

### Layer contract

#### 1. Intent

Primary ownership:

- explicit commands, requests, and events that ask the system to do work

Does not own:

- policy decisions about whether the request is allowed
- execution sequencing, retries, or delivery mechanics
- UI composition concerns

#### 2. Deterministic decision

Primary ownership:

- pure or mostly deterministic rules that decide what should happen next
- state transition logic
- command validation and rule enforcement

Does not own:

- timers, I/O, retries, message delivery, or orchestration
- rendering and layout decisions

#### 3. Workflow and lifecycle

Primary ownership:

- explicit lifecycle state
- allowed progression through phases, statuses, or runtime states
- coordination rules that depend on where the system is in time

Does not own:

- low-level execution infrastructure
- visual composition or design grammar

#### 4. Imperative execution over time

Primary ownership:

- asynchronous work, ordering, retries, scheduling, delivery, and supervision
- runtime coordination that interacts with non-deterministic systems

Does not own:

- source-of-truth policy for what work means
- presentation-specific projection logic
- product composition

#### 5. Projection

Primary ownership:

- read models and view models derived from internal state
- translation of runtime or workflow state into consumable render or inspection
  surfaces

Does not own:

- orchestration and runtime topology
- core decision rules
- page, application, or product assembly

#### 6. Product composition

Primary ownership:

- assembly of projections, commands, and surfaces into user-facing products
- composition grammar, layout, and reusable product structure

Does not own:

- workflow policy
- runtime orchestration
- low-level projection mechanics

### Grounded Ignite package-family mapping

Within this repository, the shared architecture maps to package families as
follows.

#### `ignite-core`

Primary ownership:

- contract primitives for state, commands, events, effects, and render-facing
  types
- adapter-neutral helpers used by higher layers

Does not own:

- adapter integration details
- renderer registration or DOM strategy concerns
- projection assembly
- product composition

#### `ignite-adapters`

Primary ownership:

- translation between Ignite contracts and external runtime sources such as
  Redux, MobX, XState, and actor-web
- normalization of source-specific runtime facts into stable Ignite contracts

Does not own:

- canonical business policy
- renderer strategy selection
- projection assembly
- product composition

Notes:

- this family may touch deterministic decision, lifecycle, and runtime
  coordination boundaries because adapters expose source-specific facts
- that adjacency does not make `ignite-adapters` the owner of workflow policy,
  orchestration topology, or composition

#### `ignite-renderer`

Primary ownership:

- render-strategy registration
- renderer-specific runtime utilities
- translation from projected surfaces into renderer execution surfaces

Does not own:

- workflow policy
- application orchestration
- product grammar

#### `ignite-element`

Primary ownership:

- public projection and assembly surface for the Ignite package families
- component factory, runtime host coordination, and renderer-aware element
  registration
- headless runtime access built on the same projected contract

Does not own:

- ecosystem-wide orchestration topology
- provider or model ownership
- cross-product composition rules outside this repository
- authority to redefine the underlying shared-architecture contract

Notes:

- `ignite-element` spans adjacent projection and product-composition concerns
  because it assembles contracts, adapters, and renderer integration into a
  consumable surface
- that does not imply a dependency chain from `ignite-element` to providers or
  models, nor does it make this repository the owner of external runtime policy

### Cross-repo adoption rule

Any repository mapping beyond the grounded Ignite package families must satisfy
both rules before it is stated as current fact:

1. the ownership claim is directly evidenced in that repository
2. the mapping names both primary ownership and `does not own` boundaries

Until then, cross-repo mappings belong in explanatory or target-state material,
not in normative present-fact claims.

### Current vs target posture for adjacent repos

Current fact in this repository:

- this repo ships an optional `actor-web` adapter surface
- this repo is operated with FAS workflow artifacts and validation surfaces

Target-state only from this repository's point of view:

- `actor-web` may be an orchestration participant with explicit runtime
  boundaries once that repository confirms the claim
- `FAS` may remain a workflow-policy and evidence participant without being
  treated here as the current owner of Ignite runtime behavior
- `fas-local` may participate as a local runtime host or execution target in the
  broader stack, but this repo does not treat it as a permanent kernel owner for
  the ecosystem

### Optional cross-project integration

Cross-project integration is additive, not mandatory.

Each repository or package family should remain usable in isolation with local
implementations of adjacent layers where needed. Shared ecosystem integrations
should happen through explicit contracts, adapters, schemas, events, read
models, or configuration surfaces rather than hard sibling-repository runtime
dependencies.

## Consequences

- ADR-003 becomes the only normative source for the shared-architecture
  contract in this repository
- explanatory documents may interpret ADR-003, but they must not redefine it
- reviews can distinguish grounded current-state mappings from inferred or
  target-state adoption work
- package-family and repo mappings must include ownership boundaries, not only
  layer labels
- diagrams and topology sketches are explanatory only unless backed by explicit
  repo-local evidence
- standalone operation remains a first-class requirement even when richer
  cross-project integrations exist

## Boundary Non-Goals

- This ADR does not claim that one repository equals one architectural layer.
- This ADR does not declare current-fact ownership for `FAS`, `fas-local`, or
  `actor-web`.
- This ADR does not treat any dependency or topology diagram as compliance truth
  by itself.
- This ADR does not redefine current package boundaries to match a future
  migration target.
- This ADR does not require sibling-project runtime dependencies for basic
  operation of an individual repository.
