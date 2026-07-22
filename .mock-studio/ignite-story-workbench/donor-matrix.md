# Ignite Alchemy Donor Matrix

Status: Round 2 rejected; corrected Round 3 candidates published; Focus Runner
Variant 2 is the human-preferred leading donor pending browser validation
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Artifact register

| Artifact ID | Kind | Direction | MagicPath component | Generated name | Component ID | Revision ID | URL | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DIR-A` | first-round donor | Evidence Ledger | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | `https://api.magicpath.ai/v1/calm-pool-4819` | rejected by human feedback as over-engineered |
| `DIR-B` | first-round donor | Reaction Map | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | `https://api.magicpath.ai/v1/noble-creek-8025` | rejected by human feedback as over-engineered |
| `ROUND-2` | rejected candidate | Story Runner | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430443925757644800` | `https://www.magicpath.ai/files/430424171277877248` | rejected by human feedback for kitchen-sink density and excessive simultaneous detail |
| `ROUND-3A` | corrected published candidate | Canvas Runner | Ignite Alchemy Canvas Runner | `keenly-wood-5115` | `430498394188955648` | `430502451452473344` | `https://www.magicpath.ai/files/430498394188955648` | corrected candidate awaiting root browser validation and human selection |
| `ROUND-3B` | corrected published candidate | Focus Runner | Ignite Alchemy Focus Runner | `vibrantly-second-1236` | `430498394214125568` | `430502451368595456` | `https://www.magicpath.ai/files/430498394214125568` | corrected candidate awaiting root browser validation and human selection |
| `ROUND-3B-VAR2` | human-preferred leading donor | Focus Runner (Variant 2) | Ignite Alchemy Focus Runner (Variant 2) | `dreamily-sand-6842` | `430503922197753859` | unknown in this turn | `https://designs.magicpath.ai/v1/dreamily-sand-6842` | human-preferred leading donor/candidate; browser validation and final approval still pending |

## Reviewer contract carried forward

Both corrected Round 3 candidates stay anchored to the same narrative
contract:

- exact `ALCH-NAR-001-PAGE-01` through `PAGE-07` sequencing over `STORY-002`;
- one-page Step progression and visibly sequential Run progression;
- Back as deterministic replay that truncates future releases;
- Restart as a fresh reset to page 1;
- receipt content absent on pages 1 through 6;
- only a compact passed result on page 7 with `View receipt`;
- failed checkpoint path that auto-opens Details on the failed assertion; and
- timeout and stale evidence kept latent until explicitly requested.

## Why the correction was required

| Requirement | Rejected first Round 3 gap | Corrected Round 3 response |
| --- | --- | --- |
| recognizable preview | first revisions still read as metadata-led cards | preview is now a minimal Voice Workbench application with thread, composer, mic state, and inline denial |
| progressive disclosure | receipt structure appeared too early | receipt stays absent until page 7 and full receipt remains in Details |
| bounded structure | metadata strips and support panels competed with the preview | current step is reduced to one compact line and no permanent receipt column remains |
| restrained controls | visible test-state affordance stayed too explicit | prototype states moved behind an accessible `…` overflow menu |
| variant comparison | first revisions were still too similar to a review dashboard | corrected Canvas keeps only a compact rail while Focus centers one dominant application surface |

## Internal preview correction

| Candidate | Rejected initial revision | Corrected revision now pending | Root preview reason for correction |
| --- | --- | --- | --- |
| `ROUND-3A` | `430498394188955649` | `430502451452473344` | preview was still metadata-led, exposed receipt structure too early, and did not read as a recognizable Voice Workbench application |
| `ROUND-3B` | `430498394214125569` | `430502451368595456` | preview was still metadata-led, exposed receipt structure too early, and did not read as a recognizable Voice Workbench application |

## Candidate distinction

| Candidate | Persistent structure | Distinguishing trait | Browser status |
| --- | --- | --- | --- |
| `ROUND-3A` / Canvas Runner | compact Story rail plus dominant main stage | visible rail keeps fixture choice available without a permanent detail or receipt column | awaiting root browser validation |
| `ROUND-3B` / Focus Runner | single dominant main stage with toolbar picker | no persistent sidebar; Story access stays compact in the toolbar | awaiting root browser validation |
| `ROUND-3B-VAR2` / Focus Runner (Variant 2) | inspected variant of the Focus direction | human feedback prefers this as the leading donor over the equal-finalist framing | awaiting root browser validation |

## Decision gate

`DIR-A`, `DIR-B`, and `ROUND-2` remain provenance only. `ROUND-3A` and
`ROUND-3B` remain comparison evidence, but `ROUND-3B-VAR2` is now the
human-preferred leading donor/candidate. None of them is admitted to POC
until:

- root browser validation records the real interaction and responsive posture;
  then
- a human selects or rejects the published direction.
