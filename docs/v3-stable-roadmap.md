# v3 stable release roadmap

## Status

Active plan (updated 2026-06-19). The agreed order of work from current beta
(`3.0.0-beta.7`) to the stable `3.0.0` cut. Dependencies are wired in the FAS
queue so the critical path is enforced; phase order for non-gating work is
guidance. **Phase 0 (framework-interop examples) is pulled ahead of the additive
API as gap-finders** (owner, 2026-06-19).

## North star + the enforced spine

The stable cut runs **last, from `main`**, after the v3 line is merged. Its
prerequisites (adapter-contract-naming, tracker-hygiene, T7 deprecated-surface
removal) are already done, so the only hard gates left are:

```
breaking cutover (3 tasks) ──blocks──▶ main-merge (1781292613064) ──blocks──▶ cut stable 3.0.0 (1781197578529)
```

**Only breaking changes are hard gates.** Breaking changes must land before
`3.0.0` (you cannot break after 1.0). Additive work and polish are *wanted* in
the stable release but are **not** hard blockers — anything additive can ship as
a `3.x` minor afterward. So the queue wires only the breaking trio → main-merge →
cut; additive/polish are sequenced by priority + this doc.

## Phase 0 — Framework-interop examples (gap-finders, run first)

Pulled ahead of the additive API (owner, 2026-06-19): the examples back the
multi-framework doc claims **and** surface API gaps before the cutover freezes the
surface — exactly how the React demo found `IgniteReactRef` + lit auto-detect.
React, Vue, and Svelte demos now exist under `examples/frameworks/`. Each demo
consumes a small ignite element via that framework's **standard** custom-element
path and documents the friction honestly; **no** per-framework `ignite*` helpers
(those stay follow-ups — the demos tell us if friction earns one). All
single-agent. The **Angular demo is backlogged** (owner hold-off 2026-06-20):
held off for now, and its claims were removed from the beta docs so nothing
over-claims. With Angular off the chain, the next example work is worked-apps.

| Task | id | Status |
| --- | --- | --- |
| Vue demo (`compilerOptions.isCustomElement`) | `1781919276233` | ✅ done |
| Svelte demo (`<ignite-stepper>`, redux, zero config) | `1781919336709` | ✅ done |
| Worked app: form-with-validation (XState + ignite-JSX) | `1781962208694` | ✅ done |
| Worked apps: nested router + dashboard-with-shared-state | `1781805264107` | ▶ next (form split out + done) |
| Angular demo (`CUSTOM_ELEMENTS_SCHEMA`) | `1781919547313` | ⏸ backlog (owner hold-off 2026-06-20) |

Order: **Vue ✓ → Svelte ✓ → worked-apps → Phase 1.** (Angular demo → backlog.)

## Phase 1 — Gap-finder + additive API (parallel, pre-cut)

Low-risk, independent, non-breaking. Run the gap-finder early so its findings can
still shape the API before the breaking cutover freezes it.

| Task | id | Note |
| --- | --- | --- |
| `ignite-element/react` helper + React demo (+ registration handle) | `1781805261094` | **DONE** (beta.7) — the gap-finder that surfaced `IgniteReactRef` + config-free lit auto-detect; `docs/ignite-react.md`. Remaining framework demos are Phase 0 |
| `select().whenChanged()` | `1781798483059` | additive |
| `expectView` | `1781798484574` | additive (does **not** rename expectState) |
| `canExecute(name)` | `1781798486122` | additive (gap) |
| Test host seam (fluent `.host()`) | `1781619012619` | additive |
| `igniteShell` + shared move-safe teardown | `1781817947799` | additive primitive |
| Effects object-form / deprecate positional | `1781818975642` | additive → deprecate |

Suggested intra-phase order: gap-finder + `whenChanged` → `expectView` →
`canExecute` → host-seam → `igniteShell` → effects-object-form.

## Agent-runtime thread (additive, getSchema-driven) — added 2026-06-21

A coherent build-up that makes ignite components fully **agent-drivable** through one
self-describing contract (`getSchema` + headless `execute`). Additive, so it ships
across `3.x` minors and does **not** gate stable — but it's where the "dev DX **and**
agent/LLM-drivability" differentiator gets proven. The spine:

