# collapse duplicate projection and component factory assembly into one shared path

## Source
Created with `fas create-task` on 2026-03-23.

## Problem
Phase 3 of the package-architecture cleanup. Remove the parallel facade/projection assembly logic split between packages/ignite-core/src/createProjectionFactory.ts and packages/ignite-element/src/createComponentFactory.ts. Make ignite-element consume a single shared assembly path from core so adapter/runtime behavior changes cannot drift across duplicate factories.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.
