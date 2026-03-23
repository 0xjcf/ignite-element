# rename ignite-store to ignite-adapters and normalize adapter package boundaries

## Source
Created with `fas create-task` on 2026-03-23.

## Problem
Phase 1 of the package-architecture cleanup. Rename the internal adapter package from ignite-store to ignite-adapters, preserve external ignite-element/xstate|redux|mobx entrypoints, add any temporary compatibility shims if needed, and align package naming/docs with the new boundary model where all state-library integrations live under a single adapters package.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.
