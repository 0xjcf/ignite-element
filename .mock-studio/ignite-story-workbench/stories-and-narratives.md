# Ignite Alchemy Stories and Narratives

Status: narrative gate before further visual iteration
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
Product: Ignite Alchemy
Category: Story Workbench

Ignite Alchemy is a reviewer surface over existing executable Voice Workbench
Stories. This document is the design-driving contract. It is intentionally
split into two layers:

1. Subject Story truth: the exact existing
   `igniteTest({ component }).story(...)` names, commands, pages, checkpoints,
   view outcomes, `canExecute` outcomes, and final receipts.
2. Reviewer journey: the exact actions and visible consequences Ignite Alchemy
   must present while remaining downstream of the existing Story executor.

The reviewer shell may simulate stepping, replay, and optional evidence joins,
but it must use the same Story, Intent, Behavior, Checkpoint, receipt, and
XState vocabulary as the executable source. It may not replace those outcomes
with invented Address, Quote, Import, or other mock domains.

## Scope and authority

- Story execution and final receipts remain authoritative through
  `igniteTest({ component }).story(...)`.
- Existing Voice Workbench XState machines remain authoritative for turn,
  capture, speech, timeout, cancellation, and stale-suppression behavior.
- Ignite Alchemy may gate, sequence, and project review pages; it may not
  create a second lifecycle writer or manufacture causal certainty.
- Controlled stepping, Back replay, optional XState joins, and coverage joins
  remain designed host-product behavior until their queued tasks land.

## Initial executable design portfolio

These four executable Stories are the canonical first design portfolio. Any
first-pass reviewer shell must be able to explain these same outcomes.

| Priority | Executable Story name | Why it is design-driving | Key commands | Checkpoints / page boundaries | Final view / receipt posture | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | `preparation failure retries into ready` | shortest clean recovery path and simplest pass receipt | `beginModelPreparation` | Given unavailable -> Intent retry -> Behavior availability -> Checkpoint `ready after retry` | final view returns to `status: "ready"` with `model.status: "available"` and `submitPrompt: true` | implemented |
| P0 | `microphone permission denial recovers to typed prompt` | recommended golden walkthrough because it visibly crosses Given -> Intent -> Behavior -> Checkpoint -> second Intent -> second Checkpoint | `startVoiceCapture`, `submitPrompt` | Checkpoints `voice permission stays a fact`, `text recovery starts a new turn` | final view stays `status: "responding"` while `voiceState: "permission"` remains visible; typed recovery becomes the new active turn | implemented |
| P0 | `timed out turn retries to an accepted response` | timeout, retry, artifact creation, accepted completion, and ordinary ready-state recovery | `submitPrompt`, `createArtifact`, `completeResponse` | Checkpoints `timeout returns the turn to idle`, `retry can finish with an accepted artifact`, `accepted retry returns to ready` | final view returns to `status: "ready"` with accepted response text and retained artifact revision `1` | implemented |
| P1 | `stale correlated model receipts stay inert until the live turn ends` | advanced stale-suppression and replay-risk case; useful for Debug and evidence framing | `submitPrompt` twice; actor-owned cancel between turns | Checkpoints `cancelled first turn returns idle`, `second turn is responding`, `stale port result stays inert`, `live correlation still controls exit` | final view returns to `status: "ready"` only when the live correlated turn ends; stale receipts stay inert | implemented |

## Subject Story truth

### Story truth register

