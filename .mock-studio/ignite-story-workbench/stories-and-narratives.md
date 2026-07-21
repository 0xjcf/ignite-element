# Ignite Alchemy Stories and Narratives

Status: narrative gate before further visual iteration
Recorded: 2026-07-21
Task: `direct-1784661171192` / `task-1784655399770`
Product: Ignite Alchemy
Category: Story Workbench

Ignite Alchemy is the product being designed. Its job is to help an operator
review deterministic executable Stories without pretending to be the Voice
Workbench application itself. This document therefore separates authority into
two layers:

1. Product/operator authority: Ignite Alchemy user stories and narratives,
   identified as `ALCH-US-*` and `ALCH-NAR-*`, define what the operator sees,
   what controls exist, and what review branches the product must support.
2. Subject-fixture authority: selected executable Stories, identified here as
   `STORY-*`, define the preview truth, checkpoints, command availability, and
   final receipts that Ignite Alchemy is allowed to present.

The product may sequence, step, replay, and contextualize review. It may not
replace the subject-fixture truth with a new domain, a second lifecycle writer,
or synthetic certainty.

## Scope and authority

- Ignite Alchemy owns the operator journey, review shell, control policy, and
  receipt-first evidence presentation.
- `igniteTest({ component }).story(...)` remains authoritative for subject
  Story names, page order, commands, checkpoints, `canExecute` posture, and
  final receipts.
- Existing Voice Workbench XState machines remain authoritative for turn,
  capture, timeout, cancellation, permission, and stale-suppression behavior.
- Optional Machine and Coverage surfaces remain additive product evidence, not
  replacements for the ordinary Story receipt.
- Controlled Step, Run, Back replay, failure-first Debug, and no-lens review
  are Ignite Alchemy product responsibilities even when their implementation is
  still designed rather than shipped.

## Product stories

These are the stable user stories for Ignite Alchemy itself.

| Product story ID | User story | Outcome the product must provide | Bound fixture families | Maturity |
| --- | --- | --- | --- | --- |
| `ALCH-US-001` | As a reviewer, I can select a deterministic Story and understand what subject fixture I am about to inspect. | Story choice, fixture summary, and review posture are visible before execution starts. | `STORY-001` to `STORY-004` | designed |
| `ALCH-US-002` | As a reviewer, I can step or run the selected Story while keeping Given, Intent, Behavior, and Checkpoint phases legible. | The product reveals one page at a time or the full remainder without changing subject truth. | `STORY-001` to `STORY-004` | designed |
| `ALCH-US-003` | As a reviewer, I can diagnose a failed checkpoint without losing the selected Story or ordinary receipt. | Debug opens on failure first, but the same selected fixture remains authoritative. | any selected `STORY-*` | designed |
| `ALCH-US-004` | As a reviewer, I can move backward safely by replaying from a fresh fixture instead of rewinding state in place. | Back is explicit deterministic replay with a rejoin point. | any selected `STORY-*` | designed |
| `ALCH-US-005` | As a reviewer, I can finish a review even when additive Machine evidence is missing. | No-lens review still preserves full Story and receipt truth. | `STORY-001` or `STORY-002` initially | designed |
| `ALCH-US-006` | As a reviewer, I can inspect advanced stale or timeout evidence without confusing it for active application truth. | Additive evidence stays secondary to the selected Story outcome. | `STORY-003`, `STORY-004` | designed |

## Product narratives

`ALCH-NAR-*` identifiers are the primary narrative contract for product design.
Each narrative binds to one or more `STORY-*` fixtures for application preview
and receipt evidence.

| Narrative ID | Product narrative | Product intent | Bound `STORY-*` evidence | Terminal / rejoin | Maturity |
| --- | --- | --- | --- | --- | --- |
| `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW` | Golden product walkthrough | reviewer discovers executable Stories, selects one, steps one page, runs the remainder, then verifies the deterministic receipt and changed command availability | `STORY-002` as the golden subject fixture | terminal pass into receipt review | designed over implemented fixture |
| `ALCH-NAR-002-FAILED-CHECKPOINT-DEBUG` | Failure-first Debug branch | failed checkpoint auto-opens Debug while the selected Story remains visible and ordinary receipt stays available | selected `STORY-*`, initially `STORY-002` | recoverable terminal, rejoins via Back or Restart | designed |
| `ALCH-NAR-003-BACK-REPLAY` | Fresh-fixture deterministic replay branch | Back disposes the current run, rebuilds a fresh fixture, and rejoins the prior page without in-place rewind | any selected `STORY-*` page | rejoins the restored prior page | designed |
| `ALCH-NAR-004-NO-LENS-REVIEW` | Full review without Machine proof | product keeps Story pages and receipt fully reviewable while Machine evidence is explicitly unavailable | selected `STORY-001` or `STORY-002` | rejoins the same review flow | designed |
| `ALCH-NAR-005-ADVANCED-ADDITIVE-EVIDENCE` | Timeout and stale-evidence branch | advanced receipts remain inspectable but never become active product truth | `STORY-003`, `STORY-004` | terminal review or rejoins live-turn exit | designed |

