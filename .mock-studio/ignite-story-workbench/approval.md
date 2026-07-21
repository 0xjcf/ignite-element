# Ignite Alchemy Approval Gate

Status: browser-verified candidate ready for human visual approval
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`

## Approval receipt

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Narrative authority | `pass` | Ignite Alchemy remains the product contract owner through `ALCH-US-*` and `ALCH-NAR-*`, with `STORY-*` bound as subject fixtures only. |
| Published artifact recorded | `pass` | Final published candidate is component `430424171277877248`, revision `430443925757644800`, generated name `dreamily-forest-8280`, design `https://designs.magicpath.ai/v1/dreamily-forest-8280`, project `https://www.magicpath.ai/files/430393512920518656`, component share `https://www.magicpath.ai/files/430424171277877248`. |
| Golden product flow behavior | `pass` | Browser receipts confirm Step moves page 1 to exactly `ALCH-NAR-001-PAGE-02-STEP-INTENT-START-VOICE`, Run reaches `ALCH-NAR-001-PAGE-07-VERIFY-RECEIPT`, Back replays from page 7 to page 6 and returns page 7 to pending, and Restart resets to page 1 with Back and Restart disabled. |
| Failure, no-lens, and advanced branches | `pass` | Failure branch stops at page 4 and auto-opens Debug on the failed checkpoint first. No-lens branch reaches page 7 with selected Story and ordinary receipt intact, and the Machine view says exactly `No XState lens`. Advanced branch keeps `STORY-003 timeout receipt remains secondary` and `STORY-004 stale receipt remains secondary` additive. |
| Browser layout and interaction acceptance | `pass` | Requested 1440x900, 1280x800, and 1024x800 targets all showed no horizontal overflow, no unexpected element overflow, visible keyboard focus, and a minimum product-button height of 44px. The resilient target stayed in the readable two-column rail-plus-primary composition rather than the rejected three-panel squeeze. |
| Contrast acceptance | `pass` | Measured contrast against the base background: title `16.7:1`, copy `10.67:1`, muted `6.21:1`, mono `13.1:1`, button ink on ember `7.75:1`. |
| Reduced-motion live browser evidence | `ready-with-extension` | Published source contains the reduced-motion CSS contract and JS `prefers-reduced-motion` observer, but the live browser query was false, so this turn does not claim an emulated reduced-motion pass. |
| Human visual/design approval | `pending` | The published component is browser-verified and technically acceptable, but the user has not yet visually approved the final revision. |
| POC admission | `pending` | The next gate is human visual/design approval before POC. This candidate is not admitted to POC yet. |

Technical/browser acceptance verdict: `pass`

Human visual approval verdict: `pending`

POC admission verdict: `pending`

## Archived donor outcome

The first material donor round remains archived and rejected:

- `DIR-A` Evidence Ledger
- `DIR-B` Reaction Map

Reason: both were over-engineered relative to the restrained reviewer shell the
product needs.

## Candidate state

The current candidate is the published replacement direction:

- `ROUND-2` / Ignite Alchemy Story Runner / `dreamily-forest-8280`

This artifact is now a browser-verified candidate ready for human visual
approval. It is not the same as human visual approval itself.

## Remaining gate

Before POC work is admitted, the remaining decision is:

- human visual/design approval of the final published candidate
