# Reconcile ignite-element tracker with live FAS queue state

## Goal

Make `.fas/TASKS.md` and `.fas/queue/tasks.json` agree about queued and completed work.

## Evidence

- `.fas/queue/tasks.json` lists `task-1774302663930` as queued.
- `.fas/TASKS.md` lists the same inspector follow-up under completed tasks with `Status: done`.
- `.fas/TASKS.md` also says there are no active tasks while `.fas/state/current-task.json` is in `review`.

## Scope

- Reconcile tracker rows against the live queue and current-task artifacts.
- Keep the live queue as the source of truth.
- Do not change product source code.

## Acceptance Criteria

- `.fas/TASKS.md` has a current active task row for `Ignite Element Actor-Web first-class adapter`.
- `.fas/TASKS.md` has a queued section that includes the inspector task and audit follow-ups in queue order.
- The inspector task is not simultaneously represented as completed and queued.
- `.fas/queue/tasks.json` remains valid JSON.

## Recommended Mode

single-agent

## Recommended Phase

closeout
