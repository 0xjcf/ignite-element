# Ignite Alchemy MagicPath Provenance

Status: recorded
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
MagicPath project: Ignite Alchemy (`430393512920518656`)

## Authoring constraints

- MagicPath artifacts were authored as external prototype directions only.
- Generated React output stays outside repository production source and does not
  establish package, runtime, or public API commitments.
- `DIR-A` and `DIR-B` remain rejected first-round reviewer directions.
- `ROUND-2` is the approved prototype-iteration replacement over the same Story
  Workbench behavior contract.

## Command receipts

| Stage | Command family | Result |
| --- | --- | --- |
| project auth check | `magicpath-ai info -o json` | authenticated project access confirmed |
| component inventory | `magicpath-ai list-components 430393512920518656 -o json` | project inventory returned both donor components |
| donor bootstrap | `magicpath-ai code start <projectId> --name ...` | separate external workdirs created for each donor |
| donor publish | `magicpath-ai code submit <componentId> -o json` | both submits completed successfully |
| donor inspect/share | `magicpath-ai inspect ... -o json`, `share ... -o json`, API fetch | metadata and preview/public asset information recovered |
| Round 2 bootstrap | `magicpath-ai code start --project 430393512920518656 --dir /private/tmp/ignite-alchemy-story-runner.round2 --name "Ignite Alchemy Story Runner" --width 1440 --height 900 -o json` | fresh replacement component scaffolded without editing the rejected donors |
| Round 2 publish | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-story-runner.round2 --wait -o json` | submit completed successfully after one local TypeScript fix |
| Round 2 inspect/share | `magicpath-ai inspect dreamily-forest-8280 -o json`, `share dreamily-forest-8280 -o json`, API fetch | generated name, share/API URL, preview image, and built asset entrypoints recovered |

## Artifact register

| Artifact | Component name | Generated name | Component ID | Revision ID | Created at | Updated at | Preview image | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DIR-A` | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | 2026-07-21T19:27:16.261Z | 2026-07-21T19:32:06.171Z | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/3192cecb-8916-4f2f-860b-b05919656bd0.png` | rejected by human feedback as over-engineered |
| `DIR-B` | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | 2026-07-21T19:27:16.166Z | 2026-07-21T19:32:06.096Z | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/2d032329-3d41-4d7a-b70b-b686d10d7e1a.png` | rejected by human feedback as over-engineered |
| `ROUND-2` | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430424171277877249` | 2026-07-21T21:08:43.140Z | 2026-07-21T21:13:24.192Z | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/6e862546-75c1-440e-ba95-dbacd47a2c0f.png` | approved direction for prototype iteration only |

## Public/API URLs

| Artifact | Share/API URL | Published title | Asset entrypoints observed |
| --- | --- | --- | --- |
| `DIR-A` | `https://api.magicpath.ai/v1/calm-pool-4819` | Ignite Alchemy Evidence Ledger | JS `/v1/calm-pool-4819/assets/index-BoYa2aZe.js`, CSS `/v1/calm-pool-4819/assets/index-CyJuXZ1E.css` |
| `DIR-B` | `https://api.magicpath.ai/v1/noble-creek-8025` | Ignite Alchemy Reaction Map | JS `/v1/noble-creek-8025/assets/index-BYKv3MjW.js`, CSS `/v1/noble-creek-8025/assets/index-DdRYzC86.css` |
| `ROUND-2` | `https://api.magicpath.ai/v1/dreamily-forest-8280` | Ignite Alchemy Story Runner | JS `/v1/dreamily-forest-8280/assets/index-CmTgjLKU.js`, CSS `/v1/dreamily-forest-8280/assets/index-D6BZZclz.css` |

## Local authoring locations

| Artifact | External workdir | Authored files |
| --- | --- | --- |
| `DIR-A` | `/private/tmp/ignite-alchemy-evidence-ledger.IQrnJk` | `src/components/generated/IgniteAlchemyEvidenceLedger.tsx`, `src/index.css` |
| `DIR-B` | `/private/tmp/ignite-alchemy-reaction-map.guzPu6` | `src/components/generated/IgniteAlchemyReactionMap.tsx`, `src/index.css` |
| `ROUND-2` | `/private/tmp/ignite-alchemy-story-runner.round2` | `src/App.tsx`, `src/components/generated/IgniteAlchemyStoryRunner.tsx`, `src/index.css` |

## Handoff role metadata

| Artifact | Role in handoff | Notes |
| --- | --- | --- |
| `DIR-A` | rejected donor | archived reference only |
| `DIR-B` | rejected donor | archived reference only |
| `ROUND-2` | prototype-iteration shell | single focused replacement component; not browser accepted yet |

## Submit caveat

All `code submit` results reported `requiresClientResync: true`. That means the
post-submit local workdirs should be treated as stale copies of the published
MagicPath component state after asset normalization. Any future edits should
start from a resynced client state rather than resubmitting the pre-normalized
local files.
