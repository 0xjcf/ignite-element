# Ignite Alchemy MagicPath Provenance

Status: recorded from final published candidate
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
MagicPath project: Ignite Alchemy (`430393512920518656`)

## Authoring constraints

- MagicPath artifacts were authored as external prototype directions only.
- Generated React output stays outside repository production source and does not
  establish package, runtime, or public API commitments.
- `DIR-A` and `DIR-B` remain rejected first-round reviewer directions.
- `ROUND-2` is the final published candidate over the same Story Workbench
  behavior contract and is browser interaction-verified. Exact CSS viewport
  acceptance and human visual approval remain pending.

## Command receipts

| Stage | Command family | Result |
| --- | --- | --- |
| project auth check | `magicpath-ai info -o json` | authenticated project access confirmed |
| component inventory | `magicpath-ai list-components 430393512920518656 -o json` | project inventory returned donor and replacement components |
| donor bootstrap | `magicpath-ai code start <projectId> --name ...` | separate external workdirs created for each donor |
| donor publish | `magicpath-ai code submit <componentId> -o json` | both donor submits completed successfully |
| donor inspect/share | `magicpath-ai inspect ... -o json`, `share ... -o json`, API fetch | metadata and preview/public asset information recovered |
| Round 2 bootstrap | `magicpath-ai code start --component 430424171277877248 --dir /private/tmp/ignite-alchemy-story-runner.round2 -o json` | existing component resynced for revision-driven edits rather than creating a new component |
| Round 2 publish | `magicpath-ai code submit --dir /private/tmp/ignite-alchemy-story-runner.round2 --wait -o json` | submit completed successfully for the published candidate and final responsive correction |
| Round 2 inspect/share | `magicpath-ai inspect dreamily-forest-8280 -o json`, `share 430393512920518656 -o json`, `share 430424171277877248 -o json`, API fetch | generated name, project share URL, component share URL, and final built source recovered |

## Artifact register

| Artifact | Component name | Generated name | Component ID | Revision ID | Disposition |
| --- | --- | --- | --- | --- | --- |
| `DIR-A` | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | rejected by human feedback as over-engineered |
| `DIR-B` | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | rejected by human feedback as over-engineered |
| `ROUND-2` | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430443925757644800` | interaction-verified candidate; exact viewport recheck and human visual approval pending |

## Public URLs

| Artifact | URL set | Published title |
| --- | --- | --- |
| `DIR-A` | `https://api.magicpath.ai/v1/calm-pool-4819` | Ignite Alchemy Evidence Ledger |
| `DIR-B` | `https://api.magicpath.ai/v1/noble-creek-8025` | Ignite Alchemy Reaction Map |
| `ROUND-2` | design `https://designs.magicpath.ai/v1/dreamily-forest-8280`, project `https://www.magicpath.ai/files/430393512920518656`, component `https://www.magicpath.ai/files/430424171277877248`, API `https://api.magicpath.ai/v1/dreamily-forest-8280` | Ignite Alchemy Story Runner |

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
| `ROUND-2` | interaction-verified candidate | single focused replacement component; exact viewport recheck and human visual approval still pending |

## Browser receipts captured against the published component

- Step: page 1 -> exactly `ALCH-NAR-001-PAGE-02-STEP-INTENT-START-VOICE`,
  status `Paused`, Back and Restart enabled.
- Run: terminal `ALCH-NAR-001-PAGE-07-VERIFY-RECEIPT`, `Receipt ready`,
  ordinary receipt accepted.
- Back: page 7 -> page 6 by replay; page 7 lane returned to pending class.
- Restart: page 1; Back and Restart disabled again.
- Failure branch: stops at page 4
  `ALCH-NAR-001-PAGE-04-CHECKPOINT-PERMISSION-STAYS-A-FACT`, status failed,
  Debug auto-opens with failed checkpoint first.
- No-lens branch: reaches page 7 with selected Story visible and ordinary
  receipt accepted; Machine view says exactly `No XState lens`.
- Advanced branch: reaches page 7 with ordinary receipt accepted; Coverage
  keeps `STORY-003 timeout receipt remains secondary` and
  `STORY-004 stale receipt remains secondary` additive.
- Console warnings/errors: none.

## Submit caveat

All `code submit` results reported `requiresClientResync: true`. That means the
post-submit local workdirs should be treated as stale copies of the published
MagicPath component state after asset normalization. Any future edits should
start from a resynced client state rather than resubmitting the pre-normalized
local files.
