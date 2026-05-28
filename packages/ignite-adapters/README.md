# ignite-adapters

Advanced adapter integrations for Ignite.

This package provides the state-library-specific adapter layers that power Ignite's higher-level APIs.

Exported entrypoints:

- `ignite-adapters`
- `ignite-adapters/xstate`
- `ignite-adapters/redux`
- `ignite-adapters/mobx`
- `ignite-adapters/actor-web`

Use this package directly only when you are building custom bindings or integrating Ignite behavior without the full `ignite-element` package.

`ignite-adapters/actor-web` is an optional advanced runtime bridge. It adapts an
Actor-Web-owned runtime source into Ignite adapter state; it does not make
Actor-Web a required dependency for standalone Ignite usage.

Package role:

- adapter factories
- source guards
- source-specific config and typing

This package no longer exposes component authoring helpers. Use `ignite-element/xstate`, `ignite-element/redux`, or `ignite-element/mobx` to define components and runtime behavior.

Most application and component authors should use:

- `ignite-element/xstate`
- `ignite-element/redux`
- `ignite-element/mobx`
- `ignite-element/actor-web` when the host app already owns an Actor-Web runtime

Actor-Web owns orchestration, transport, and runtime lifecycle coordination.
Ignite consumes projection/read-model state from that boundary. See
[ADR-003](../../docs/adr-003-shared-arc.md) and the
[shared architecture model](../../docs/shared-architecture-model.md) for the
boundary model.