## Subject-fixture portfolio

These executable Stories are the subject matter Ignite Alchemy reviews. They
are not the product narratives themselves.

| Story ID | Executable Story | Why this fixture matters | Commands | Named checkpoints | Final view / receipt posture | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| `STORY-001` | `preparation failure retries into ready` | clean retry-to-ready recovery path and simplest pass receipt | `beginModelPreparation` | `ready after retry` | final view returns to `status: "ready"` with `model.status: "available"` and `submitPrompt: true` | implemented |
| `STORY-002` | `microphone permission denial recovers to typed prompt` | golden subject fixture because it clearly spans Given, Intent, Behavior, Checkpoint, second Intent, and second Checkpoint | `startVoiceCapture`, `submitPrompt` | `voice permission stays a fact`, `text recovery starts a new turn` | final view stays `status: "responding"` while `voiceState: "permission"` remains visible | implemented |
| `STORY-003` | `timed out turn retries to an accepted response` | timeout, retry, artifact creation, and accepted completion as ordinary deterministic truth | `submitPrompt`, `createArtifact`, `completeResponse` | `timeout returns the turn to idle`, `retry can finish with an accepted artifact`, `accepted retry returns to ready` | final view returns to `status: "ready"` with accepted response text and retained artifact revision `1` | implemented |
| `STORY-004` | `stale correlated model receipts stay inert until the live turn ends` | additive stale-evidence branch and live-correlation proof | `submitPrompt` plus actor-owned cancel events | `cancelled first turn returns idle`, `second turn is responding`, `stale port result stays inert`, `live correlation still controls exit` | final view returns to `status: "ready"` only when the live turn ends | implemented |

## Subject-fixture truth register

| Story ID | Executable Story | Starting view and `canExecute` | Commands actually issued by the fixture | Reviewer-visible page truth | Final view / `canExecute` truth |
| --- | --- | --- | --- | --- | --- |
| `STORY-001` | `preparation failure retries into ready` | Given waits for `snapshot.matches("unavailable")`, `view.status: "failed"`, `model.status: "failed"`, `submitPrompt: false` | `beginModelPreparation` | one retry intent, one external availability behavior, one ready checkpoint | `status: "ready"`, `model.status: "available"`, `submitPrompt: true`, `startVoiceCapture: true` |
| `STORY-002` | `microphone permission denial recovers to typed prompt` | Given waits for `available.turn.idle`, `view.status: "ready"`, `voiceState: "idle"`, `startVoiceCapture: true`, `submitPrompt: true` | `startVoiceCapture`, `submitPrompt` with `{ modality: "text", text: "Continue with text fallback." }` | microphone denial remains a fact, then typed prompt starts a new responding turn | `status: "responding"`, `voiceState: "permission"`, `createArtifact: true`, `completeResponse: false` |
| `STORY-003` | `timed out turn retries to an accepted response` | Given waits for `available.turn.idle`, `view.status: "ready"`, `submitPrompt: true` | `submitPrompt` timeout pass 1, `submitPrompt` retry pass 2, `createArtifact`, `completeResponse` | timeout returns idle, retry keeps responding with artifact revision `1`, accepted completion returns ready | `status: "ready"`, `response.text: "Recovered after timeout."`, retained artifact `timeout-recovery@1`, `submitPrompt: true` |
| `STORY-004` | `stale correlated model receipts stay inert until the live turn ends` | Given waits for `available.turn.idle`, `view.status: "ready"`, `submitPrompt: true` | `submitPrompt` first turn, actor-owned cancel, `submitPrompt` live turn | stale first-turn result must not move the live turn or overwrite lifecycle | live turn remains authoritative until its own cancel returns `status: "ready"` |

## Golden product walkthrough

The product golden walkthrough is `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW`.
Its bound subject fixture is `STORY-002`, not because Ignite Alchemy is a Voice
Workbench redesign, but because that fixture best demonstrates the product's
review value.

Acceptance evidence for this gate includes the user direction from this review
cycle to "correct the documents and then proceed," which explicitly authorizes
the clarified product narrative to become the design gate before more visual
iteration.

### `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW` over `STORY-002`

