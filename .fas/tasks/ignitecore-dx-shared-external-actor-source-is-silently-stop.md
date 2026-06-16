# igniteCore DX: shared external actor source is silently stop

## Source
Created with `fas create-task` on 2026-06-16.

## Problem
When an already-started, externally-owned actor is passed as igniteCore source (the shared-router / multi-element pattern), the default cleanup:true stops that shared actor when ANY bound element disconnects (e.g. an outlet swapping screens, or test teardown). Subsequent reads then throw 'this.logic.getInitialSnapshot is not a function' and yield an undefined snapshot — a cryptic failure with no pointer to the cause. The SPA-router example documents cleanup:false as the fix (router.tsx/pages.tsx), but the footgun is easy to miss. IMPROVE DX (pick one+): (a) when source is an already-started external actor (consumer-owned) rather than a machine igniteCore instantiates, default cleanup:false; (b) emit a clear DEV warning when binding/reading a stopped adapter ('shared source actor was stopped — pass cleanup:false for consumer-owned sources'); (c) call it out in the igniteCore API docs + types. Surfaced downstream in the-good-way goodway app-shell — cost significant debugging.

## Mechanism (clarified 2026-06-16, traced in source)
The trigger is the *shared adapter* being torn down — not necessarily the actor:
- `source` = an already-started, consumer-owned actor → igniteCore uses `StateScope.Shared` and `XStateAdapter` is created with `ownsActor: false`.
- When the last bound element of a registration disconnects, `IgniteElementFactory.releaseSharedResources()` calls `sharedAdapter.stop()` while `cleanup` is the default `true`. (`IgniteElement.disconnectedCallback` at ~line 89 skips the per-element stop for `StateScope.Shared`; the teardown is refcounted per registered element *name* in the factory.)
- `XStateAdapter.stop()` flips `isStopped = true` but only calls `actor.stop()` when `ownsActor` is true (XStateAdapter.ts ~line 247). So for a consumer-owned started actor the **actor keeps running**; the **adapter** is what's stopped.
- In the SPA-router repro the symptom was therefore a **frozen/stale snapshot** (`getSnapshot()` returns the cached `lastKnownSnapshot`; `subscribeSnapshots()` warns + no-ops), NOT a thrown error.
- The downstream `'this.logic.getInitialSnapshot is not a function'` throw reported from goodway is likely an **adjacent path** (e.g. a fresh element calling `actor.subscribe(...)`/re-init against a torn-down actor, or test teardown that stops the actor directly), not the same frozen-read path. **Pin down the exact failure mode(s) FIRST** — fix (a)'s trigger condition and fix (b)'s warning wording depend on it.
- Compounding edge: one `igniteCore` core registered under several element names shares one adapter, but the disconnect refcount is per element name — so swapping pages drops one name's count to zero and stops the adapter the other names still use (this is what bit the SPA router).

## Acceptance criteria
- The defect no longer reproduces.
- A regression test covers the fix.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- Scope unknown.

## Scope Amendments
- None.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- None known at task creation.

## Open questions
DISCUSS BEFORE IMPLEMENTING — this is an API-behavior change; start the session with a design discussion, not code:
- Detection: how do we reliably tell "consumer-owned, already-started source" from "source igniteCore instantiates" across adapters (xstate started-actor vs machine; redux store vs slice; mobx instance vs factory; actor-web source/handle)? `ownsActor` already encodes this for xstate — generalize it?
- Fix (a) auto-defaulting `cleanup: false` for consumer-owned sources: safe as a default flip? Does it risk leaking the adapter's source subscription for genuinely-disposable shared sources? Is it a breaking behavior change relative to `3.0.0-beta.5`?
- Is `cleanup` even the right lever, or should source *ownership* be modeled explicitly (e.g. `ownsSource`/`adopt`) so an adapter never stops a source it didn't create — independent of element-lifecycle cleanup?
- Fix (b) dev warning: lives at adapter read/subscribe or at runtime bind? Exact message — gated on the verified failure mode (frozen read vs `getInitialSnapshot` throw).
- Sequencing: land before the stable v3 cut (public-API ergonomics + possible default change) or after?

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
