# Document Actor-Web adapter entrypoints and optional runtime boundary

## Goal

Document the public Actor-Web adapter entrypoints and explain the optional runtime boundary without making Actor-Web a required dependency for standalone Ignite usage.

## Evidence

- `packages/ignite-element/package.json` exports `./actor-web`.
- `packages/ignite-adapters/package.json` exports `./actor-web`.
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
