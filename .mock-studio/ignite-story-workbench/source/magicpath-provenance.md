# Ignite Alchemy MagicPath Provenance

Status: recorded
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
MagicPath project: Ignite Alchemy (`430393512920518656`)

## Authoring constraints

- MagicPath donors were authored as external prototype directions only.
- Generated React output stays outside repository production source and does not
  establish package, runtime, or public API commitments.
- The two donors represent competing first-round reviewer directions over the
  same Story Workbench behavior contract.

## Command receipts

| Stage | Command family | Result |
| --- | --- | --- |
| project auth check | `magicpath-ai info -o json` | authenticated project access confirmed |
| component inventory | `magicpath-ai list-components 430393512920518656 -o json` | project inventory returned both donor components |
| donor bootstrap | `magicpath-ai code start <projectId> --name ...` | separate external workdirs created for each donor |
| donor publish | `magicpath-ai code submit <componentId> -o json` | both submits completed successfully |
| donor inspect/share | `magicpath-ai inspect ... -o json`, `share ... -o json`, API fetch | metadata and preview/public asset information recovered |

## Donor artifacts

| Donor | Component name | Generated name | Component ID | Revision ID | Created at | Updated at | Preview image |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DIR-A` | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | 2026-07-21T19:27:16.261Z | 2026-07-21T19:32:06.171Z | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/3192cecb-8916-4f2f-860b-b05919656bd0.png` |
| `DIR-B` | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | 2026-07-21T19:27:16.166Z | 2026-07-21T19:32:06.096Z | `https://storage.googleapis.com/storage.magicpath.ai/component-previews/2d032329-3d41-4d7a-b70b-b686d10d7e1a.png` |

## Public/API URLs

| Donor | Share/API URL | Published title | Asset entrypoints observed |
| --- | --- | --- | --- |
| `DIR-A` | `https://api.magicpath.ai/v1/calm-pool-4819` | Ignite Alchemy Evidence Ledger | JS `/v1/calm-pool-4819/assets/index-BoYa2aZe.js`, CSS `/v1/calm-pool-4819/assets/index-CyJuXZ1E.css` |
| `DIR-B` | `https://api.magicpath.ai/v1/noble-creek-8025` | Ignite Alchemy Reaction Map | JS `/v1/noble-creek-8025/assets/index-BYKv3MjW.js`, CSS `/v1/noble-creek-8025/assets/index-DdRYzC86.css` |

## Local authoring locations

| Donor | External workdir | Authored files |
| --- | --- | --- |
| `DIR-A` | `/private/tmp/ignite-alchemy-evidence-ledger.IQrnJk` | `src/components/generated/IgniteAlchemyEvidenceLedger.tsx`, `src/index.css` |
| `DIR-B` | `/private/tmp/ignite-alchemy-reaction-map.guzPu6` | `src/components/generated/IgniteAlchemyReactionMap.tsx`, `src/index.css` |

## Submit caveat

Both `code submit` results reported `requiresClientResync: true`. That means the
post-submit local workdirs should be treated as stale copies of the published
MagicPath component state after asset normalization. Any future edits should
start from a resynced client state rather than resubmitting the pre-normalized
local files.
