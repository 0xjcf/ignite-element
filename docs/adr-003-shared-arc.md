# ADR-003: Shared Architecture Contract

## Status

Proposed

## Context

The shared architecture discussion has drifted between a normative decision and a descriptive model. That drift creates two problems:

- ownership boundaries become harder to review because multiple documents appear to define them
- repo-specific observations and cross-repo assumptions get mixed together as if they had the same evidentiary weight

This workspace grounds part of the shared architecture directly:

- `ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element` are explicit package families in this repository
- the current package split and FAS memory both reinforce a layered model that must stay aligned with current package boundaries rather than aspirational end-state diagrams

This workspace does not directly ground present-fact ownership claims for `FAS`, `actor-web`, or `Blueprint`. Those systems may still participate in the shared architecture, but any mapping for them must be treated as inferred or target-state until their own repositories confirm the contract.

## Decision

ADR-003 is the normative shared architecture contract for this ecosystem.

The contract defines six adjacent layers:

1. Intent
2. Deterministic decision
3. Workflow and lifecycle
4. Imperative execution over time
5. Projection
6. Product composition

These layers describe responsibilities, not a one-repo-per-layer topology. A repository or package family may span adjacent layers when that boundary is explicit and reviewable. A repository or package family must not claim non-adjacent responsibilities by implication.

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

- asynchronous work, ordering, retries, scheduling, delivery, supervision, and failure isolation
- runtime coordination that interacts with non-deterministic systems

Does not own:

- source-of-truth policy for what work means
- presentation-specific projection logic
- product composition

#### 5. Projection

Primary ownership:

- read models and view models derived from internal state
- translation of runtime or workflow state into consumable render or inspection surfaces

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

Within this repository, the shared architecture maps to package families as follows.

#### `ignite-core`

Primary ownership:

- deterministic decision primitives
- state, command, event, and effect contracts used by higher layers

Does not own:

- adapter integration details
- renderer registration or DOM strategy concerns
- product assembly

#### `ignite-adapters`

Primary ownership:

- integration between Ignite contracts and external state/runtime sources such as Redux, MobX, and XState
- boundary translation needed to expose those sources through Ignite contracts

Does not own:

- canonical business policy
- renderer strategy selection
- product composition

Notes:

- this family may touch deterministic decision and workflow/lifecycle boundaries because adapters expose source-specific runtime facts
- that adjacency does not make `ignite-adapters` the owner of orchestration or composition

#### `ignite-renderer`

Primary ownership:

- render strategy registration and renderer-facing runtime utilities
- translation from projections into renderer-specific execution surfaces

Does not own:

- workflow policy
- application orchestration
- product grammar

#### `ignite-element`

Primary ownership:

- public assembly of Ignite package families into a Web Component oriented product surface
- component factory, runtime host coordination, and renderer-aware element registration

Does not own:

- ecosystem-wide orchestration topology
- cross-product composition rules outside this repository
- authority to redefine the underlying shared architecture contract

Notes:

- `ignite-element` spans adjacent projection and product-composition concerns because it assembles renderer and runtime packages into a consumable surface
- this does not make the repository a monolithic layer

### Cross-repo adoption rule

Any repository mapping beyond the grounded Ignite package families must satisfy both rules before it is stated as current fact:

1. the ownership claim is directly evidenced in that repository
2. the mapping names both primary ownership and `does not own` boundaries

Until then, cross-repo mappings belong in explanatory or target-state material, not in normative present-fact claims.

### Optional cross-project integration

Cross-project integration is additive, not mandatory.

Each repository or package family should remain usable in isolation with local implementations of adjacent layers where needed. Shared ecosystem integrations should happen through explicit contracts, adapters, schemas, events, or configuration surfaces rather than hard sibling-repository runtime dependencies.

In practice, the target shape is:

- `ignite-element` alone: fully usable library
- `ignite-element` + `Blueprint`: richer composition
- `ignite-element` + `actor-web`: external orchestration and runtime coordination
- `ignite-element` + `FAS`: workflow and policy tooling
- all together: integrated platform stack

## Consequences

- ADR-003 becomes the only normative source for the shared architecture contract
- explanatory documents may interpret ADR-003, but they must not redefine it
- reviews can now distinguish grounded current-state mappings from inferred or target-state adoption work
- package-family and repo mappings must include ownership boundaries, not only layer labels
- future cross-repo alignment work for `FAS`, `actor-web`, and `Blueprint` needs confirmation in those repositories before it can be treated as current state
- standalone operation remains a first-class requirement even when richer cross-project integrations exist

## Non-goals

- This ADR does not claim that one repository equals one architectural layer.
- This ADR does not declare current-fact ownership for `FAS`, `actor-web`, or `Blueprint`.
- This ADR does not treat any topology diagram as compliance truth by itself.
- This ADR does not redefine current package boundaries to match a future migration target.
- This ADR does not require sibling-project runtime dependencies for basic operation of an individual repository.
