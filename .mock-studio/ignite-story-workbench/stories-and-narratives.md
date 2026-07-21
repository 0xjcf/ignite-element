# Ignite Alchemy Stories and Narratives

Status: foundation gate
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
Product: Ignite Alchemy
Category: Story Workbench

Ignite Alchemy is the product identity for an example-local reviewer surface
over executable Voice Workbench Stories. Story Workbench remains the descriptive
category. Canonical Story, Intent, Behavior, Checkpoint, receipt, XState,
command, view, and coverage terminology stays literal underneath the
scientific-alchemy presentation language.

## Scope and authority

- Existing Story execution and final receipts remain authoritative through
  `igniteTest({ component }).story(...)`.
- Existing Voice Workbench XState machines remain authoritative for lifecycle
  transitions, guards, retries, cancellation, and recovery.
- Ignite Alchemy prototype directions may demonstrate the reviewer contract, but
  they may not imply live Story execution, machine causality, or coverage truth.
- The two first-round MagicPath directions must cover the same reviewer
  behavior/state matrix with distinct visual hierarchy:
  - `DIR-A` Evidence Ledger
  - `DIR-B` Reaction Map

## Story inventory

| Priority | Story ID | Actor | Starting condition | Intent | Observable result | Failure or exception |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | `US-001` | reviewer | Story catalog loaded, no active session | inspect available executable Stories and evidence posture | can choose a Story and see its state coverage and evidence mode | lens unavailable or coverage gaps remain visible |
| P0 | `US-002` | reviewer | Story selected, session idle | step through Story pages with explicit Given, Intent, Behavior, and Checkpoint boundaries | one page releases at a time with visible phase and page outcome | assertion failure, unavailable evidence, or blocked gap is legible |
| P0 | `US-003` | reviewer | stepped session paused or running | replay or go Back without mutating live state | Back disposes, rebuilds, and replays to the selected prior page | replay remains bounded and stale updates stay suppressed |
| P0 | `US-004` | reviewer | Story completed or failed | inspect final receipt plus additive observation and coverage evidence | final receipt, certainty, gaps, and no-lens status are distinguishable | exact causality is never claimed when evidence is candidate or unavailable |
| P1 | `US-005` | reviewer | session active across desktop widths | operate by keyboard with visible focus and reduced-motion-safe state transitions | controls remain legible and usable at 1440x900, 1280x800, and resilient 1024 widths | dense layouts still preserve non-color cues and target size |
| P1 | `US-006` | reviewer | comparing design directions | understand which direction best supports dense evidence review | donor comparison stays grounded in the same behavior and authority contract | visual polish never overrides missing behavior/state support |

## Reviewer narratives

