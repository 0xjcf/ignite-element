# clean package surfaces, remove generated source artifacts, and document the public package contract

## Source
Created with `fas create-task` on 2026-03-23.

## Problem
Phase 4 of the package-architecture cleanup. Remove generated declaration artifacts from src trees, tighten exports across ignite-core, ignite-adapters, ignite-renderer, and ignite-element, document ignite-element as the default public package, and define which internal packages are supported advanced entrypoints versus implementation-only layers.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.
