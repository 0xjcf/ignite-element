# ignite-adapters

Advanced adapter integrations for Ignite.

This package provides the state-library-specific adapter layers that power Ignite's higher-level APIs:

- `ignite-adapters/xstate`
- `ignite-adapters/redux`
- `ignite-adapters/mobx`

Use this package directly only when you are building custom bindings or integrating Ignite behavior without the full `ignite-element` package.

Package role:

- adapter factories
- source guards
- source-specific config and typing

This package no longer exposes component authoring helpers. Use `ignite-element/xstate`, `ignite-element/redux`, or `ignite-element/mobx` to define components and runtime behavior.

Most application and component authors should use:

- `ignite-element/xstate`
- `ignite-element/redux`
- `ignite-element/mobx`