| Product page ID | Product phase | Bound fixture page | Reviewer-visible product outcome | Fixture evidence shown in preview / receipt | Controls before / after | Terminal / rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `ALCH-NAR-001-PAGE-01` | Discover | `STORY-002-GIVEN-READY` | reviewer sees the Story catalog, selects the microphone-denial fixture, and understands that the preview is ready for review | exact Story name, starting `view.status: "ready"`, `voiceState: "idle"`, `startVoiceCapture: true`, `submitPrompt: true` | before: Story selection; after: Step or Run | rejoin to first review release |
| `ALCH-NAR-001-PAGE-02` | Step | `STORY-002-INTENT-START-VOICE` | one page is released and the operator sees that voice capture was explicitly requested | command trace shows `startVoiceCapture` | before: Step / Run; after: next Step reveals permission result | rejoin to behavior |
| `ALCH-NAR-001-PAGE-03` | Review | `STORY-002-CHECKPOINT-VOICE-PERMISSION-STAYS-A-FACT` | the product keeps the permission fact visible and shows that typed prompt remains available | named checkpoint `voice permission stays a fact`; `voiceState: "permission"` and `submitPrompt: true` remain visible | before: Step / Run; after: Run may continue the remaining pages | rejoin to remainder run |
| `ALCH-NAR-001-PAGE-04` | Run remainder | `STORY-002-INTENT-SUBMIT-TYPED-FALLBACK` then `STORY-002-CHECKPOINT-TEXT-RECOVERY-STARTS-A-NEW-TURN` | the operator runs the remaining pages and sees the application preview move into the new responding turn without clearing the permission fact | exact fallback text, named checkpoint `text recovery starts a new turn`, `createArtifact: true`, `completeResponse: false` | before: Run available; after: receipt review, Back replay, Debug, Machine if present | terminal pass into receipt review |
| `ALCH-NAR-001-PAGE-05` | Verify receipt | Story terminal receipt | the operator verifies the deterministic final receipt and changed command availability for the selected fixture | final view remains `status: "responding"`, `voiceState: "permission"`, `createArtifact: true`, `completeResponse: false` | before: receipt closed; after: Back, Restart, open additive evidence | terminal review state |

## Material product branches

Every material branch belongs to Ignite Alchemy first and binds to fixture
truth second.

| Narrative branch ID | Product branch | Bound `STORY-*` evidence | Required product behavior | Rejoin / terminal |
| --- | --- | --- | --- | --- |
| `ALCH-NAR-002-FAILED-CHECKPOINT-DEBUG` | failed checkpoint auto-opens Debug | same selected fixture page where the assertion fails, initially from `STORY-002` | Debug opens on the failed checkpoint first while the selected Story, preview, and ordinary receipt remain intact | recoverable terminal; rejoin via Back or Restart |
| `ALCH-NAR-003-BACK-REPLAY` | Back performs fresh-fixture deterministic replay | any selected fixture page | dispose current review run, rebuild a fresh fixture, replay deterministically to the prior page, then continue from there | rejoins restored prior page |
| `ALCH-NAR-004-NO-LENS-REVIEW` | no-lens review retains full Story and receipt truth | selected `STORY-001` or `STORY-002` without Machine evidence | Machine tab says `No XState lens` while Story review and receipt remain complete | rejoins same Story review |
| `ALCH-NAR-005-ADVANCED-ADDITIVE-EVIDENCE` | advanced stale evidence remains additive | `STORY-003` timeout receipts and `STORY-004` stale-result receipts | advanced receipts may be inspected in Debug or evidence tabs but never replace active application truth | terminal review or rejoin to live-turn exit |

## Product-to-fixture traceability

| Product narrative | Operator-facing promise | Bound subject fixture truth | What the product may project | What the product may not invent |
| --- | --- | --- | --- | --- |
| `ALCH-NAR-001-DETERMINISTIC-STORY-REVIEW` | deterministic story review with Step and Run | `STORY-002` page order, checkpoints, command availability, and final receipt | Story catalog, page lane, application preview, receipt-first review surface | substitute application domain or a different checkpoint vocabulary |
| `ALCH-NAR-002-FAILED-CHECKPOINT-DEBUG` | failure-first diagnosis | failing selected fixture checkpoint | Debug drawer, failure framing, ordinary receipt side-by-side | synthetic success receipt or automatic fixture mutation |
| `ALCH-NAR-003-BACK-REPLAY` | safe backward navigation | same selected fixture replayed from scratch | replay status, restored prior page, deterministic audit note | in-place rewind or hidden state scrub |
| `ALCH-NAR-004-NO-LENS-REVIEW` | complete review with missing Machine evidence | same selected fixture pages and receipt | explicit `No XState lens` messaging | fake graph or downgraded Story truth |
| `ALCH-NAR-005-ADVANCED-ADDITIVE-EVIDENCE` | additive advanced evidence | `STORY-003` and `STORY-004` timeout / stale receipts | secondary Machine, Debug, or Coverage context | stale evidence becoming active product truth |

## Design gate for the next visual round

No further MagicPath iteration should proceed until the reviewer shell is
designed from the `ALCH-US-*` and `ALCH-NAR-*` product contract above, with
selected `STORY-*` fixtures supplying preview and receipt truth underneath it.
Later visual work may simplify layout, but it must not collapse Ignite Alchemy
into a redesign of the Voice Workbench subject application.
