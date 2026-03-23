# ignite-store

Compatibility re-export package for the move from `ignite-store` to `ignite-adapters`.

This package currently re-exports:

- `ignite-adapters`
- `ignite-adapters/redux`
- `ignite-adapters/mobx`

Existing integrations can keep using `ignite-store` during the migration.

New work should use:

- `ignite-adapters`
- `ignite-adapters/redux`
- `ignite-adapters/mobx`
- or the higher-level `ignite-element` entrypoints