| Narrative | Story | Actor | Entry/authorization | Trigger | Intended outcome | Branches | Maturity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NAR-001` | `US-001` | reviewer | example is loaded; reviewer has local access | chooses a Story from the catalog | selected Story becomes the active review target with explicit evidence mode labels | `PRIMARY`, `NO-LENS`, `UNCOVERED-GAP` | designed |
| `NAR-002` | `US-002` | reviewer | Story selected; session idle | presses Run or Step | reviewer sees gated Given/Intent/Behavior/Checkpoint pages with exactly one page released per step | `PRIMARY`, `ASSERTION-FAILURE`, `CANDIDATE-EVIDENCE` | designed |
| `NAR-003` | `US-003` | reviewer | session paused or completed | presses Back or Restart | reviewer gets a fresh-fixture replay rather than in-place rewind | `PRIMARY`, `CANCELLED`, `STALE-SUPPRESSED` | designed |
| `NAR-004` | `US-004` | reviewer | session completed, failed, or lens unavailable | opens receipt/evidence/covg surfaces | final receipt, additive evidence certainty, and gaps are inspectable without competing authorities | `PRIMARY`, `EXACT`, `CANDIDATE`, `UNAVAILABLE`, `GAP-REVIEW` | designed |
| `NAR-005` | `US-005` | reviewer | any interactive prototype state | resizes or uses keyboard/reduced-motion preference | layout, focus, and cues remain legible at target widths and under reduced motion | `PRIMARY`, `1024-RESILIENT`, `REDUCED-MOTION` | designed |

## Branch portfolio

| Branch ID | Type | Divergence point | User steps and observations | Rejoin or terminal | Expected facts/views | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `NAR-001-PRIMARY` | primary | Story chosen from catalog | reviewer sees Story summary, command surface, current evidence posture | rejoins `NAR-002` | selected `storyId`, visible phase legend, ready controls | W1 architecture + prototype direction |
| `NAR-001-NO-LENS` | unavailable | optional XState lens absent | reviewer still sees Story pages, receipt, and explicit `no XState lens` status | rejoins `NAR-002` | machine coverage marked `unavailable`, not zero | W1 architecture no-lens rule |
| `NAR-001-UNCOVERED-GAP` | expected-failure | coverage join lacks machine evidence | reviewer sees uncovered-gap review, exclusions, and provenance | terminal or rejoins after Story switch | gap inventory, exclusions, no false exactness | W1 coverage contract |
| `NAR-002-PRIMARY` | primary | reviewer starts session | pages release in order: Given -> Intent -> Behavior -> Checkpoint | rejoins `NAR-003` or `NAR-004` | current page outcome, current view, command availability | seven executable Stories + Story ergonomics audit |
| `NAR-002-ASSERTION-FAILURE` | expected-failure | checkpoint fails | reviewer sees failure state, failed Checkpoint label, and preserved evidence trace | terminal recoverable to restart | failure posture, receipt preserved, control disposition visible | Story receipts + named checkpoints |
| `NAR-002-CANDIDATE-EVIDENCE` | alternate-success | observation cannot prove exact causality | reviewer sees candidate edge/state evidence with explicit non-color cue | rejoins `NAR-004` | certainty `candidate`, no exact trigger claim | W1 lens certainty contract |
| `NAR-003-PRIMARY` | recovery | reviewer presses Back or Restart | active session disposes, fresh fixture builds, replay proceeds to target page | rejoins paused state | replaying state, prior page restored, no mutated snapshot | W1 replay rules + controller task |
| `NAR-003-CANCELLED` | cancellation | reviewer cancels in-flight work | active work stops, terminal state is visible, stale results do not update active session | terminal recoverable | cancelled status, control availability reset | existing cancellation narrative + controller task |
| `NAR-003-STALE-SUPPRESSED` | conflict | obsolete async work resolves after replacement | reviewer sees active session unchanged and stale evidence ignored | rejoins paused/running state | generation suppression, no duplicate writer | stale receipt narrative + controller task |
| `NAR-004-PRIMARY` | primary | session completed | reviewer compares final receipt, current view, and additive evidence panes | terminal | ordinary receipt plus additive projections | W1 report boundary |
| `NAR-004-EXACT` | alternate-success | lens directly proves transition/path | reviewer sees exact evidence labels and supporting provenance | terminal | certainty `exact` | future lens task contract |
| `NAR-004-CANDIDATE` | alternate-success | lens suggests but does not prove edge | reviewer sees candidate label and explanation | terminal | certainty `candidate` | future lens task contract |
| `NAR-004-UNAVAILABLE` | unavailable | lens absent or unsupported | reviewer sees receipt-first fallback and explicit unavailable state | terminal | certainty `unavailable` | W1 no-lens rule |
| `NAR-004-GAP-REVIEW` | expected-failure | coverage join reveals uncovered machine or page | reviewer sees gap provenance, exclusions, and next-step posture | terminal | uncovered-gap review | future coverage task contract |
| `NAR-005-PRIMARY` | primary | interactive design at desktop widths | reviewer sees dense but legible evidence layout and visible focus | terminal | usable controls at 1440 and 1280 | required measurements |
| `NAR-005-1024-RESILIENT` | recovery | width compresses to 1024 | hierarchy compresses without losing literal evidence labels or controls | terminal | resilient columns, readable panes, no clipped controls | required measurements |
| `NAR-005-REDUCED-MOTION` | permission | reduced-motion preference active | progress and transitions degrade to subtle or immediate changes | terminal | motion-safe cues, no hidden state changes | required measurements |

## Prototype state and coverage matrix

Both MagicPath directions must cover these same designed states:

| State ID | Narrative branches covered | Required visible contract |
| --- | --- | --- |
| `STATE-IDLE-SELECTION` | `NAR-001-PRIMARY` | Story catalog, selected Story summary, no active session receipt |
| `STATE-PAUSED-STEP` | `NAR-002-PRIMARY` | current page paused ahead of next page, Step/Run controls, current phase badge |
| `STATE-BACK-REPLAY` | `NAR-003-PRIMARY` | replaying indicator, selected prior page target, fresh-fixture language |
| `STATE-COMPLETED-RECEIPT` | `NAR-004-PRIMARY` | final receipt surface, additive evidence panes, receipt-first emphasis |
| `STATE-ASSERTION-FAILURE` | `NAR-002-ASSERTION-FAILURE` | failed Checkpoint, failure explanation, retry/restart posture |
| `STATE-EVIDENCE-EXACT` | `NAR-004-EXACT` | exact certainty cue, path/topology provenance |
| `STATE-EVIDENCE-CANDIDATE` | `NAR-002-CANDIDATE-EVIDENCE`, `NAR-004-CANDIDATE` | candidate certainty cue, explicit ambiguity |
| `STATE-EVIDENCE-UNAVAILABLE` | `NAR-001-NO-LENS`, `NAR-004-UNAVAILABLE` | `no XState lens` or unavailable evidence mode |
| `STATE-UNCOVERED-GAP` | `NAR-001-UNCOVERED-GAP`, `NAR-004-GAP-REVIEW` | uncovered-gap review, exclusions, provenance |

## Control disposition baseline

| Visible control | Disposition | Canonical target |
| --- | --- | --- |
| Story picker | semantic command | select reviewer Story/session seed |
| Run | semantic command | begin remaining Story execution |
| Step | semantic command | release exactly one page |
| Back | semantic command | dispose, rebuild, and replay to a prior page |
| Restart | semantic command | fresh-fixture rerun from opening page |
| Cancel | semantic command | cancel active session safely |
| Receipt tabs/panels | projection-only | switch additive evidence view |
| Coverage filters | projection-only | filter review surfaces without mutating Story truth |
| Compare directions | behavior-deferred | donor review only; not product runtime behavior |

## Design round rule

This task records the first material visual round only. `approval.md` must end
in `pending explicit human selection` until the user chooses a direction or asks
for another round.
