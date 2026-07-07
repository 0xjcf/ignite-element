# v3 stable release roadmap

## Status

Active plan (updated 2026-07-07). The agreed order of work from current beta
(`3.0.0-beta.7`) to the stable `3.0.0` cut. Dependencies are wired in the FAS
queue so the critical path is enforced. As of 2026-07-02, the queue also tracks
the remaining roadmap work through first-class FAS epics so the full completion
policy is explicit, not just prose guidance. As of 2026-07-05, the agent/local
model ecosystem story is also enforced before launch polish and the breaking
cutover. **Phase 0 (framework-interop examples) is pulled ahead of the additive
API as gap-finders** (owner, 2026-06-19). Owner update, 2026-07-07: the next
FAS batch is the breaking API cutover, with docs polish as the final sweep before
main merge.

## North star + the enforced spine

The stable cut runs **last, from `main`**, after the v3 line is merged. Its
prerequisites (adapter-contract-naming, tracker-hygiene, T7 deprecated-surface
removal) are already done, so the only hard gates left are:

```
breaking cutover (3 tasks) ──blocks──▶ docs final sweep (1781724711926) ──blocks──▶ main-merge (1781292613064) ──blocks──▶ cut stable 3.0.0 (1781197578529)
```

Breaking changes must land before `3.0.0` (you cannot break after 1.0). The docs
final sweep is also a release gate now because it must describe the final
post-cutover API before the v3 line merges to `main`. Other additive work and
polish remain *wanted* for the broader roadmap but can ship as `3.x` follow-ups
unless the owner explicitly pulls them back into the release gate.

## Enforced roadmap epics

The queue preserves both the epic grouping and the execution chain:

1. `epic-ignite-ecosystem-bridge` — Phase C terminal-to-browser bridge, runtime
   host split, igniteTools follow-ups, and actor-web cleanup.
2. `epic-v3-additive-api-and-examples` — worked examples, test host seam,
   `igniteShell`, effects object-form, and example README cleanup.
3. `epic-v3-agent-local-model-showcase` — OpenAI-compatible tool dialect,
   local MLX smart-home loop, actor-web-backed real-agent dogfood, and local
   model boundary docs.
4. `epic-v3-breaking-release-cutover` — breaking trio, docs final sweep, main
   merge, and stable `3.0.0` cut.
5. `epic-v3-launch-polish` — parked side-chain for bundle-size numbers,
   Renovate, GTM spike, and Angular interop.

The enforced order is:

```text
igniteTools Phase C
  -> runtime host split
  -> igniteTools PR2 follow-ups
  -> actor-web address cleanup
  -> actor-web warning cleanup
  -> worked apps
  -> testing host seam
  -> igniteShell
  -> effects object-form
  -> example README snapshot cleanup
  -> OpenAI-compatible ToolDialect
  -> local MLX smart-home agent loop
  -> actor-web-backed real-agent dogfood
  -> local-model agent docs / ecosystem boundaries
  -> breaking event shape
  -> breaking view/effects context
  -> breaking snapshot rename
  -> docs accuracy / UX / positioning
  -> main merge
  -> stable 3.0.0 cut
```

Parked launch-polish side-chain after the docs sweep:

```text
bundle-size numbers -> Renovate -> GTM spike -> Angular interop
```

## Phase 0 — Framework-interop examples (gap-finders, run first)

Pulled ahead of the additive API (owner, 2026-06-19): the examples back the
multi-framework doc claims **and** surface API gaps before the cutover freezes the
surface — exactly how the React demo found `IgniteReactRef` + lit auto-detect.
React, Vue, and Svelte demos now exist under `examples/frameworks/`. Each demo
consumes a small ignite element via that framework's **standard** custom-element
path and documents the friction honestly; **no** per-framework `ignite*` helpers
(those stay follow-ups — the demos tell us if friction earns one). All
single-agent. The **Angular demo was previously backlogged** (owner hold-off
2026-06-20): its claims were removed from the beta docs so nothing over-claims.
Owner update, 2026-07-02: Angular is back in the enforced pre-stable chain after
launch-polish work and before the breaking cutover. Owner update, 2026-07-07:
Angular is re-parked in the launch-polish side-chain so the breaking API cutover
can land before stable.

