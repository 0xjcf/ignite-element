# ignite-core

Advanced adapter-neutral primitives for Ignite's projection and runtime layers.

Use `ignite-core` only when you are building custom adapters, headless integrations, or library-level tooling on top of Ignite internals.

Most application and component authors should install `ignite-element` instead.

Package role:

- adapter-neutral types and contracts
- projection and effect execution primitives
- shared runtime helpers used by higher-level packages

Default public package for application code:

- `ignite-element`
- `ignite-element/xstate`
- `ignite-element/redux`
- `ignite-element/mobx`
