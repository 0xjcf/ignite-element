# v3 stable release roadmap

## Status

Active plan (2026-06-18). The agreed order of work from current beta
(`3.0.0-beta.6`) to the stable `3.0.0` cut. Dependencies are wired in the FAS
queue so the critical path is enforced; phase order for non-gating work is
guidance.

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

## Phase 1 — Gap-finder + additive API (parallel, pre-cut)

Low-risk, independent, non-breaking. Run the gap-finder early so its findings can
still shape the API before the breaking cutover freezes it.

| Task | id | Note |
| --- | --- | --- |
| Framework-interop demos (React/Vue/Svelte/Angular) | `1781805261094` | **gap-finder** — run early; may spawn follow-up API tasks |
| `select().whenChanged()` | `1781798483059` | additive |
| `expectView` | `1781798484574` | additive (does **not** rename expectState) |
| `canExecute(name)` | `1781798486122` | additive (gap) |
| Test host seam (fluent `.host()`) | `1781619012619` | additive |
| `igniteShell` + shared move-safe teardown | `1781817947799` | additive primitive |
| Effects object-form / deprecate positional | `1781818975642` | additive → deprecate |

Suggested intra-phase order: gap-finder + `whenChanged` → `expectView` →
`canExecute` → host-seam → `igniteShell` → effects-object-form.

## Phase 2 — Breaking cutover (one coordinated landing, pre-cut)

The hard gate. Land **together** in the **same beta**, with **one** goodway
migration note. Decisions are locked (see `docs/v3-api-consistency.md`).

| Task | id | Doc |
| --- | --- | --- |
| Flat tagged event `{ type, … }` | `1781818971210` | `docs/event-shape.md` |
| Uniform view/effects context `{ snapshot }` | `1781818972687` | `docs/view-context-canonicalization.md` |
| `expectState` → `expectSnapshot` (alias) + `expectEvent` member form | `1781818974159` | `docs/v3-api-consistency.md` |

These three are wired to **block the main-merge**. Do them after Phase 1 settles
so the cutover absorbs any interop-surfaced gaps. Coordinate with the cross-repo
goodway `getInitialSnapshot` spike (in `../the-good-way-bluejf`) for the single
migration note.

## Phase 3 — Launch polish (pre-stable; recommended, not hard gates)

| Task | id | Note |
| --- | --- | --- |
| Docs accuracy / UX / positioning (beta.6 P0) | `1781724711926` | must be right before stable docs ship |
| Worked apps (form / nested router / dashboard) | `1781805264107` | credibility proof points |
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
