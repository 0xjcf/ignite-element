# Ignite Alchemy Donor Matrix

Status: interaction-verified candidate recorded; exact viewport recheck pending
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
Selection: rejected donors archived; Round 2 published candidate is interaction-verified and awaiting exact viewport recheck plus human visual approval

## Artifact register

| Artifact ID | Kind | Direction | MagicPath component | Generated name | Component ID | Revision ID | Share/API URL | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DIR-A` | first-round donor | Evidence Ledger | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | `https://api.magicpath.ai/v1/calm-pool-4819` | rejected by human feedback as over-engineered |
| `DIR-B` | first-round donor | Reaction Map | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | `https://api.magicpath.ai/v1/noble-creek-8025` | rejected by human feedback as over-engineered |
| `ROUND-2` | replacement candidate | Story Runner | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430443925757644800` | `https://api.magicpath.ai/v1/dreamily-forest-8280` | interaction-verified candidate; exact viewport recheck and human visual approval pending |

## Reviewer contract carried into Round 2

The replacement candidate preserves the required reviewer experience that the
first-round donors were trying to cover:

- Story selection with a compact left rail
- Run, Step, Back, and Restart controls in a restrained header
- dominant application-under-test preview
- Given -> Intent -> Behavior -> Checkpoint progress lane
- compact result bar
- collapsed Debug drawer that auto-opens on failure
- failure/current checkpoint, Context diff, Receipt, Machine, and Coverage tabs
- exact, candidate, and unavailable evidence language
- local `No XState lens` explanation instead of a global topology-first layout

## Why the replacement direction won

| Requirement | First-round donor gap | `ROUND-2` response |
| --- | --- | --- |
| literal reviewer shell | both donors leaned into concept-heavy framing | uses literal Story/Checkpoint/Receipt/Debug terms throughout |
| progressive disclosure | both donors kept too much evidence visible at once | keeps Debug collapsed until needed and auto-opens only on failure |
| application-first review | both donors gave too much hierarchy to supporting evidence | centers the application preview and keeps evidence secondary |
| deterministic pass/fail | both donors read as atmospheric proof surfaces | result bar and state machine stay explicit about Ready, Running, Paused, Replay, Receipt ready, and Failed |
| constrained topology posture | `DIR-B` made the graph a primary visual language | Machine tab is local and explains unavailable/candidate evidence without dominating the shell |
| lower-complexity iteration path | both donors would need large hierarchy reductions | replacement artifact started directly from the accepted simpler contract |

## Round 2 interaction coverage

| Surface or state | `ROUND-2` posture |
| --- | --- |
| `STATE-IDLE-SELECTION` | Story rail plus summary header keep the shell ready-focused |
| `STATE-PAUSED-STEP` | Step advances from page 1 to exactly `ALCH-NAR-001-PAGE-02-STEP-INTENT-START-VOICE`, with Back and Restart enabled |
| `STATE-BACK-REPLAY` | Back from page 7 replays to page 6 and returns page 7 to pending, proving future-release truncation |
| `STATE-COMPLETED-RECEIPT` | Run reaches `ALCH-NAR-001-PAGE-07-VERIFY-RECEIPT`, `Receipt ready`, and ordinary receipt accepted |
| `STATE-ASSERTION-FAILURE` | failure auto-opens Debug and pins the failed checkpoint first |
| `STATE-EVIDENCE-EXACT` | exact chip plus receipt language stay literal |
| `STATE-EVIDENCE-CANDIDATE` | candidate cue is local to the Story and Machine tab |
| `STATE-EVIDENCE-UNAVAILABLE` | Machine tab explains `No XState lens` without inventing a graph |
| `STATE-UNCOVERED-GAP` | Coverage tab keeps uncovered and excluded items additive, not blocking the shell |

## Browser measurement posture

| Browser control request | Reported inner size | Observed shell posture | Evidence boundary |
| --- | --- | --- | --- |
| `1440x900` | `1800x1125` | readable two-column rail-plus-primary composition | no observed overflow and min product-button height `44px` at the reported inner size; exact 1440x900 CSS viewport not verified |
| `1280x800` | `1600x1000` | readable two-column rail-plus-primary composition | no observed overflow and min product-button height `44px` at the reported inner size; exact 1280x800 CSS viewport not verified |
| `1024x800` | `1280x1000` | `232px` Story rail plus `965px` primary work area with full-width Review Details below | no observed overflow and min product-button height `44px` at the reported inner size; exact 1024x800 collapse not verified |

The browser host mapped each control request to a reported inner size 1.25 times
larger. These are useful responsive samples, but they are not acceptance
receipts for the exact requested CSS viewports.

Keyboard focus receipt:

- Tabbing from Run focused Step with settled two-ring box shadow
  `0 0 0 2px rgba(9,13,19,.92), 0 0 0 4px rgba(255,148,74,.72)`.

## Decision gate

`DIR-A` and `DIR-B` remain archived first-round donors only. `ROUND-2` is the
interaction-verified candidate, but exact viewport verification and human
visual approval remain pending, so it is not admitted to POC yet.
