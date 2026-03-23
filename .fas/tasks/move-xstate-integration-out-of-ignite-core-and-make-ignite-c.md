# move xstate integration out of ignite-core and make ignite-core adapter-agnostic

## Source
Created with `fas create-task` on 2026-03-23.

## Problem
Phase 2 of the package-architecture cleanup. Move XState-specific adapter code, types, guards, and igniteCore entry construction out of ignite-core into ignite-adapters/xstate so ignite-core contains only adapter-neutral primitives: IgniteAdapter, event typing, projection/view plumbing, effects/runtime helpers, and shared facade types.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.
