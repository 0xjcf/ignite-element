# Implementation handoff — Voice + text artifact workbench

Status: architecture amendment prepared from the live implementation and human-approved on 2026-07-17. The visual baseline remains approved from 2026-07-13, and downstream tasks may use this amended contract.

## Scope of this Gate 0 amendment

This handoff replaces two stale claims in the older Mock Studio contract:

- The public component schema is not a five-command surface. The live `igniteCore(...)` component exposes 19 public commands.
- The session machine is not a ready/responding-only actor. The live implementation is a parent-supervised compound statechart with model-turn, voice-capture, and speech-delivery child actors.

This document is architecture-only. It preserves the approved visual hierarchy, tokens, responsive anatomy, and parity harness as the current presentation baseline.

## Live source of truth

- Parent session statechart: `examples/agents/voice-workbench/src/session.ts`
- Model-turn child machine: `examples/agents/voice-workbench/src/model-turn.ts`
- Voice-capture child machine: `examples/agents/voice-workbench/src/voice.ts`
- Speech-delivery child machine: `examples/agents/voice-workbench/src/speech.ts`
- Public command blueprint: `examples/agents/voice-workbench/src/workbench-component.ts`
- View projection and command availability: `examples/agents/voice-workbench/src/workbench-view.ts`
- Host runtime port wiring: `examples/agents/voice-workbench/src/workbench-runtime.ts`

## Product intent

The example still proves one Ignite component can keep actor-owned conversation and artifact state authoritative while serving:

- headless tests,
- typed model tools,
- accessible browser JSX,
- terminal preview, and
- speech delivery.

The important contract is now narrower and more explicit:

- Text and speech converge only at `submitPrompt({ modality, text })`.
- The model proposes only from the current availability-scoped manifest.
- The parent session machine authorizes when turns start and end.
- Reducers remain authoritative for aggregate conversation and artifact data.
- Browser, terminal, and speech remain independent projections or adapters of accepted facts.

## Actor topology

### Parent session machine

The live parent machine is `conversation-session` with this exact state shape:

```text
"preparing"
"unavailable"
{
  available: {
    turn: "idle" | "responding",
    voice: "active",
    speech: "idle" | "delivering"
  }
}
```

`available` is a parallel state with three fixed child regions:

- `turn`
- `voice`
- `speech`

The responding turn invokes `model-turn`, the persistent voice region invokes `voice-capture`, and the delivery region invokes `speech-delivery`.

### Child machines

`model-turn`

- Owns attempt identity, round counting, model request, authorization, capability execution, cancellation, timeout, and terminal status.
- Terminal outputs: `TURN_COMPLETED`, `TURN_FAILED`, `CANCELLED`, `TIMEOUT`, `ROUND_LIMIT_REACHED`.

`voice-capture`

- Owns `checking`, `unsupported`, `unavailable`, `idle`, `listening`, `transcript`, `consumed`, `cancelled`, `permission-denied`, `failed`, `disposed`.
- Correlates browser receipts by `attemptId`.

`speech-delivery`

- Owns `pending`, `queued`, `delivered`, `muted`, `unavailable`, `failed`, `cancelled`, `disposed`.
- Separates queued playback from completed playback and returns terminal facts through XState output.

## Public commands vs model manifest

### All public component commands

The live component blueprint exposes exactly 19 public commands:

1. `acknowledgeSpeech`
2. `beginModelPreparation`
3. `cancelVoiceCapture`
4. `changeArtifactView`
5. `changeDraft`
6. `changeMobilePanel`
7. `changeSpeechPreference`
8. `completeResponse`
9. `createArtifact`
10. `playSpeech`
11. `replay`
12. `restoreArtifactRevision`
13. `reviseArtifact`
14. `selectArtifact`
15. `selectRuntimePreview`
16. `setChecklistItem`
17. `startVoiceCapture`
18. `submitPrompt`
19. `submitVoiceTranscript`

Command count is projected from `component.getSchema().commands` and asserted as `19` in `workbench-view.test.ts`.

### Availability-gated commands

The view separately projects availability for 11 commands:

- `acknowledgeSpeech`
- `cancelVoiceCapture`
- `completeResponse`
- `createArtifact`
- `restoreArtifactRevision`
- `reviseArtifact`
- `selectArtifact`
- `setChecklistItem`
- `startVoiceCapture`
- `submitPrompt`
- `submitVoiceTranscript`

### Model-tool manifest

The model does not receive the full 19-command blueprint. The live runtime inspector already distinguishes:

- `All-component blueprint`
- `Availability-scoped model manifest`

