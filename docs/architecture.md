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

## ADR-003 Layer Map

| ADR-003 layer | Current Ignite owner | Current fact |
| --- | --- | --- |
| Intent | `ignite-element` commands and declared events | Commands are the public intent surface. Declared events are the outward fact surface for hosts, tests, and agent runtimes. |
| Deterministic decision | User-provided actors/state machines plus `ignite-core` contracts | Ignite supplies typed contracts and adapter-neutral helpers. Product behavior remains in the consuming actor or state machine. |
| Workflow and lifecycle | `ignite-element` custom-element lifecycle and headless runtime lifecycle | Ignite starts, watches, and stops adapters for DOM and headless usage; it does not own FAS workflow lifecycle. |
| Imperative execution over time | `ignite-adapters`, renderer integration, config plugins | Runtime-library integration, DOM rendering, style injection, and bundler/config loading live at the edge. |
| Projection | `ignite-element` projection assembly | `view`, `commands`, `effects`, and schema metadata turn state snapshots into a stable UI/runtime contract. |
| Product composition | Consumer apps and examples | Apps compose registered custom elements. Ignite does not own app-level policy or cross-repo orchestration. |

## Current Fact Vs Target State

| Surface | Current fact | Target state |
| --- | --- | --- |
| Package boundaries | `ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element` are split into workspace packages. | CI and FAS checks keep package imports aligned with this split. |
| Boundary rules | `.fas-config.json` and `.fas/architecture-rules.json` define the committed repo map. | FAS and CI both evaluate the same committed rules before release. |
| Actor-Web integration | Ignite documents future shared-runtime alignment but does not depend on Actor-Web. | A later explicit adapter can bridge Actor-Web actors into Ignite without making Ignite own orchestration. |
| FAS integration | FAS remains the workflow/checking orchestrator. Ignite owns repo-local architecture facts. | FAS may consume the committed Ignite boundary map, but product semantics stay in Ignite and consumer apps. |

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
