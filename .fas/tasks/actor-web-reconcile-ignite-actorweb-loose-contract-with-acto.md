# [actor-web] Reconcile ignite ActorWeb* loose contract with actor-web's branded ActorAddress + fix beta.7 consumer regres

## Source
Created with `fas create-task` on 2026-06-22.

## Problem
## Origin

Filed from the **actor-web** repo (cross-project; tag `[actor-web]`). actor-web is shipping a breaking
change to its public address model on branch `fas/opaque-address-string` (FAS task `task-1781964585809`,
not yet merged/published). That task is **BLOCKED on this ignite fix + a new ignite beta**. Full root-cause
evidence lives in the actor-web session memory `actor-web-address-model-decision`.

## What changed in actor-web (the breaking contract change)

`@actor-web/runtime`'s canonical address type **collapsed from an object interface to an opaque branded string**:

```ts
// BEFORE (actor-web 5765de5 / published 0.1.0):
export interface ActorAddress { id: string; kind: 'actor'; node: string; path: string }   // OBJECT

// AFTER (actor-web HEAD, commit eaa3a2c):
export type ActorAddress = string & { readonly [ACTOR_ADDRESS_BRAND]: 'ActorAddress' }      // branded STRING
```

`packages/actor-core-runtime/src/integration/actor-source.ts` was **not edited**, but its canonical source
contract carries the address by reference, so the new type propagates automatically:
`ActorReadModelSource.address: ActorAddress`, `ActorSourceSnapshot.address: ActorAddress` are now branded strings.

## Why this breaks ignite (the drift guard firing — by design)

`@ignite-element/adapters` keeps a deliberately LOOSE, hand-written projection of actor-web's source contract
so the optional `@actor-web/runtime` peer never leaks into ignite's shipped `d.ts`:

- `packages/ignite-adapters/src/adapters/ActorWebAdapter.ts:12` —
  `export type ActorWebAddress = { id: string; path: string; type?: string; node?: string }` (OBJECT), used by
  `ActorWebSourceSnapshot.address` / `ActorWebReadModelSource.address`.
- `packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts` — the compile-time drift guard
  that imports the real `@actor-web/runtime` canonical types (`ActorReadModelSource`, `ActorCommandSource`,
  `ActorSourceSnapshot`, …) and asserts they stay assignable to ignite's loose `ActorWeb*` contract.
  Its own comment: "If `@actor-web/runtime` drifts incompatibly, typecheck fails here."

A branded `string` is NOT assignable to `{ id; path; … }`. So against the new actor-web, the canonical source's
`address` field no longer satisfies ignite's `ActorWebAddress`. Downstream this means: any actor-web source fed
into an ignite component (`igniteCore`/`igniteCoreActorWeb`) fails `source`-slot assignability →
`igniteCoreActorWeb` can no longer infer `StatesResult`/`CommandsResult` → they fall back to their defaults
`Record<never,never>` / `Record<never,FacadeCommandFunction>` → every projected `states.*`/`commands.*` render
prop vanishes. In actor-web's own examples this surfaces as **141 TS errors at ignite beta.4** (6× TS2322
source-not-assignable as the root; 122× TS2339 + 3× TS2345 as the inference cascade). Proven causally: patching
ignite's installed `ActorWebAddress`→`string` drops it 141→5 (the 5 residual are example `.address.path`/`.id`
reads that actor-web will fix on its side).

## Primary fix (the actor-web-driven part)

Update ignite's loose `ActorWeb*` contract to accept the opaque branded string. The model-aligned, philosophy-
consistent choice is to treat the address as **opaque** (ignite already accepts "barebones and foreign sources"):

```ts
// ActorWebAdapter.ts — accept any string identity (a branded string IS assignable to string)
export type ActorWebAddress = string;
```

Before settling the exact shape, confirm ignite's adapter code does not read `.id`/`.path`/`.node` off the
address anywhere (grep `ActorWebAdapter.ts` + `actor-web.ts` + igniteCore actor-web). If it does, either treat
the address as opaque there or expose a `string | { id; path; … }` tolerant shape. Then update
`actor-web-canonical-compat.types.ts` so the guard reflects the new canonical address (branded string) and
passes against the new `@actor-web/runtime`.

Validation (new actor-web isn't published yet): link the local actor-web branch checkout
`/Users/joseflores/Development/actor-web` (branch `fas/opaque-address-string`) via `pnpm link` / `file:` (or point
the compat test's `@actor-web/runtime` at it) and confirm BOTH: the compat typecheck passes, AND actor-web's
example suite typechecks clean (`tsc --build`) against the new ignite build —
`examples/ignite-headless-host/{ignite-headless-host-element,provider-console,logistics-runtime-status-panel}.tsx`,
`examples/fas-agent-loop/fas-agent-loop-element.tsx`, `examples/fas-agent-loop/fas-dashboard.ts`.

## Second, INDEPENDENT issue to resolve in the same beta (ignite beta.4→beta.7 regression)

Separate from the address change, the ignite **beta.4→beta.7** bump regressed two consumer patterns. On
actor-web's PRE-change baseline (commit `5765de5`, address still an object) `tsc --build` is GREEN against ignite
beta.4 but yields **~63 TS errors against ignite beta.7**, entirely in `provider-console.tsx` (45) and
`logistics-runtime-status-panel.tsx` (18): `TS2353 'states' does not exist in ActorWebSubpathConfig<…>` on the
`igniteCore({ source, states, view, commandSource })` config + render-args projection emptiness. These consumers
pass an actor-web client/gateway source; something in the beta.4→beta.7 `igniteCoreActorWeb` subpath generics
(createComponentFactory / `StatesResult`/`CommandsResult` inference) regressed for those source shapes.
Repro: `git checkout 5765de5` in actor-web, set ignite to `3.0.0-beta.7`, `pnpm i`, `pnpm typecheck`. Investigate
and fix so beta.7+ does not regress these patterns.

## Deliverable

Cut a new ignite beta (> `3.0.0-beta.7`) containing BOTH fixes (branded-address contract + the beta.7 consumer
regression), so actor-web can bump to it and unblock `task-1781964585809`.

## Acceptance criteria
- ignite's loose ActorWeb* contract accepts actor-web's branded ActorAddress (string & brand); actor-web-canonical-compat.types.ts typechecks against the new @actor-web/runtime
- actor-web example suite (host-element/provider-console/logistics-runtime-status-panel/fas-agent-loop-element .tsx + fas-dashboard.ts) typechecks clean via tsc --build against the new ignite build, validated with pnpm link to the local actor-web fas/opaque-address-string branch
- beta.4->beta.7 consumer regression in provider-console.tsx + logistics-runtime-status-panel.tsx (TS2353 'states' + render-args emptiness) fixed; actor-web baseline 5765de5 typechecks clean against the new ignite
- a new ignite beta greater than 3.0.0-beta.7 is published so actor-web task-1781964585809 can bump to it
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
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts
- packages/ignite-adapters/src/actor-web.ts

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
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
