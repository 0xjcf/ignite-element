# Ignite Alchemy MagicPath Provenance

Status: Round 3 candidate publication recorded; browser validation and human
selection pending
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`
MagicPath project: Ignite Alchemy (`430393512920518656`)

## Authoring constraints

- MagicPath artifacts remain external prototype directions only.
- Generated React output stays outside repository production source and does
  not establish package, runtime, or public API commitments.
- `ROUND-2` is preserved as rejected provenance only.
- `ROUND-3A` and `ROUND-3B` were authored from the corrected narrative gate and
  published as candidates, not accepted UI.

## Command receipts

| Stage | Command family | Result |
| --- | --- | --- |
| auth check | `magicpath-ai info -o json` | authenticated project access confirmed |
| Round 3 bootstrap A | `magicpath-ai code start --project 430393512920518656 --dir /private/tmp/ignite-alchemy-canvas-runner.round3a --name "Ignite Alchemy Canvas Runner" --width 1440 --height 900 -o json` | created new component `430498394188955648` / `keenly-wood-5115` |
| Round 3 bootstrap B | `magicpath-ai code start --project 430393512920518656 --dir /private/tmp/ignite-alchemy-focus-runner.round3b --name "Ignite Alchemy Focus Runner" --width 1280 --height 900 -o json` | created new component `430498394214125568` / `vibrantly-second-1236` |
| Round 3 first submit attempt | `magicpath-ai code submit --dir <round3 workdir> --wait -o json` | rejected because `src/index.css` must preserve Tailwind v4 `@import 'tailwindcss';` setup |
| Round 3 corrected publish A | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-canvas-runner.round3a --wait -o json` | completed for component `430498394188955648`, revision `430498394188955649`, `requiresClientResync: true` |
| Round 3 corrected publish B | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-focus-runner.round3b --wait -o json` | completed for component `430498394214125568`, revision `430498394214125569`, `requiresClientResync: true` |
| metadata recovery | `magicpath-ai share <componentId> -o json`, `magicpath-ai list-components 430393512920518656 -o json` | recovered share URLs, generated names, and preview image URLs for both candidates |

## Artifact register

| Artifact | Component name | Generated name | Component ID | Revision ID | Disposition |
| --- | --- | --- | --- | --- | --- |
| `DIR-A` | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | rejected by human feedback as over-engineered |
| `DIR-B` | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | rejected by human feedback as over-engineered |
| `ROUND-2` | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430443925757644800` | rejected by human feedback for kitchen-sink density |
| `ROUND-3A` | Ignite Alchemy Canvas Runner | `keenly-wood-5115` | `430498394188955648` | `430498394188955649` | published candidate awaiting root browser validation and human selection |
| `ROUND-3B` | Ignite Alchemy Focus Runner | `vibrantly-second-1236` | `430498394214125568` | `430498394214125569` | published candidate awaiting root browser validation and human selection |

## Public URLs

| Artifact | URL set | Preview image |
| --- | --- | --- |
| `ROUND-2` | component `https://www.magicpath.ai/files/430424171277877248` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/e9269a1b-0500-47fb-91e0-7c2711a4499f.png` |
| `ROUND-3A` | component `https://www.magicpath.ai/files/430498394188955648` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/0be9d315-0a35-4ad9-ac41-edd4133efe68.png` |
| `ROUND-3B` | component `https://www.magicpath.ai/files/430498394214125568` | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/373803bc-d083-47b9-aee8-0eb9b5bd1a6c.png` |

## Local authoring locations

| Artifact | External workdir | Authored files |
| --- | --- | --- |
| `ROUND-3A` | `/private/tmp/ignite-alchemy-canvas-runner.round3a` | `src/components/generated/IgniteAlchemyCanvasRunner.tsx`, `src/index.css` |
| `ROUND-3B` | `/private/tmp/ignite-alchemy-focus-runner.round3b` | `src/components/generated/IgniteAlchemyFocusRunner.tsx`, `src/index.css` |

## Submit caveat

Both successful Round 3 submit results reported `requiresClientResync: true`.
Any future MagicPath edits should start from a resynced client state rather
than from the now-stale local workdirs.