| Story ID | Executable Story | Starting view and `canExecute` | Commands actually issued by the Story | Reviewer-visible page truth | Final view / canExecute truth |
| --- | --- | --- | --- | --- | --- |
| `STORY-001` | `preparation failure retries into ready` | Given waits for `snapshot.matches("unavailable")`, `view.status: "failed"`, `model.status: "failed"`, `submitPrompt: false` | `beginModelPreparation` | one retry intent, one external availability behavior, one ready checkpoint | `status: "ready"`, `model.status: "available"`, `submitPrompt: true`, `startVoiceCapture: true` |
| `STORY-002` | `microphone permission denial recovers to typed prompt` | Given waits for `available.turn.idle`, `view.status: "ready"`, `voiceState: "idle"`, `startVoiceCapture: true`, `submitPrompt: true` | `startVoiceCapture`, `submitPrompt` with `{ modality: "text", text: "Continue with text fallback." }` | microphone denial remains a fact, then typed prompt starts a new responding turn | `status: "responding"`, `voiceState: "permission"`, `createArtifact: true`, `completeResponse: false` |
| `STORY-003` | `timed out turn retries to an accepted response` | Given waits for `available.turn.idle`, `view.status: "ready"`, `submitPrompt: true` | `submitPrompt` timeout pass 1, `submitPrompt` retry pass 2, `createArtifact`, `completeResponse` | timeout returns idle, retry keeps responding with artifact revision `1`, accepted completion returns ready | `status: "ready"`, `response.text: "Recovered after timeout."`, retained artifact `timeout-recovery@1`, `submitPrompt: true` |
| `STORY-004` | `stale correlated model receipts stay inert until the live turn ends` | Given waits for `available.turn.idle`, `view.status: "ready"`, `submitPrompt: true` | `submitPrompt` first turn, actor-owned cancel, `submitPrompt` live turn | stale first-turn result must not move the live turn or overwrite lifecycle | live turn remains authoritative until its own cancel returns `status: "ready"` |

### Story page tables

These are the exact design-driving flows. Later visual work may condense their
presentation, but it may not change page identity or semantic outcomes.

#### `STORY-001` preparation failure retries into ready

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `STORY-001-GIVEN-UNAVAILABLE` | Given | wait for unavailable snapshot | app starts in failed preparation state with model unavailable | `view.status: "failed"`, `model.status: "failed"`, `submitPrompt: false` | before: Story selection only; after: `beginModelPreparation` is the meaningful next step | rejoin to retry intent |
| `STORY-001-INTENT-RETRY` | Intent | `beginModelPreparation` | retry action is issued explicitly | command trace records retry intent | before: retry available; after: waiting for behavior completion | rejoin to availability behavior |
| `STORY-001-BEHAVIOR-PREPARATION-AVAILABLE` | Behavior | fixture resolves preparation available | app leaves failed prep and readies the model | receipts include `MODEL_PREPARATION_STARTED` and `modelPreparation:available` | before: retry in progress; after: ready checkpoint may pass | rejoin to ready checkpoint |
| `STORY-001-CHECKPOINT-READY-AFTER-RETRY` | Checkpoint | assert ready state | app shows `statusLabel: "Ready"` and normal command availability again | named checkpoint `ready after retry` | before: waiting for ready; after: `submitPrompt` and `startVoiceCapture` are available | terminal pass receipt |

#### `STORY-002` microphone permission denial recovers to typed prompt

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `STORY-002-GIVEN-READY` | Given | wait for idle ready snapshot | app is ready, voice idle, typed prompt allowed | `view.status: "ready"`, `voiceState: "idle"`, `startVoiceCapture: true`, `submitPrompt: true`, `submitVoiceTranscript: false` | before: select Story; after: `startVoiceCapture` and `submitPrompt` | rejoin to voice intent |
| `STORY-002-INTENT-START-VOICE` | Intent | `startVoiceCapture` | reviewer explicitly starts microphone flow | correlated voice start request exists | before: start voice allowed; after: permission result is pending | rejoin to denial behavior |
| `STORY-002-BEHAVIOR-PERMISSION-DENIED` | Behavior | emit `PERMISSION_DENIED` receipt | app does not fake recovery; denial becomes a persistent visible fact | evidence must preserve permission message and attempt correlation | before: voice request active; after: permission checkpoint | rejoin to permission checkpoint |
| `STORY-002-CHECKPOINT-VOICE-PERMISSION-STAYS-A-FACT` | Checkpoint | assert permission fact | app shows `voiceState: "permission"` and `voiceFailure.type: "voice-permission-denied"` while typed prompt remains allowed | named checkpoint `voice permission stays a fact` | before: permission fact pending; after: `startVoiceCapture: true`, `submitPrompt: true`, `submitVoiceTranscript: false` | rejoin to typed fallback intent |
| `STORY-002-INTENT-SUBMIT-TYPED-FALLBACK` | Intent | `submitPrompt` with text fallback input | typed fallback begins a new turn without clearing the permission fact | command trace records exact text fallback input | before: typed prompt allowed; after: responding turn starts | rejoin to responding checkpoint |
| `STORY-002-CHECKPOINT-TEXT-RECOVERY-STARTS-A-NEW-TURN` | Checkpoint | assert responding turn | app shows `status: "responding"` and `lastFact.type: "prompt-submitted"` with the typed fallback text | named checkpoint `text recovery starts a new turn` | before: waiting for responding state; after: `createArtifact: true`, `completeResponse: false` | terminal pass receipt |

