# @ignite-element/core

Advanced adapter-neutral primitives for Ignite contracts and shared typing.

Use `@ignite-element/core` only when you are building custom adapters, headless integrations, or library-level tooling on top of Ignite internals.

Most application and component authors should install `ignite-element` instead.

Package role:

- adapter-neutral types and contracts
- event/effect typing and callback contracts
- small shared utilities used by higher-level packages

This package no longer exposes projection or component authoring helpers. Use `ignite-element/xstate`, `ignite-element/redux`, or `ignite-element/mobx` for authoring components.

Default public package for application code:

- `ignite-element`
- `ignite-element/xstate`
- `ignite-element/redux`
- `ignite-element/mobx`
