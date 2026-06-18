# Design index: v3 API vocabulary & shape consistency

## Status

Active tracking doc (pre-stable v3). Indexes the sub-decisions for a coherent
vocabulary + shape pass across the public surface.

## Why

ignite's differentiators are dev DX **and** agent/LLM-drivability (`getSchema`,
headless `execute`). Both depend on **one** canonical vocabulary and shape repeated
across the three surfaces a consumer or agent touches:

- **author** — `igniteCore` callbacks (`view` / `commands` / `effects` / `events`)
- **observe** — runtime: `getSnapshot` / `getView` / `on` / `execute().events` / `record` / `getSchema`
- **assert** — the test DSL (`given` / `when` / `expect*`)

Those surfaces have drifted. This pass realigns them while we are pre-stable and can
still make breaking changes cheaply.

## Principle

Same concept → same word → same shape, on author / observe / assert. Prefer the
actor-model / XState-v5 canonical where one exists. Keep adapter-native escape
hatches (no state-lib lock-in), but make the *ignite* surface uniform.

## Sub-decisions

| Decision | Doc | Kind | Status |
| --- | --- | --- | --- |
| `select().whenChanged()` + structural-equality default + `shallowEqual` | `effects-change-detection.md` | additive | design ✓, task queued |
| Flat tagged event `{ type, … }` (emit / observe / `expectEvent`) | `event-shape.md` | **breaking** | design ✓, task queued (1781818971210) |
| Uniform view/effects context = `{ snapshot }` (drop the spread) | `view-context-canonicalization.md` | **breaking** | design ✓, task queued (1781818972687) |
| Effects single (object) signature; deprecate positional | this doc | additive→deprecate | task queued (1781818975642) |
| `expectView` (add) + `expectState`→`expectSnapshot` (alias) + `expectEvent` object form | `event-shape.md` + this doc | mixed | `expectView` queued; rename task queued (1781818974159) |
| Test host seam: fluent `.host({ dataset, attributes })` | `task-1781619012619` | additive | task (refine brief to fluent shape) |
| `canExecute(name)` command-availability query | this doc | additive (gap) | task queued |
| `igniteShell` sourceless composition root (+ shared move-safe teardown) | `ignite-shell.md` | additive (gap) | design ✓ |

## Intentional — document, do not "fix"

- **Command `actor` is adapter-native** (`send` / `dispatch` / store methods /
  `commandSource.send`). Deliberate — "use your state lib natively." The only lever
  is an *optional* unified `send(event)` helper layered on top (previously deferred
  spike). OPEN product decision.
- **actor-web `commandSource`** read/write split — only actor-web has it; correct for
  the model. Doc note only.

## Sequencing

- **Additive** (`whenChanged`, `expectView`, host seam, `canExecute`,
  effects-object-form): ship independently, anytime.
- **Breaking** (event shape, view-context `{ snapshot }`, `expectState`→
  `expectSnapshot`): land **together** in one pre-stable cutover, one coordinated
  changeset, one goodway migration note. Tracked here so they cut over once.

## Decisions (resolved 2026-06-18)

1. **Command-actor: leave adapter-native.** Resolved — `getSnapshot()` shipped on
   the XState command actor (the one invented accessor, `.state`, was removed); an
   optional unified `send()` remains a separate deferred spike, not a stable
   blocker. See `expose-source-native-api`.
2. **view-context: `{ snapshot }`-only** (no convenience alias). Tasked:
   `1781818972687`.
3. **`expectState` → `expectSnapshot`: rename with deprecated alias.** Tasked:
   `1781818974159`.

The breaking trio (event shape / view-context / rename) is wired to **block the
main-merge**, which blocks the stable cut — see `docs/v3-stable-roadmap.md`.

## Related

- `docs/v3-stable-roadmap.md` — the phased plan + dependency spine to stable.
- `docs/effects-change-detection.md`, `docs/event-shape.md`,
  `docs/view-context-canonicalization.md`, `docs/ignite-shell.md`
- Memory: `v3-api-consistency-epic`, `ignite-monorepo-dual-state-lib-skew`,
  `expose-source-native-api`