#### `STORY-003` timed out turn retries to an accepted response

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `STORY-003-GIVEN-READY` | Given | wait for idle ready snapshot | app is ready for a typed prompt | `view.status: "ready"`, `submitPrompt: true` | before: Story selection only; after: prompt submission | rejoin to timeout path |
| `STORY-003-INTENT-SUBMIT-FIRST-PROMPT` | Intent | `submitPrompt` timeout pass | first turn starts | first request-model call becomes active | before: submit prompt allowed; after: timeout behavior may occur | rejoin to timeout behavior |
| `STORY-003-BEHAVIOR-TIMEOUT` | Behavior | fire controlled timeout clock | app does not hang; active turn times out deterministically | receipt includes `clock:MODEL_TURN_TIMEOUT_REQUESTED` | before: active turn in flight; after: timeout checkpoint | rejoin to timeout checkpoint |
| `STORY-003-CHECKPOINT-TIMEOUT-RETURNS-IDLE` | Checkpoint | assert timeout terminal | app returns to idle ready state with timeout lifecycle fact | named checkpoint `timeout returns the turn to idle` | before: timeout pending; after: `submitPrompt: true` | rejoin to retry intent |
| `STORY-003-INTENT-SUBMIT-RETRY` | Intent | `submitPrompt` retry input | retry turn starts | second prompt becomes the live turn | before: retry allowed; after: artifact creation may occur | rejoin to artifact intent |
| `STORY-003-INTENT-CREATE-ARTIFACT` | Intent | `createArtifact(timeout-recovery)` | app has an active artifact during the retrying turn | exact artifact id/title/nodes stay visible as ordinary Story truth | before: responding retry turn; after: accepted artifact checkpoint | rejoin to artifact checkpoint |
| `STORY-003-CHECKPOINT-RETRY-CAN-FINISH-WITH-AN-ACCEPTED-ARTIFACT` | Checkpoint | assert responding state with artifact | app is still responding, but artifact `timeout-recovery@1` is now visible and `completeResponse` is allowed | named checkpoint `retry can finish with an accepted artifact` | before: responding retry turn; after: `completeResponse: true` | rejoin to completion intent |
| `STORY-003-INTENT-COMPLETE-RESPONSE` | Intent | `completeResponse` with accepted text | reviewer explicitly accepts the completion text | exact text input stays available for receipt review | before: completion available; after: model acceptance behavior | rejoin to completion behavior |
| `STORY-003-BEHAVIOR-MODEL-TURN-ACCEPTS-THE-RETRY` | Behavior | finish current turn completion | accepted model completion lands | receipts include resolved, authorized, and capability outcomes | before: completion pending; after: final ready checkpoint | rejoin to final checkpoint |
| `STORY-003-CHECKPOINT-ACCEPTED-RETRY-RETURNS-TO-READY` | Checkpoint | assert ready terminal | app returns to ready with accepted response text and retained artifact revision `1` | named checkpoint `accepted retry returns to ready` | before: accepted completion pending; after: `submitPrompt: true` | terminal pass receipt |

