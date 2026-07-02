# `ignite-element` Architecture

This repository follows a hexagonal architecture with explicit actor- and
state-machine-friendly boundaries.

The short version:

- consumers supply intent and behavior
- `ignite-core` owns contract primitives only
- adapters normalize runtime/library facts into stable Ignite contracts
- `ignite-element` is the projection, assembly, and runtime-host surface
- `ignite-renderer` stays renderer-only

If code crosses those boundaries, it is wrong even when it appears to work.

## Core Philosophy

> Behavior is deterministic.  
> The world is nondeterministic.  
> Boundaries exist to keep them apart.

The repo is layered as packages, but the responsibility model is hexagonal:

- behavior remains in consumer-owned actors, machines, stores, or equivalent
  sources
- ports are the event, command, state, effect, and render-arg contracts
- adapters translate concrete runtimes such as XState, Redux, MobX, actor-web,
  the DOM, and renderer environments into normalized facts
- the shell assembles projections, renderer integration, and host lifecycle into
  a usable component/runtime surface

## Package Responsibilities

### `packages/ignite-core`

Contract-only.

It owns:

- event, command, effect, and render-arg typing
- adapter-neutral helpers such as `matchState`
- shared primitives such as `StateScope`

It does not own:

- projection assembly
- DOM lifecycle
- adapter-specific behavior
- renderer integration

### `packages/ignite-adapters`

Adapter integration only.

It owns:

- XState, Redux, MobX, and actor-web adapter factories
- source guards and source-specific config/types
- command-actor typing and runtime translation for integrated sources

It must:

- normalize library/runtime behavior into stable adapter contracts
- treat expected failures as data or inert facts
- avoid deciding product behavior or UI policy

It must not:

- own projection assembly
- own component authoring
- encode business rules

### `packages/ignite-renderer`

Renderer execution only.

It owns:

- JSX and lit rendering surfaces
- renderer registration
- renderer-specific utilities such as style injection

It must not own:

- domain behavior
- adapter selection
- component authoring policy
- orchestration or product semantics

### `packages/ignite-element`

Projection, assembly, and runtime-host surface.

It owns:

- `igniteCore(...)` authoring
- projection assembly
- command and effect projection into render args
- DOM/custom-element lifecycle
- headless runtime access
- public entrypoints such as `ignite-element/xstate`

This package is where normalized runtime facts become a usable UI/runtime
contract.

It does not own:

- provider or model ownership
- external orchestration topology
- app-level policy

## ADR-003 Layer Map

| ADR-003 layer | Current Ignite owner | Current fact |
| --- | --- | --- |
| Intent | consumer commands and declared events surfaced through `ignite-element` | Commands are the public intent surface. Declared events are the outward fact surface for hosts, tests, and headless runtimes. |
| Deterministic decision | consumer-owned actors/state machines plus `ignite-core` contracts | Ignite supplies typed contracts and adapter-neutral helpers. Product behavior remains in the consuming source. |
| Workflow and lifecycle | source lifecycles plus `ignite-element` host lifecycle | Ignite starts, watches, and releases adapters for DOM and headless usage; it does not own FAS workflow lifecycle or external orchestration policy. |
| Imperative execution over time | `ignite-adapters` plus `ignite-element` runtime host coordination | Runtime-library integration, subscriptions, setup, cleanup, and command execution live at the edge. |
| Projection | `ignite-element` projection assembly | `view`, `commands`, `effects`, and schema metadata turn source snapshots into a stable UI/runtime contract. |
| Product composition | `ignite-element` package surface, then consumer apps on top | Ignite assembles the package family into a reusable component/runtime surface. Consumer apps compose those surfaces into products. |

## Current Fact Vs Target State

| Surface | Current fact | Target state |
| --- | --- | --- |
| Package boundaries | `ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element` are split into workspace packages. | CI and FAS checks keep package imports aligned with this split. |
| Boundary rules | `.fas-config.json` and `.fas/architecture-rules.json` define the committed repo map. | FAS and CI both evaluate the same committed rules before release. |
| Actor-web integration | Ignite supports an optional actor-web adapter surface; that is compatibility, not a claim that this repo owns actor-web orchestration boundaries. | A later cross-repo contract can name actor-web's runtime role explicitly once that repository confirms it. |
| FAS integration | FAS remains a workflow participant around this repo's planning and verification artifacts. Ignite owns repo-local architecture facts. | FAS may consume the committed Ignite boundary map, but product semantics stay in Ignite and consumer apps. |

## Explanatory Topology

The topology below is explanatory only. It shows responsibility flow inside this
repository; it is not a dependency proof for any broader ecosystem stack.

`consumer intent -> source behavior -> adapter fact -> ignite-element projection -> renderer execution`

That flow keeps causality explicit without implying that `ignite-element`
depends on providers, models, or an external runtime kernel.

## Hexagonal Rules

### Behavior Boundary

Behavior belongs in consumer-owned actors, machines, stores, or equivalent
sources, not in adapters or rendering code.

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

Expected failures should return facts, warnings, or inert no-op behavior that
the shell can reason about. Exceptions are reserved for programmer mistakes and
invariant breaches.

### Projection Boundary

Projection and authoring live in `ignite-element`.

UI should never:

- inspect raw machine internals directly
- duplicate business rules
- branch on unprojected infrastructure state

Instead, `ignite-element` converts snapshots plus commands/effects into a stable
render/runtime surface.

### Renderer Boundary

`ignite-renderer` executes renderer strategy concerns only.

It should:

- register render strategies
- translate projected surfaces into renderer calls
- keep renderer-specific utilities isolated

It should not:

- decide behavior
- normalize source/runtime facts
- re-own projection or product policy

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
- `packages/ignite-renderer/src/`: renderer execution boundary
- `packages/ignite-element/src/`: projection, assembly, and host runtime surface

FAS boundary rules and ADR-003 are the authoritative enforcement surfaces for
these responsibilities.

## How To Extend The System

When adding a feature:

1. Identify the source that owns the behavior.
2. Express new intent and fact events through explicit contracts.
3. Add or extend adapters only for runtime/library integration.
4. Project the resulting meaning through `ignite-element`.
5. Render declaratively on top of that projected contract.

If a change requires behavior in UI, adapters, or renderer code, the boundary is
probably wrong.
