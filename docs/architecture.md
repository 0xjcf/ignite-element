# `ignite-element` Architecture

This repository follows a hexagonal architecture with actor-model behavior
topology.

The short version:

- Actors and state machines own behavior.
- Adapters translate runtime/library realities into normalized facts.
- `ignite-core` defines contract primitives and shared typing only.
- `ignite-element` is the sole projection, assembly, and runtime-host surface.

If code crosses those boundaries, it is wrong even when it appears to work.

## Core Philosophy

> Behavior is deterministic.  
> The world is nondeterministic.  
> Boundaries exist to keep them apart.

The repo is layered as packages, but the responsibility model is hexagonal:

- Behavior is owned by actors and state machines.
- Ports are the event, command, state, and effect contracts.
- Adapters integrate concrete runtimes such as XState, Redux, MobX, the DOM, and
  renderer environments.
- The shell assembles adapters, projections, and host lifecycle into a usable
  component/runtime surface.

## Package Responsibilities

### `packages/ignite-core`

Contract-only.

It owns:

- event and effect typing
- render argument contracts
- adapter-neutral helpers like `matchState`
- shared primitives such as `StateScope`

It does not own:

- projection assembly
- DOM lifecycle
- adapter-specific behavior
- renderer integration

### `packages/ignite-adapters`

Adapter integration only.

It owns:

- XState, Redux, and MobX adapter factories
- source guards and source-specific config/types
- command-actor typing for integrated runtimes

It must:

- normalize library/runtime behavior into stable adapter contracts
- treat expected failures as data or no-op facts
- avoid deciding product behavior or UI policy

It must not:

- own projection assembly
- own component authoring
- encode business rules

### `packages/ignite-renderer`

Rendering runtime only.

It owns:

- JSX/lit rendering surfaces
- style injection
- renderer-specific utilities

It must not own:

- domain behavior
- adapter selection
- component authoring policy

### `packages/ignite-element`

This is the product surface.

It owns:

- `igniteCore(...)` authoring
- projection assembly
- command/effect projection into render args
- DOM/custom-element lifecycle
- headless runtime access
- public entrypoints such as `ignite-element/xstate`

This package is where projected meaning becomes a usable UI/runtime contract.

## Actor-Model Topology

Behavior should be modeled as message-driven actors or machines.

- Commands express intent.
- Events report facts.
- State transitions remain deterministic.
- Effects are selected from state transitions, not hidden inside adapters or UI.

The topology should read like this:

`intent -> actor/machine -> state transition -> selected effect -> adapter fact -> actor/machine`

That loop keeps causality explicit and replayable.

## Hexagonal Rules

### Behavior Boundary

Behavior belongs in actors and machines, not in adapters or rendering code.

Allowed:

- guards
- transitions
- invariants
- event handling
- deterministic effect selection

Forbidden:

- `fetch`, timers, randomness, browser globals
- direct DOM mutation
- direct calls into infrastructure libraries from behavior logic

### Adapter Boundary

Adapters sit at the edge of the system.

They may talk to runtime libraries, stores, or browser APIs, but they must not:

- decide domain behavior
- mutate authoritative behavior state directly
- throw for expected failures

Expected failures should return facts, warnings, or inert no-op behavior that the
shell can reason about. Exceptions are reserved for programmer mistakes and
invariant breaches.

### Projection Boundary

Projection and authoring live in `ignite-element`.

UI should never:

- inspect raw machine internals directly
- duplicate business rules
- branch on unprojected infrastructure state

Instead, `ignite-element` converts snapshots plus commands/effects into a stable
render/runtime surface.

### UI Boundary

Components render projected meaning and send intent.

They should stay declarative:

- consume render args
- invoke commands
- emit declared events

They should not:

- implement policy
- reach into adapters
- infer domain behavior from raw runtime objects

## Errors As Data

This repo uses `errors-as-data` for adapters.

That means:

- expected adapter failures should surface as explicit facts, warnings, or
  inert/no-op behavior
- behavior and shell layers should react to those facts explicitly
- only programmer bugs or invariant violations should throw

This keeps adapter failures observable without hiding control flow in
exceptions.

## Enforcement Map

- `packages/ignite-core/src/`: contract-only functional core
- `packages/ignite-adapters/src/`: adapter integration boundary
- `packages/ignite-renderer/src/`: renderer/runtime boundary
- `packages/ignite-element/src/`: shell, projection, assembly, and host runtime

FAS boundary rules and ADR-003 are the authoritative enforcement surfaces for
these responsibilities.

## How To Extend The System

When adding a feature:

1. Identify the actor or machine that owns the behavior.
2. Express new intent and fact events.
3. Add or extend adapters only for runtime/library integration.
4. Project the resulting meaning through `ignite-element`.
5. Render declaratively on top of that projected contract.

If a change requires behavior in UI or adapters, the boundary is probably wrong.