#### `STORY-004` stale correlated model receipts stay inert until the live turn ends

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `STORY-004-GIVEN-READY` | Given | wait for idle ready snapshot | app is ready to begin the first turn | `view.status: "ready"`, `submitPrompt: true` | before: select Story; after: first prompt submission | rejoin to first turn intent |
| `STORY-004-INTENT-SUBMIT-FIRST-TURN` | Intent | `submitPrompt("Ignore stale turn receipts.")` | first live turn starts | first correlated model request becomes the stale-risk candidate | before: submit prompt allowed; after: cancellation behavior | rejoin to cancel behavior |
| `STORY-004-BEHAVIOR-CANCEL-FIRST-TURN` | Behavior | actor sends `MODEL_TURN_CANCEL_REQUESTED` for first turn | app cancels the first turn intentionally | cancellation is actor-owned, not a projection trick | before: first turn active; after: cancelled checkpoint | rejoin to first cancel checkpoint |
| `STORY-004-CHECKPOINT-CANCELLED-FIRST-TURN-RETURNS-IDLE` | Checkpoint | assert cancelled first turn | app returns to ready with `lastTurnTerminal.type: "CANCELLED"` for the first turn id | named checkpoint `cancelled first turn returns idle` | before: cancel pending; after: `submitPrompt: true` | rejoin to second turn intent |
| `STORY-004-INTENT-SUBMIT-LIVE-TURN` | Intent | `submitPrompt("Live turn stays in control.")` | second turn becomes the live authoritative turn | lifecycle clears prior terminal marker | before: ready idle; after: responding checkpoint | rejoin to second turn checkpoint |
| `STORY-004-CHECKPOINT-SECOND-TURN-IS-RESPONDING` | Checkpoint | assert live responding turn | app shows `status: "responding"` and `lastTurnTerminal: null` | named checkpoint `second turn is responding` | before: second turn starting; after: stale result may arrive | rejoin to stale behavior |
| `STORY-004-BEHAVIOR-LATE-FIRST-TURN-MODEL-RESULT-ARRIVES` | Behavior | resolve stale first-turn model result | app must not change visible state or yield control to the stale turn | stale receipt is evidence only, not active truth | before: second turn responding; after: inertness checkpoint | rejoin to inertness checkpoint |
| `STORY-004-CHECKPOINT-STALE-PORT-RESULT-STAYS-INERT` | Checkpoint | assert no state change | app remains in the second responding turn and keeps `createArtifact: true` | named checkpoint `stale port result stays inert` | before: stale receipt pending; after: live cancel still available | rejoin to live cancel behavior |
| `STORY-004-BEHAVIOR-CANCEL-LIVE-TURN` | Behavior | actor sends `MODEL_TURN_CANCEL_REQUESTED` for live turn | active live correlation still owns exit | second cancel remains tied to the live turn id | before: second turn responding; after: final live checkpoint | rejoin to final checkpoint |
| `STORY-004-CHECKPOINT-LIVE-CORRELATION-STILL-CONTROLS-EXIT` | Checkpoint | assert final ready state | app returns to ready only because the live turn ended, not because stale results mutated it | named checkpoint `live correlation still controls exit` | before: live cancel pending; after: ready idle | terminal pass receipt |

## Reviewer journey contract

### Reviewer stories

| Reviewer story | Starting condition | Reviewer action | Visible consequence | Maturity |
| --- | --- | --- | --- | --- |
| `REV-001` select an executable Story | Story catalog available | choose one of the executable Stories above | selected Story exposes its exact Story name, page sequence, and evidence posture | designed |
| `REV-002` step page-by-page | Story selected, no controller run in progress | press Step | exactly one executable page is released using the same Given / Intent / Behavior / Checkpoint vocabulary as the source Story | designed |
| `REV-003` run remaining pages | Story selected and idle or paused | press Run | remaining executable pages release in order until the Story reaches its ordinary final receipt | designed |
| `REV-004` go Back by deterministic replay | Story paused or completed | press Back | current session is disposed, rebuilt from a fresh fixture, and replayed to the prior page instead of rewinding in place | designed |
| `REV-005` diagnose failed checkpoint | checkpoint mismatch exists | review failure state and Debug drawer | failed checkpoint becomes the first visible Debug view and ordinary receipt remains intact | designed |
| `REV-006` inspect ordinary receipt | Story completed or failed | open receipt view | ordinary Story receipt stays primary; additive evidence remains secondary | designed |
| `REV-007` inspect XState evidence only on demand | optional lens exists | open Machine tab | topology evidence appears only there and uses exact / candidate / unavailable certainty honestly | designed |
| `REV-008` continue without an XState lens | Story truth exists but lens is unavailable | keep reviewing Story pages and receipt | Story remains fully reviewable with explicit `No XState lens` language | designed |

### Golden walkthrough recommendation

The first design should center one golden walkthrough:

- `STORY-002` / `microphone permission denial recovers to typed prompt`

Why:

- it starts from an ordinary ready Given;
- it contains a clear reviewer Intent;
- it contains an obvious external Behavior;
- it has a named Checkpoint that preserves a fact instead of hiding it;
- it contains a second reviewer Intent that visibly changes product outcome; and
- it ends on a clean responding checkpoint that proves recovery without
  inventing a final completion.

### Bounded reviewer variants

