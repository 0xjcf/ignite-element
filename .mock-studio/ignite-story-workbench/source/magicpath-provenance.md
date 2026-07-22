# Ignite Alchemy MagicPath Provenance

Status: corrected Round 3 candidate publication recorded; browser validation
and human selection pending
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`
MagicPath project: Ignite Alchemy (`430393512920518656`)

## Authoring constraints

- MagicPath artifacts remain external prototype directions only.
- Generated React output stays outside repository production source and does
  not establish package, runtime, or public API commitments.
- `ROUND-2` is preserved as rejected provenance only.
- `ROUND-3A` and `ROUND-3B` remain candidate-only UI directions.
- the first published Round 3 revisions were rejected by internal root preview
  inspection before browser acceptance and replaced by corrected revisions.
- human feedback in this turn preferred Focus Runner Variant 2
  `dreamily-sand-6842` as the leading donor/candidate direction.

## Command receipts

| Stage | Command family | Result |
| --- | --- | --- |
| auth check | `magicpath-ai info -o json` | authenticated project access confirmed |
| Round 3 bootstrap A | `magicpath-ai code start --project 430393512920518656 --dir /private/tmp/ignite-alchemy-canvas-runner.round3a --name "Ignite Alchemy Canvas Runner" --width 1440 --height 900 -o json` | created new component `430498394188955648` / `keenly-wood-5115` |
| Round 3 bootstrap B | `magicpath-ai code start --project 430393512920518656 --dir /private/tmp/ignite-alchemy-focus-runner.round3b --name "Ignite Alchemy Focus Runner" --width 1280 --height 900 -o json` | created new component `430498394214125568` / `vibrantly-second-1236` |
| Round 3 first submit attempt | `magicpath-ai code submit --dir <round3 workdir> --wait -o json` | rejected because `src/index.css` must preserve Tailwind v4 `@import 'tailwindcss';` setup |
| Round 3 first publish A | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-canvas-runner.round3a --wait -o json` | completed for component `430498394188955648`, revision `430498394188955649`, `requiresClientResync: true` |
| Round 3 first publish B | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-focus-runner.round3b --wait -o json` | completed for component `430498394214125568`, revision `430498394214125569`, `requiresClientResync: true` |
| Round 3 resync A | `magicpath-ai code start --component 430498394188955648 --dir /private/tmp/ignite-alchemy-canvas-runner.round3a.r2 -o json` | fresh edit session opened at pending revision `430502451452473344` after `requiresClientResync` |
| Round 3 resync B | `magicpath-ai code start --component 430498394214125568 --dir /private/tmp/ignite-alchemy-focus-runner.round3b.r2 -o json` | fresh edit session opened at pending revision `430502451368595456` after `requiresClientResync` |
| internal preview correction publish A | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-canvas-runner.round3a.r2 --wait -o json` | completed for corrected revision `430502451452473344`, `requiresClientResync: true` |
| internal preview correction publish B | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-focus-runner.round3b.r2 --wait -o json` | completed for corrected revision `430502451368595456`, `requiresClientResync: true` |
| metadata recovery | `magicpath-ai share <componentId> -o json`, `magicpath-ai list-components 430393512920518656 -o json` | recovered share URLs, revision counts, and latest preview image URLs |
| human preference relay | root preview inspection + user feedback | `dreamily-sand-6842` / Focus Runner (Variant 2) identified as the preferred leading donor/candidate without browser acceptance |

## Artifact register

| Artifact | Component name | Generated name | Component ID | Revision ID | Disposition |
| --- | --- | --- | --- | --- | --- |
| `DIR-A` | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | rejected by human feedback as over-engineered |
| `DIR-B` | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | rejected by human feedback as over-engineered |
| `ROUND-2` | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430443925757644800` | rejected by human feedback for kitchen-sink density |
| `ROUND-3A` first revision | Ignite Alchemy Canvas Runner | `keenly-wood-5115` | `430498394188955648` | `430498394188955649` | rejected by internal root preview inspection before browser validation |
| `ROUND-3B` first revision | Ignite Alchemy Focus Runner | `vibrantly-second-1236` | `430498394214125568` | `430498394214125569` | rejected by internal root preview inspection before browser validation |
| `ROUND-3A` corrected revision | Ignite Alchemy Canvas Runner | `keenly-wood-5115` | `430498394188955648` | `430502451452473344` | corrected candidate awaiting root browser validation and human selection |
| `ROUND-3B` corrected revision | Ignite Alchemy Focus Runner | `vibrantly-second-1236` | `430498394214125568` | `430502451368595456` | corrected candidate awaiting root browser validation and human selection |
| `ROUND-3B-VAR2` preferred donor | Ignite Alchemy Focus Runner (Variant 2) | `dreamily-sand-6842` | `430503922197753859` | unknown in this turn | human-preferred leading donor/candidate; browser validation and final approval still pending |

## Public URLs

| Artifact | URL set | Preview image |
| --- | --- | --- |
| `ROUND-2` | component `https://www.magicpath.ai/files/430424171277877248` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/e9269a1b-0500-47fb-91e0-7c2711a4499f.png` |
| `ROUND-3A` corrected revision | component `https://www.magicpath.ai/files/430498394188955648` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/3aceb67e-c1c8-4f0d-b712-5950c570b7f5.png` |
| `ROUND-3B` corrected revision | component `https://www.magicpath.ai/files/430498394214125568` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/9d765441-69b9-4488-a027-cbd2ce85aa56.png` |
| `ROUND-3B-VAR2` preferred donor | design `https://designs.magicpath.ai/v1/dreamily-sand-6842` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/8d6e63c6-c00c-47ea-ae32-5c08ca1cd0f9.png` |

## Local authoring locations

| Artifact | External workdir | Authored files |
| --- | --- | --- |
| `ROUND-3A` first revision | `/private/tmp/ignite-alchemy-canvas-runner.round3a` | `src/components/generated/IgniteAlchemyCanvasRunner.tsx`, `src/index.css` |
| `ROUND-3B` first revision | `/private/tmp/ignite-alchemy-focus-runner.round3b` | `src/components/generated/IgniteAlchemyFocusRunner.tsx`, `src/index.css` |
| `ROUND-3A` corrected revision | `/private/tmp/ignite-alchemy-canvas-runner.round3a.r2` | `src/components/generated/IgniteAlchemyCanvasRunner.tsx`, `src/index.css` |
| `ROUND-3B` corrected revision | `/private/tmp/ignite-alchemy-focus-runner.round3b.r2` | `src/components/generated/IgniteAlchemyFocusRunner.tsx`, `src/index.css` |

## Submit caveat

Both successful first-pass Round 3 submits and both successful corrected Round
3 submits reported `requiresClientResync: true`. Any future MagicPath edits
should start from a resynced client state rather than from the now-stale local
workdirs.