| Task | id | Status |
| --- | --- | --- |
| Vue demo (`compilerOptions.isCustomElement`) | `1781919276233` | ✅ done |
| Svelte demo (`<ignite-stepper>`, redux, zero config) | `1781919336709` | ✅ done |
| Worked app: form-with-validation (XState + ignite-JSX) | `1781962208694` | ✅ done |
| Worked apps: nested router + dashboard-with-shared-state | `1781805264107` | ▶ next (form split out + done) |
| Angular demo (`CUSTOM_ELEMENTS_SCHEMA`) | `1781919547313` | parked launch-polish side-chain |

Order: **Vue ✓ → Svelte ✓ → worked-apps → Phase 1 → agent/local-model showcase → breaking cutover → docs final sweep.**

## Phase 1 — Gap-finder + additive API (parallel, pre-cut)

Mostly low-risk and independent, with beta-only breaks allowed before v3 stable.
Run the gap-finder early so its findings can still shape the API before the
breaking cutover freezes it.

| Task | id | Note |
| --- | --- | --- |
| `ignite-element/react` helper + React demo (+ registration handle) | `1781805261094` | **DONE** (beta.7) — the gap-finder that surfaced `IgniteReactRef` + config-free lit auto-detect; `docs/ignite-react.md`. Remaining framework demos are Phase 0 |
| `select().whenChanged()` | `1781798483059` | additive |
| `expectView` | `1781798484574` | additive (does **not** rename expectSnapshot) |
| `canExecute(name)` | `1781798486122` | ✅ done |
| Test host seam (fluent `.host()`) | `1781619012619` | additive |
| `igniteShell` + shared move-safe teardown | `1781817947799` | additive primitive |
| Effects object-form / remove positional | `1781818975642` | **DONE** (beta breaking) — object-form is the only v3 beta effects callback shape |