The current implementation narrows the model-facing surface per turn. At minimum, the component marks these as `channel: "model-intent"`:

- `completeResponse`
- `createArtifact`
- `reviseArtifact`
- `setChecklistItem`

This is the right architecture boundary to preserve in follow-on work: user-intent and presentation commands stay public for hosts without becoming model tools.

## Lifecycle and ownership matrix

| Surface | Single owner | Representation | Live maturity |
| --- | --- | --- | --- |
| Session readiness and turn supervision | `voiceWorkbenchSessionMachine` | parent statechart | Implemented |
| Model-turn orchestration | `modelTurnMachine` | child statechart | Implemented |
| Voice capture lifecycle | `voiceCaptureMachine` | child statechart | Implemented |
| Speech delivery lifecycle | `speechDeliveryMachine` | child statechart | Implemented |
| Conversation and artifacts | `reduceConversationSession` | pure reducer | Implemented |
| Presentation state | `reduceWorkbenchPresentation` | pure reducer | Implemented |
| Domain policy outcomes | domain pack policies | typed facts | Implemented |
| Capability execution outcomes | capability ports | typed facts | Implemented |
| Browser document commit receipt | private adapter event | read-model fact | Implemented |
| Visual hierarchy, tokens, responsive anatomy | Mock Studio parity baseline | retained visual contract | Retained |

`voiceWorkbenchLifecycleOwnership` in `session.ts` already encodes this ownership table and is asserted in `session.headless.test.ts`.

## Raw snapshot and native metadata contract

The portable architecture contract is:

- serializable `snapshot.value`
- serializable `snapshot.context`
- relevant native lifecycle metadata:
  - `status`
  - `output`
  - `error`
  - `tags`
  - child identity and child status

The handoff should not treat these XState internals as portable state data:

- machine internals
- methods
- `_nodes`
- `can`
- `getMeta`
- `matches`
- `toJSON`

The current view intentionally exposes raw lifecycle state under `view.lifecycle` and `view.runtimeInspector.activeStates`, while keeping executable machine internals out of the public architectural contract.

## Event, guard, effect, fact, and host map

### Public intent and lifecycle events

Conversation actions:

- `SUBMIT_PROMPT`
- `CREATE_ARTIFACT`
- `REVISE_ARTIFACT`
- `RESTORE_ARTIFACT_REVISION`
- `SELECT_ARTIFACT`
- `SET_CHECKLIST_ITEM`
- `COMPLETE_RESPONSE`
- `ACKNOWLEDGE_SPEECH`

Host and child-driving intent:

- `MODEL_PREPARATION_STARTED`
- `VOICE_CAPTURE_START_REQUESTED`
- `VOICE_CAPTURE_CANCEL_REQUESTED`
- `VOICE_TRANSCRIPT_SUBMIT_REQUESTED`
- `SPEECH_DELIVERY_REPLAY_REQUESTED`

Port correlation events:

- `MODEL_PREPARATION_PORT_RECEIVED`
- `MODEL_TURN_PORT_RECEIVED`
- `VOICE_CAPTURE_PORT_RECEIVED`
- `SPEECH_DELIVERY_PORT_RECEIVED`
- `MODEL_TURN_TIMEOUT_REQUESTED`
- `MODEL_TURN_CANCEL_REQUESTED`

Read-model and adapter facts:

- `DOCUMENT_COMMITTED`
- `CAPABILITY_OUTCOME_RECORDED`
- `DOMAIN_POLICY_RECORDED`
- `RUNTIME_MANIFEST_RECORDED`
- `TURN_RECORDED`
- `PRESENTATION_UPDATED`

### Key guards and invariants

- `parentPortEventAccepted` rejects stale or mis-correlated host receipts.
- `voicePromptReady` is the authoritative gate into `available.turn.responding`.
- `voiceCaptureStartAccepted` and `voiceTranscriptCandidateAccepted` keep transcript flow child-owned until a final candidate exists.
- `completionCanStage` keeps `COMPLETE_RESPONSE` staged and correlated rather than immediately mutating aggregate state.
- `respondingRequiresAvailable` and `hasNoKnownForbiddenState` are exported invariants and exercised by graph tests.

### Effects and host ownership

- `workbench-runtime.ts` owns model preparation, model-turn, voice-capture, and speech-delivery port execution.
- Browser capture and speech APIs remain host adapters that return correlated receipts.
- Renderers consume projected values only. They do not own workflow transitions, IDs, retries, or authorization.

## Source-of-truth matrix