| Variant ID | Based on | What changes for the reviewer shell | What must stay unchanged |
| --- | --- | --- | --- |
| `VAR-001` failed checkpoint auto-opens Debug | `STORY-002` golden walkthrough | same Story flow, but a regression causes a named checkpoint to fail and Debug opens on that checkpoint first | same Story/page vocabulary, same ordinary receipt boundary, same Story remains selected |
| `VAR-002` no XState lens | `STORY-002` or `STORY-001` | Machine evidence is unavailable, but receipt and page flow remain fully reviewable | no fake graph, no downgraded Story truth, explicit `No XState lens` cue |
| `VAR-003` Back by dispose/rebuild/replay | any paused page in the golden walkthrough | Back moves to a prior page through fresh-fixture deterministic replay | no in-place rewind, no silent mutation of snapshots, same page ids and outcomes after replay |
| `VAR-004` stale-suppression evidence | `STORY-004` | Debug and evidence surfaces explain why a stale result stayed inert | stale receipt never becomes active application truth |

### Reviewer page tables

#### Golden walkthrough: `REV-002-GOLDEN` over `STORY-002`

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `REV-002-PAGE-01` | Given | `STORY-002-GIVEN-READY` | selected Story shows a ready workbench with voice idle and typed prompt available | truth panel names the exact executable Story and starting `canExecute` posture | before: select Story; after: Step or Run | rejoin to first intent |
| `REV-002-PAGE-02` | Intent | `STORY-002-INTENT-START-VOICE` | reviewer sees that voice capture was explicitly requested | page explains this is a Story Intent, not yet a checkpoint | before: Step/Run; after: next Step reveals permission outcome | rejoin to denial behavior |
| `REV-002-PAGE-03` | Behavior | `STORY-002-BEHAVIOR-PERMISSION-DENIED` | app visibly preserves the permission denial instead of swallowing it | evidence notes correlated permission receipt and the denial message | before: voice request active; after: Checkpoint page | rejoin to first checkpoint |
| `REV-002-PAGE-04` | Checkpoint | `STORY-002-CHECKPOINT-VOICE-PERMISSION-STAYS-A-FACT` | reviewer sees permission remain visible while typed prompt stays available | named checkpoint is shown literally: `voice permission stays a fact` | before: next Step or Run; after: typed fallback intent | rejoin to second intent |
| `REV-002-PAGE-05` | Intent | `STORY-002-INTENT-SUBMIT-TYPED-FALLBACK` | reviewer sees that typed fallback, not voice retry, started the next turn | exact fallback input is inspectable in ordinary Story terms | before: typed prompt available; after: next Step reveals responding checkpoint | rejoin to second checkpoint |
| `REV-002-PAGE-06` | Checkpoint | `STORY-002-CHECKPOINT-TEXT-RECOVERY-STARTS-A-NEW-TURN` | application visibly moves to responding while the permission fact remains in view | named checkpoint is shown literally: `text recovery starts a new turn` | before: awaiting turn start; after: receipt review, Back replay, optional Machine tab | terminal pass or rejoin to review surfaces |

#### Variant: failed checkpoint over the same Story

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `REV-FAIL-01` | Checkpoint | same page position as `REV-002-PAGE-04` or `REV-002-PAGE-06`, but assertion fails | application keeps the selected Story and current page visible while the failure state appears | Debug auto-opens on the failed checkpoint first; ordinary receipt remains available | before: Step/Run; after: Debug, Back, Restart, receipt review | recoverable terminal; may rejoin via Back or Restart |

#### Variant: no XState lens

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `REV-NOLENS-01` | Evidence mode | same executable Story pages as the golden walkthrough | reviewer can finish the same Story review without topology proof | Machine tab says `No XState lens`; ordinary Story pages and receipt stay unchanged | before: receipt review only; after: continue Story review normally | rejoins the same Story pages |

#### Variant: Back via fresh-fixture deterministic replay

| Page ID | Phase | Source operation | Reviewer-visible application outcome | Checkpoint / evidence summary | Permitted controls before / after | Terminal or rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `REV-BACK-01` | Replay | reviewer presses Back from a paused or completed page | shell disposes current session, rebuilds a fresh fixture, and replays to the prior page | evidence says replay occurred; it never implies in-place rewind | before: Back available; after: Step/Run resume from the restored prior page | rejoins the earlier Story page |

## Design gate for the next visual round

No further MagicPath iteration should proceed until the reviewer shell is
designed from the page ids, checkpoint names, and exact Story outcomes above.
Later visual work may simplify hierarchy, but it must not invent substitute
domain content or collapse the two-layer contract into a controller-only mock.
