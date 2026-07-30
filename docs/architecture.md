# `ignite-element` Architecture

This repository follows a hexagonal architecture with explicit actor- and
state-machine-friendly boundaries.

The short version:

- consumers supply intent and behavior
- `ignite-core` owns contract primitives only
- adapters normalize runtime/library facts into stable Ignite contracts
- `ignite-element` is the projection, assembly, and runtime-host surface
- `ignite-renderer` stays renderer-only
- source-native provisioning and host-boundary rules live in
  [`docs/source-native-provisioning.md`](./source-native-provisioning.md)
- Actor-Web evidence-consumption boundaries live in
  [`docs/actor-web-evidence-governed-projections.md`](./actor-web-evidence-governed-projections.md)

If code crosses those boundaries, it is wrong even when it appears to work.

## Core Philosophy

> Behavior is deterministic.  
> The world is nondeterministic.  
> Boundaries exist to keep them apart.

The repo is layered as packages, but the responsibility model is hexagonal:

- behavior remains in consumer-owned actors, machines, stores, or equivalent
  sources
- capability ports name environmental needs consumed by source behavior
- adapters translate concrete runtimes such as XState, Redux, MobX, actor-web,
  the DOM, and renderer environments into normalized facts
- events, commands, state/snapshot, effects, and render args are Ignite
  contracts and projection callback surfaces, not ports
- the shell assembles projections, renderer integration, and host lifecycle into
  a usable component/runtime surface

For the normative exact-source provisioning contract, the source-native binding
boundary, the native-lifecycle ownership rules, and the retained
Canvas/Cytoscape boundary, see
[`docs/source-native-provisioning.md`](./source-native-provisioning.md).

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
| Workflow and lifecycle | source lifecycles plus `ignite-element` host lifecycle | Ignite starts, watches, and releases adapters for DOM and headless usage; it does not own FAS workflow lifecycle or external orchestration policy. Source-native provisioning and native shutdown ownership are standardized separately in [`docs/source-native-provisioning.md`](./source-native-provisioning.md). |
| Imperative execution over time | `ignite-adapters` plus `ignite-element` runtime host coordination | Runtime-library integration, subscriptions, setup, cleanup, and command execution live at the edge. Actor-Web keeps execution-time authorization, durable receipts, checkpoints, and reconciliation when that runtime is composed. |
| Projection | `ignite-element` projection assembly | `view`, `commands`, `effects`, and schema metadata turn source snapshots into a stable UI/runtime contract. Effects are the outward fact layer; the normative host/effect boundary lives in [`docs/source-native-provisioning.md`](./source-native-provisioning.md), and Actor-Web evidence-consumption boundaries live in [`docs/actor-web-evidence-governed-projections.md`](./actor-web-evidence-governed-projections.md). |
| Product composition | `ignite-element` package surface, then consumer apps on top | Ignite assembles the package family into a reusable component/runtime surface. Consumer apps compose those surfaces into products. |

## Current Fact Vs Target State

| Surface | Current fact | Target state |
| --- | --- | --- |
| Package boundaries | `ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element` are split into workspace packages. | CI and FAS checks keep package imports aligned with this split. |
| Boundary rules | `.fas-config.json` and `.fas/architecture-rules.json` define the committed repo map. | FAS and CI both evaluate the same committed rules before release. |
| Actor-web integration | Ignite supports an optional actor-web adapter surface; that is compatibility, not a claim that this repo owns actor-web orchestration boundaries, execution receipts, checkpoint truth, or reconciliation authority. | A later cross-repo contract can name actor-web's runtime role explicitly once that repository confirms it. |
| FAS integration | FAS remains a workflow participant around this repo's planning and verification artifacts. Ignite owns repo-local architecture facts and separate Story or narrative evidence. | FAS may consume the committed Ignite boundary map or exported evidence fixtures, but product semantics stay in Ignite and consumer apps. |
| Source-native provisioning | Current shipped behavior passes a bound source into `igniteCore(...)`; host access still exists in current callback contexts. | `docs/source-native-provisioning.md` defines the accepted exact-source contract, labels current-vs-target host semantics, and rejects `Feature` wrappers, disposal policy, `driver`, `igniteEnvironment`, and `ports` on `igniteCore(...)`. |

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

For Actor-Web specifically, projected capability or `canExecute` state is
descriptive only. Actor-Web must still re-authorize command existence, payload,
principal, approval freshness, revision freshness, idempotency, and policy at
execution time, and Ignite must not treat `send` acceptance or Story evidence
as a receipt.

The projection boundary does not own environment selection, source-native
binding, or retained-resource lifecycle. Those are fixed separately in
[`docs/source-native-provisioning.md`](./source-native-provisioning.md) and
[`docs/actor-web-evidence-governed-projections.md`](./actor-web-evidence-governed-projections.md).

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
2. Bind concrete adapters through the source library's native provisioning
   mechanism, not through `igniteCore(...)`.
3. Express new intent and fact events through explicit contracts.
4. Add or extend adapters only for runtime/library integration.
5. Project the resulting meaning through `ignite-element`.
6. Render declaratively on top of that projected contract, keeping retained
   resources in presentation-owned ref or commit code.

If a change requires behavior in UI, adapters, or renderer code, the boundary is
probably wrong.
