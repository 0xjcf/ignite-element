# Reconcile ignite-element tracker with live FAS queue state

## Goal

Make `.fas/TASKS.md` and `.fas/queue/tasks.json` agree about queued and completed work.

## Evidence

- `.fas/queue/tasks.json` lists `task-1774302663930` as queued.
- `.fas/TASKS.md` lists the same inspector follow-up under completed tasks with `Status: done`.
- `.fas/TASKS.md` can drift behind `.fas/state/current-task.json` after task closeout and task bootstrap.

## Scope

- Reconcile tracker rows against the live queue and current-task artifacts.
- Keep the live queue as the source of truth.
- Do not change product source code.

## Affected Files

- `.fas/TASKS.md`
- `.fas/tasks/reconcile-ignite-element-tracker-with-live-fas-queue-state.md`
- `.fas/queue/tasks.json`

## Acceptance Criteria

- `.fas/TASKS.md` has a current active task row for `reconcile ignite-element tracker with live FAS queue state`.
- `.fas/TASKS.md` has a queued section that mirrors live queue order and statuses for remaining queued or deferred work.
- `.fas/TASKS.md` has a completed row for `repair actor-web adapter review evidence and artifact links`.
- The inspector task is not simultaneously represented as completed and queued.
- `.fas/queue/tasks.json` remains valid JSON.

## Recommended Mode

single-agent

## Recommended Phase

closeout