Suggested intra-phase order for remaining work: `whenChanged` → `expectView` →
host-seam → `igniteShell`.

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
- **`canExecute`** (`1781798486122`) — dynamic tool availability (hide a tool when its command can't run for the current snapshot) now ships as per-command `canExecute({ snapshot })` metadata plus the headless `canExecute(name)` query.
- **Dogfood (actor-web)** — point a real agent at an actor-web component via `igniteTools`; proves the closed loop (flat events = native actor messages, transport-aware view). Brief `.fas/tasks/example-dogfood-prove-the-agent-runtime-*`.
- **Showcase app** — headless agent runtime on a non-web projection (console/embedded) driving a **remote** actor-web actor (location transparency) with canExecute-gated tools. Brief `.fas/tasks/example-app-showcase-headless-*`.

## Agent/local-model showcase (enforced before launch polish) — added 2026-07-05

The v3 target now includes the local-model agent story, not just hosted Claude
validation. This stays within Ignite's boundary: Ignite owns the headless runtime,
schema/tool bridge, examples, and docs; fas-local owns durable MLX provider
lifecycle; actor-web owns execution/data-plane hosting and topology. The local
Ignite example can call a running OpenAI-compatible MLX server directly, while
CI remains deterministic through fake provider responses.

Completion standard for this epic:

- Ignite has one SDK-free OpenAI-compatible dialect for Codex and hosted OpenAI
  surfaces, Ollama, and local MLX-style `/v1/chat/completions` servers.
- The smart-home example documents both deterministic CI coverage and opt-in
  live local-model validation.
- `SMART_HOME_RUNTIME=actor-web` proves actor-web-backed projection and command
  execution through `igniteTools`, while the local WebSocket browser bridge stays
  documented as an example shell, not the final actor-web gateway/client path.
- Durable MLX provider lifecycle remains a fas-local concern; distributed
  runtime hosting remains an actor-web concern.

| Task | id | Note |
| --- | --- | --- |
| OpenAI-compatible `ToolDialect` (`ignite-element/tools/openai`) | `1783285994418` | Covers OpenAI, Ollama, and MLX-style `/v1/chat/completions` tool calls without provider SDK deps |
| Smart-home local MLX loop + demo mode | `1783286005193` | Adds `npm run mlx` style local validation, with fake-response tests and self-contained setup docs |
| Actor-web-backed real-agent dogfood | `1783286017890` | Proves a real agent loop driving an actor-web-backed Ignite component through `igniteTools` |
| Local-model docs and ecosystem boundary closeout | `1783286029030` | Blocks launch-polish docs so the stable docs include the agent/local-model story |

## Phase 2 — Breaking cutover + docs final sweep (one coordinated landing, pre-cut)

The hard gate. Land the three breaking API changes **together** in the **same
beta**, then run the docs polish as the final sweep in the same FAS batch.
Use **one** goodway migration note. Decisions are locked (see
`docs/v3-api-consistency.md`).

| Task | id | Doc |
| --- | --- | --- |
| Flat tagged event `{ type, … }` | `1781818971210` | `docs/event-shape.md` |
| Uniform view/effects context `{ snapshot }` | `1781818972687` | `docs/view-context-canonicalization.md` |
| Full `state`→`snapshot` rename (`expectSnapshot`→`expectSnapshot` + `result.snapshot`/`schema.snapshot`/record-trace) + `expectEvent` member form | `1781818974159` | `docs/v3-api-consistency.md` |
| Docs accuracy / UX / positioning final sweep | `1781724711926` | stable docs must describe the final post-cutover API |

The breaking trio feeds the docs final sweep, and the docs sweep blocks the
main-merge. Coordinate with the cross-repo goodway `getInitialSnapshot` spike
(in `../the-good-way-bluejf`) for the single migration note.

## Phase 3 — Launch polish side-chain (parked unless pulled forward)

| Task | id | Note |
| --- | --- | --- |
| Docs accuracy / UX / positioning (beta.6 P0) | `1781724711926` | **moved to Phase 2 final sweep** |
| Worked apps (form / nested router / dashboard) | `1781805264107` | **moved to Phase 0** — gap-finder, now wired into the enforced chain |
| Bundle-size numbers | `1781805262589` | credibility; sequenced after docs accuracy, not a release gate |
| Renovate (dependency currency) | `1781743752184` | infra hygiene, now sequenced before GTM |
| GTM spike (CLI / embeds / video / one-pager) | `1781724738855` | read-only; produces follow-ups before Angular |
| Angular interop demo (`CUSTOM_ELEMENTS_SCHEMA`) | `1781919547313` | parked after GTM as a launch-polish follow-up |

## Phase 4 — The cut (last)

| Task | id | Gate |
| --- | --- | --- |
| Merge v3 line → `main`, retire branch-dispatch docs deploys | `1781292613064` | deferred behind the breaking trio plus docs final sweep |
| Cut stable `3.0.0` (changeset pre-exit + lockstep publish) | `1781197578529` | deferred behind main-merge |

## Release mechanics

Betas keep cutting incrementally as Phase 1–3 land (changesets accumulate —
e.g. `xstate-command-actor-getsnapshot`, the pending `igniteShell` one). The
breaking trio plus docs final sweep ship as one beta. Stable `3.0.0` is the
final lockstep publish from `main` (see the `release-beta` skill +
`v3-beta-release-flow` memory).

## Done this session (context)

Examples restructure (adapters/apps/frameworks) · spa-router idiom cleanup ·
`XStateCommandActor.getSnapshot()` (removed invented `.state`) · `igniteShell`
design. See `docs/v3-api-consistency.md`, `docs/ignite-shell.md`.

## Related

- `docs/v3-api-consistency.md` (decisions + sub-decision index)
- Memory: `v3-api-consistency-epic`, `v3-examples-track`,
  `expose-source-native-api`, `v3-beta-release-flow`