```
typed-view (1781971975611) ─▶ getSchema().view ─▶ igniteTools(component)
                                                        │
                          canExecute (1781798486122) ───┘  (dynamic tool gating)
                                                        ▼
        dogfood example (actor-web) ─▶ showcase app (remote actor + headless console)
```

- **typed-view** (`1781971975611`) — types `getView()` end-to-end; prereq for a typed schema view + typed tools.
- **`getSchema().view`** — the missing read-model facet; agents see the projection they bind to. Brief `.fas/tasks/additive-expose-the-typed-view-projection-in-getschema-as-ig.md`.
- **`igniteTools(component)`** — LLM tool manifest from `getSchema().commands`, `tool_use` → `execute`, events + view as observations. Agent analog of `igniteReact`; SDK-neutral core. Brief `.fas/tasks/additive-agent-api-add-ignitetools-*`.
- **`canExecute`** (`1781798486122`) — now justified by the agent story: dynamic tool availability (hide a tool when its command can't run for the current snapshot). Unblock the design (per-command `available(snapshot)` predicate, off-schema) before the showcase app.
- **Dogfood (actor-web)** — point a real agent at an actor-web component via `igniteTools`; proves the closed loop (flat events = native actor messages, transport-aware view). Brief `.fas/tasks/example-dogfood-prove-the-agent-runtime-*`.
- **Showcase app** — headless agent runtime on a non-web projection (console/embedded) driving a **remote** actor-web actor (location transparency) with canExecute-gated tools. Brief `.fas/tasks/example-app-showcase-headless-*`.

## Phase 2 — Breaking cutover (one coordinated landing, pre-cut)

The hard gate. Land **together** in the **same beta**, with **one** goodway
migration note. Decisions are locked (see `docs/v3-api-consistency.md`).

| Task | id | Doc |
| --- | --- | --- |
| Flat tagged event `{ type, … }` | `1781818971210` | `docs/event-shape.md` |
| Uniform view/effects context `{ snapshot }` | `1781818972687` | `docs/view-context-canonicalization.md` |
| Full `state`→`snapshot` rename (`expectState`→`expectSnapshot` + `result.state`/`schema.state`/record-trace) + `expectEvent` member form | `1781818974159` | `docs/v3-api-consistency.md` |

These three are wired to **block the main-merge**. Do them after Phase 1 settles
so the cutover absorbs any interop-surfaced gaps. Coordinate with the cross-repo
goodway `getInitialSnapshot` spike (in `../the-good-way-bluejf`) for the single
migration note.

## Phase 3 — Launch polish (pre-stable; recommended, not hard gates)

| Task | id | Note |
| --- | --- | --- |
| Docs accuracy / UX / positioning (beta.6 P0) | `1781724711926` | must be right before stable docs ship |
| Worked apps (form / nested router / dashboard) | `1781805264107` | **moved to Phase 0** — gap-finder, wired after the framework demos |
| Bundle-size numbers | `1781805262589` | credibility |
| Renovate (dependency currency) | `1781743752184` | infra hygiene; parallel, anytime |
| GTM spike (CLI / embeds / video / one-pager) | `1781724738855` | read-only; produces follow-ups; not gating |

## Phase 4 — The cut (last)

| Task | id | Gate |
| --- | --- | --- |
| Merge v3 line → `main`, retire branch-dispatch docs deploys | `1781292613064` | deferred behind the breaking trio |
| Cut stable `3.0.0` (changeset pre-exit + lockstep publish) | `1781197578529` | deferred behind main-merge |

## Release mechanics

Betas keep cutting incrementally as Phase 1–3 land (changesets accumulate —
e.g. `xstate-command-actor-getsnapshot`, the pending `igniteShell` one). The
breaking trio ships as one beta. Stable `3.0.0` is the final lockstep publish from
`main` (see the `release-beta` skill + `v3-beta-release-flow` memory).

## Done this session (context)

Examples restructure (adapters/apps/frameworks) · spa-router idiom cleanup ·
`XStateCommandActor.getSnapshot()` (removed invented `.state`) · `igniteShell`
design. See `docs/v3-api-consistency.md`, `docs/ignite-shell.md`.

## Related

- `docs/v3-api-consistency.md` (decisions + sub-decision index)
- Memory: `v3-api-consistency-epic`, `v3-examples-track`,
  `expose-source-native-api`, `v3-beta-release-flow`
