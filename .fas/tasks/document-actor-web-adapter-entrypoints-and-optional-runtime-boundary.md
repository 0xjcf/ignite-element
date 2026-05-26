# document Actor-Web adapter entrypoints and optional runtime boundary

## Goal

Document the public Actor-Web adapter entrypoints and explain the optional runtime boundary without making Actor-Web a required dependency for standalone Ignite usage.

## Evidence

- The `ignite-element` and `ignite-adapters` package manifests already export `./actor-web`.
- `packages/ignite-element/README.md` and `packages/ignite-adapters/README.md` still list only XState, Redux, and MobX as public/default adapter entrypoints.

## Scope

- Update package README/docs surfaces for Actor-Web entrypoints.
- Preserve ADR-003 language that Actor-Web owns orchestration/runtime externally and Ignite consumes projection/read-model state.
- Do not change runtime behavior.

## Acceptance Criteria

- README/docs mention `ignite-element/actor-web` and `ignite-adapters/actor-web` as optional advanced runtime bridge entrypoints.
- Documentation states that Ignite remains standalone without Actor-Web.
- Documentation points readers at the right boundary model or ADR text.
- Docs-focused validation passes.

## Recommended Mode

single-agent

## Recommended Phase

implementation

## Scope Amendments

- Type: implementation-scope
- Added at: 2026-05-26
- Trigger: manifest exports verified as existing
- Reason: packages/ignite-element/package.json and packages/ignite-adapters/package.json already export ./actor-web; metadata now also exposes actor-web as a searchable package keyword. Runtime source files were reference-only; this task changes README and package metadata surfaces without changing runtime behavior.
- Added paths: packages/ignite-element/README.md, packages/ignite-adapters/README.md, packages/ignite-element/package.json, packages/ignite-adapters/package.json
- Evidence source: package export check
- Evidence: package export check | .fas/state/task-packet.json | Explicit package.json export scope was verified via jq; implementation changes are limited to package README documentation and package keywords.

## Affected files
- packages/ignite-element/README.md
- packages/ignite-adapters/README.md
- packages/ignite-element/package.json
- packages/ignite-adapters/package.json
