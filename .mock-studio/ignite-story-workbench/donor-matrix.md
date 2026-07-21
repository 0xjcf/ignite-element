# Ignite Alchemy Donor Matrix

Status: Round 2 replacement prototype recorded
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
Selection: human approved the Round 2 direction for prototype iteration; browser acceptance is still pending live measurement

## Artifact register

| Artifact ID | Kind | Direction | MagicPath component | Generated name | Component ID | Revision ID | Share/API URL | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DIR-A` | first-round donor | Evidence Ledger | Ignite Alchemy Evidence Ledger | `calm-pool-4819` | `430398641119842304` | `430398641119842305` | `https://api.magicpath.ai/v1/calm-pool-4819` | rejected by human feedback as over-engineered |
| `DIR-B` | first-round donor | Reaction Map | Ignite Alchemy Reaction Map | `noble-creek-8025` | `430398641077891072` | `430398641077891073` | `https://api.magicpath.ai/v1/noble-creek-8025` | rejected by human feedback as over-engineered |
| `ROUND-2` | replacement prototype | Story Runner | Ignite Alchemy Story Runner | `dreamily-forest-8280` | `430424171277877248` | `430424171277877249` | `https://api.magicpath.ai/v1/dreamily-forest-8280` | approved direction for prototype iteration only |

## Reviewer contract carried into Round 2

The replacement prototype preserves the required reviewer experience that the
first-round donors were trying to cover:

- Story selection with a compact left rail
- Run, Step, and Back controls in a restrained header
- dominant application-under-test preview
- Given -> Intent -> Behavior -> Checkpoint progress lane
- compact result bar
- collapsed Debug drawer that auto-opens on failure
- failure/current checkpoint, Context diff, Receipt, Machine, and Coverage tabs
- exact, candidate, and unavailable evidence language
- local `no XState lens` explanation instead of a global topology-first layout

## Why the replacement direction won

| Requirement | First-round donor gap | `ROUND-2` response |
| --- | --- | --- |
| literal reviewer shell | both donors leaned into concept-heavy framing | uses literal Story/Checkpoint/Receipt/Debug terms throughout |
| progressive disclosure | both donors kept too much evidence visible at once | keeps Debug collapsed until needed and auto-opens only on failure |
| application-first review | both donors gave too much hierarchy to supporting evidence | centers the application preview and keeps evidence secondary |
| deterministic pass/fail | both donors read as atmospheric proof surfaces | result bar and state machine stay explicit about Ready, Running, Paused, Passed, and Failed |
| constrained topology posture | `DIR-B` made the graph a primary visual language | Machine tab is local and explains unavailable/candidate evidence without dominating the shell |
| lower-complexity iteration path | both donors would need large hierarchy reductions | new artifact starts directly from the accepted simpler contract |

## Round 2 interaction coverage

| Surface or state | `ROUND-2` posture |
| --- | --- |
| `STATE-IDLE-SELECTION` | Story rail plus summary header keep the shell ready-focused |
| `STATE-PAUSED-STEP` | progress lane and application preview hold the current checkpoint without flooding evidence |
| `STATE-BACK-REPLAY` | Back returns to earlier checkpoints and re-enters Ready or Paused deterministically |
| `STATE-COMPLETED-RECEIPT` | result bar and Receipt tab keep the final proof compact |
| `STATE-ASSERTION-FAILURE` | failure auto-opens Debug and pins the failed checkpoint first |
| `STATE-EVIDENCE-EXACT` | exact chip plus receipt language stay literal |
| `STATE-EVIDENCE-CANDIDATE` | candidate cue is local to the Story and Machine tab |
| `STATE-EVIDENCE-UNAVAILABLE` | Machine tab explains `No XState lens` without inventing a graph |
| `STATE-UNCOVERED-GAP` | Coverage tab keeps uncovered and excluded items additive, not blocking the shell |

## Decision gate

`DIR-A` and `DIR-B` remain archived first-round donors only. `ROUND-2` is the
approved direction for the next prototype iteration, but it is not yet browser
accepted because this turn did not record live viewport, focus, target-size, or
overflow measurements against the published component.
