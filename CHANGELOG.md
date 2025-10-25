# Changelog

## Unreleased

### Minor Changes

- Adapter inference: `igniteCore` now infers XState, Redux, and MobX adapters from the `source` you supply. Existing code that specifies `adapter` continues to work, but the discriminator is optional when inference succeeds.
- Central configuration: Added `defineIgniteConfig`, `getIgniteConfig`, and optional Vite/Webpack plugins so global styles can be managed via `ignite.config.ts`.
- Ignite JSX runtime: Ignite JSX becomes the default renderer with JSX helpers (`jsx`, `jsxs`, `jsxDEV`) and configuration hooks to switch between Ignite JSX and the optional lit strategy via `ignite.config.ts`.

## 1.4.7

### Patch Changes

- a96d055: Improve Redux typing inference, add typecheck script, and keep unsupported adapter errors consistent.

## 1.4.6

### Patch Changes

- Fix workspace configuration so pnpm 9 installs succeed under Node.js 22 in CI
- Replace ESLint with Biome for linting and formatting

## 1.4.4

### Patch Changes

- c07f7be: Adjust documentation

## 1.4.3

### Patch Changes

- 4104ae9: Fix duplicate stylesheet fetching

## 1.4.1

### Patch Changes

- 6ed2a0f: Exclude examples and tests from packaged bundle

## 1.4.0

### Minor Changes

- f131b10: Refactor XStateAdapter for Unified API

## 1.3.1

### Patch Changes

- 050b368: Remove examples from published package

## 1.3.0

### Minor Changes

- 6b2c06c: Expose setGlobalStyles function for global styling

## 1.2.1

### Patch Changes

- fd292e3: set eslint-plugin-security to dev dependencies

## 1.2.0

### Minor Changes

- ec0d98e: ### Features

  - **Decorators for Reactive Components**: Added `Shared` and `Isolated` decorators to enable reactive, class-based components with support for XState, Redux, and MobX.
  - **DOM Event Handling**: Enhanced the `send` method to support DOM events, improving interoperability and enabling dynamic updates.
  - **Gradient Tally Example**: Added an example showcasing dynamic rendering with gradient tally effects using lit-html.

  ### Improvements

  - **Initialization Guard**: Moved `_initialized` flag handling to `IgniteElement` for better DOM readiness and SSR support.
  - **Redux Adapter Enhancements**: Added type-safe dispatch and dynamic state management for slices and stores.
  - **Test Enhancements**: Suppressed console warnings and errors during test runs for cleaner output.
  - **CI/CD Integration**: Added **Codecov** integration with 80% coverage enforcement and reporting.

  ### Documentation

  - Updated README to explain web standards leveraged by `ignite-element` and added links to official documentation for reference.

## 1.1.0

### Minor Changes

- 9385692: Refactored global styles handling and updated style injection API. Added deprecation warnings for `styles.paths` and `styles.custom`.

All notable changes to this project will be documented in this file. See [Changesets](https://github.com/changesets/changesets) for release and versioning guidelines.

## 1.0.13 to 1.0.19 (2024-12-16)

- **Tooling migration**:

  - Migrated from `standard-version` to `Changesets` for versioning and changelog generation.
  - Updated CI to use `pnpm` for dependency management.
  - Improved CI workflow with automatic publishing to NPM after successful builds.

- **Internal updates**:
  - Optimized caching steps in the CI workflow for better performance.
  - Refined publishing steps to avoid redundant actions.

## 1.0.0 (2024-12-11)

### Features

- Initial release with support for XState, Redux, and MobX adapters.
- Added support for custom and path-based styles.
- Provided examples for XState, Redux, and MobX integrations.