| Concern | Authority |
| --- | --- |
| Session readiness and active-turn admission | parent session statechart |
| Turn attempt ID and round progression | `model-turn` child |
| Aggregate messages, revisions, artifacts, speech facts | conversation reducer |
| Draft, panel, artifact-view, runtime-preview, replay count, speech preference | presentation reducer |
| Live model manifest snapshot | read-model fact recorded into presentation |
| Domain policy decision | typed domain-policy fact |
| Capability result, retry, cache, fallback, proof rows | typed capability fact |
| Voice transcript candidate | `voice-capture` child lifecycle projection |
| Speech queued, delivered, muted, unavailable, failed, cancelled | `speech-delivery` child lifecycle projection |
| Browser document commit receipt | adapter fact recorded into presentation |
| Human visual baseline | retained Mock Studio parity baseline |

## State-to-screen matrix

| Live state or fact | Screen or inspector proof |
| --- | --- |
| `preparing` | status `Preparing local model`; prompts gated |
| `unavailable` | status `Model unavailable`; retry path visible |
| `available.turn.idle` | status `Ready`; prompt and capture affordances available |
| `available.turn.responding` | status `Responding`; trace and model activity visible |
| `voice.listening` | transcript capture UI and live voice state |
| `voice.transcript` | transcript preview plus `submitVoiceTranscript` availability |
| `voice.permission-denied` | visible voice failure and text-path recovery |
| `voice.failed` | visible voice error and retry path |
| `speech.pending` | aggregate speech awaiting adapter acknowledgement |
| `speech-delivery.queued` | queued playback fact before completion |
| `speech-delivery.delivered` | speech commit status `played` |
| `speech-delivery.muted` | speech commit status `muted` |
| `speech-delivery.unavailable` | speech commit status `unavailable` |
| `speech-delivery.failed` | adapter failure retained as unavailable-style commit proof |
| `speech-delivery.cancelled` | child terminal captured without claiming playback |
| document commit fact | browser receipt card with artifact revision |
| runtime manifest fact | live manifest card separate from blueprint commands |
| stale or rejected artifact action | `artifact-rejected` fact in trace/runtime evidence |

## Failure, recovery, and stale-receipt receipts

The live implementation already proves these architecture behaviors:

- stale voice receipts are ignored unless `attemptId` matches the active child;
- stale model-preparation receipts are fenced across retry sequences;
- stale or mismatched model-turn receipts are rejected unless `turnId` and `attemptId` match the current request;
- cancellation and timeout return the responding turn to idle through child output, not ad hoc parent mutation;
- replay replaces the speech-delivery child and allocates a fresh `requestSequence`;
- speech acknowledgement is separate from queued and delivered adapter facts.

## Reuse, move, retire

### Reuse unchanged

- Mock Studio visual hierarchy
- token system
- responsive layout
- parity harness states and measurements

### Keep but reframe

- product proof chain
- runtime teaching rail
- browser, terminal, and speech projection concept

### Retire as stale

- exact five-command headless contract claim
- ready/responding-only machine sketch
- statement that microphone, playback, tabs, and replay are outside the component command surface

### Move into downstream implementation slices

- any renderer or host cleanup driven by this architectural clarification
- any manifest-copy or wording cleanup in browser/runtime UI
- any follow-on extraction of ports, reducers, or domain packs

## Maturity labels

- Implemented: compound parent statechart, fixed child topology, command blueprint, command availability, runtime manifest/read-model separation, stale-receipt guards, parity harness baseline.
- Retained: approved visual baseline and responsive anatomy from 2026-07-13.
- Deferred: any new UI mutation, host redesign, or public API reshaping not already in the live source.

## Verification receipts

Architecture receipts used for this amendment:

- `examples/agents/voice-workbench/src/workbench-view.test.ts`
  - asserts the exact 19-command blueprint
  - asserts projected command availability matches `canExecute`
- `examples/agents/voice-workbench/src/session.headless.test.ts`
  - proves persistent voice child correlation and transcript submission
  - proves speech-delivery replay replacement and terminal receipt handling
  - asserts lifecycle ownership is executable and target-aligned
- `examples/agents/voice-workbench/src/session.graph.test.ts`
  - asserts the compound parallel topology
  - verifies reachable deterministic lifecycle vertices
  - verifies zero known forbidden reachable states
- `examples/agents/voice-workbench/src/workbench-runtime.test.ts`
  - verifies bounded request-key tracking and cleanup
  - verifies parent-owned terminal paths release the model-turn routing lease

## Approval gate

This amended handoff completed human review on 2026-07-17.

- Visual baseline: approved and retained from 2026-07-13
- Architecture amendment: approved on 2026-07-17
- Downstream decision: use this live-implementation-aligned Gate 0 contract instead of the stale five-command and ready/responding-only claims
