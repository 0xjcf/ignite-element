# Implementation handoff — Voice + text artifact workbench

Status: Round 2 human-approved for implementation on 2026-07-13. This is the Mock Studio to POC/MVP handoff contract.

## Product intent

The example should demonstrate that one literal callable value returned by `igniteCore(...)` can keep a deterministic, headless actor as the source of truth while serving headless tests, typed model tools, accessible browser JSX, terminal text, and speech projection targets.

The interface must remain a real example rather than decorative marketing UI:

- Text and speech enter the same conversation domain with an explicit modality.
- Speech capture is an input adapter; speech synthesis is an output adapter.
- The artifact canvas renders the existing semantic node contract.
- Runtime evidence is derived from Ignite view data and public component events, not a parallel state store.
- No wrapper may obscure `igniteCore`, `component(...)`, `igniteTools(component)`, or the direct projection targets.
- The model proposes tool calls from the filtered `getSchema()` manifest; the consumer-owned actor validates, authorizes, and persists them.
- Browser, terminal, and speech commits are independent consumers of the same accepted actor facts. Terminal and speech require no DOM.
- The center artifact is the primary observable proof: every accepted text or speech-authored revision must visibly change its semantic content, revision label, schema, and browser commit receipt.

### Proof contract

The production example is successful only when this causal chain is real:

```text
text or speech transcript
  → submitPrompt({ modality, text })
  → model proposes reviseArtifact from getSchema()
  → actor validates and stores revision N+1
  → Ignite view exposes the revised semantic artifact
  → browser document + terminal text + speech audio commit revision N+1
```

The static prototype demonstrates this with a deterministic adoption-plan fixture: both Send and Use transcript advance revision 2 to revision 3, append the prompt and response to the conversation, add a visible semantic `plan` node to the center document and schema, and update the browser commit receipt. This fixture is not evidence of a live model or production `igniteCore` integration; the implementation must prove that boundary with `igniteTest` and the headless runtime before projection parity is accepted.

### POC to MVP implementation contract

- Fresh load begins with an empty actor-owned conversation, no artifact, and revision 0. Prototype ids, titles, nodes, messages, counts, responses, and revisions are never runtime defaults.
- The live path uses the SDK-free OpenAI-compatible dialect around `igniteTools(component, openai)`. Consumers supply the MLX base URL and model; Ignite does not start, stop, discover, or supervise the provider.
- Text and microphone transcripts converge only at `submitPrompt({ modality, text })`. Microphone capture, denial, cancellation, and transcription remain capability-gated outer-adapter state; they do not add actor commands or states.
- The model receives only `createArtifact`, `reviseArtifact`, and `completeResponse`. `submitPrompt` stays application-owned and `acknowledgeSpeech` stays projection-owned.
- Every renderer-supported semantic node has a complete model schema and deterministic domain validator. Invalid, partial, stale, or non-allowlisted proposals become visible rejection facts and never reach the renderer.
- The center document changes only after the actor accepts a create or revision command. Schema, trace, statistics, and browser/terminal/speech receipts derive from the same component view, events, tool results, and projection callbacks.
- Deterministic scripted-model and voice fakes are the CI contract. Live MLX, microphone, transcription, and speech synthesis are optional manual validation paths with explicit unavailable and permission-denied states.
- Production parity covers ready, listening, responding, artifact, permission, and visible provider-error states without copying the prototype fixture store.

## Approved design source

- Prototype: `source/index.html`
- Tokens: `source/tokens.css`
- Addressable states: `#ready`, `#listening`, `#responding`, `#artifact`, `#permission`
- Profile: desktop primary at 1440×900 and 1280×800; tablet/mobile verification at 768×900 and 390×844.

## Interaction contract

The public component schema remains exactly the five commands already proven by `igniteTest`: `submitPrompt`, `createArtifact`, `reviseArtifact`, `completeResponse`, and `acknowledgeSpeech`.

| Control | Intent | Component command or adapter boundary | Status |
| --- | --- | --- | --- |
| Prompt textarea + Send | Submit typed prompt | `submitPrompt({ modality: "text", text })` | Designed |
| Microphone | Begin ephemeral browser speech capture | Outer browser adapter; no component command | Designed; optional live adapter |
| Cancel capture | Abort capture without losing typed draft | Outer browser adapter local state | Designed |
| Use transcript | Admit captured transcript as a speech prompt | `submitPrompt({ modality: "speech", text: transcript })` | Designed |
| Speak responses | Enable or suppress automatic host playback | Speech target/host preference; no component command | Designed |
| Play/pause summary | Control browser playback of the committed speech request | Speech target/host adapter; no component command | Designed |
| Document/Schema tabs | Switch the local representation of the same artifact | Projection-local presentation state | Designed |
| Mobile workbench tabs | Select Conversation, Artifact, or Runtime regions | Projection-local presentation state | Designed |
| Replay last turn | Animate already-recorded causal evidence | Mock/example projection state; never a model tool | Designed |

## Machine sketch

The actor state shape stays exactly as implemented:

```text
conversation-session
├─ ready
└─ responding
```

The existing domain transitions for `SUBMIT_PROMPT`, artifact create/revise, response completion, and speech acknowledgement remain authoritative. Round 2 does not add microphone, playback, tab, or replay events to the conversation actor.

The prototype’s `listening`, `permission`, `artifact`, and mobile-panel states are adapter or projection states, not new `conversation-session` states. The browser capture adapter may manage short-lived `idle | listening | permissionDenied` state locally. Its only domain handoff is the existing `submitPrompt` command after a transcript exists.

Browser I/O belongs behind explicit outer adapters. The speech projection target commits playback and acknowledges the current speech request; terminal and document targets consume the same actor-owned facts independently.

### View and command collision pre-flight

| View fields — nouns/state | Commands — verbs |
| --- | --- |
| `status`, `statusLabel` | `submitPrompt` |
| `speech`, `response` | `acknowledgeSpeech` |
| `artifacts`, `activeArtifactId` | `createArtifact`, `reviseArtifact` |
| `revision`, `messageCount`, `canSubmitPrompt`, `canRevise` | `completeResponse` |

Confirmed: command names are disjoint from view fields.

## Coverage matrix

| Actor / adapter state | Ready workbench | Speech capture | Responding overlay | Committed artifact | Permission recovery |
| --- | --- | --- | --- | --- | --- |
| Actor `ready` + adapter `idle` | designed | n/a | n/a | designed | n/a |
| Actor `ready` + adapter `listening` | n/a | designed | n/a | n/a | n/a |
| Actor `ready` + adapter `permissionDenied` | designed | n/a | n/a | n/a | designed |
| Actor `responding` | n/a | n/a | designed | designed after accepted commit | n/a |
| Actor `ready` + acknowledged speech | designed | n/a | n/a | designed | n/a |
| unrecoverable error | deferred; follow existing example error contract if added | deferred | deferred | deferred | n/a |

## Production translation

Target stack: the repository’s current `ignite-element/xstate`, Ignite JSX renderer, and XState v5 actor. The local source remains canonical for API shape; do not translate the prototype into React or add a projection wrapper.

Implementation outline:

1. Preserve the existing five-command headless contract and its `igniteTest` coverage. Do not expand it for browser-only controls.
2. Derive every domain presentation field in the existing `igniteCore({ view })` callback.
3. Keep commands in `igniteCore({ commands })` and component events in `events`/`effects`.
4. Port prototype structure into the existing `component("voice-workbench", renderWorkbench)` projection.
5. Copy the approved token variables into the example’s production stylesheet or shadow-local `<style>` source; every component rule must use `var(--token)`.
6. Keep `createProjectionDocumentTarget` and `createProjectionSpeechTarget` direct in the browser entrypoint; add an equally direct injectable terminal/text target if the task slice includes it.
7. Implement microphone capture, playback preference, local tabs, and trace replay as explicit outer-adapter or projection-local concerns. They must not appear in `component.getSchema()`.
8. Derive the causal inspector from current view data, `getSchema()`, allowlist decisions, emitted component facts, and channel commit receipts. Do not introduce a second durable store.

## Per-state parity and accessibility gate

Run before implementation closeout for each designed matrix cell:

- Header contains Ignite identity, actor status, capability labels, and independent speech-output preference.
- Conversation includes typed and speech modality labels, agent replies, composer, microphone, and one Send action.
- Listening includes live status, transcript, waveform as decorative-only, Cancel, and Use transcript.
- Responding includes actor-state label and semantic commit steps.
- Artifact includes title/id/revision, committed state, document/schema tabs, spoken-summary control, semantic nodes, and decision record.
- Runtime includes the one-component contract, model proposal versus actor authorization, revision storage, browser/terminal/speech channel commits, the five-command schema, and a rejected non-allowlisted command.
- Microphone denial preserves the typed draft and offers continued text input.
- Horizontal overflow is 0 at 1440, 1280, 768, and 390.
- Page overflow is 0; conversation, artifact, runtime, and status rails own any necessary internal scrolling.
- Visible targets are at least 32px desktop and 44px tablet/mobile.
- Every interactive control has a visible `:focus-visible` treatment and a keyboard path.
- Reduced-motion preference suppresses pulsing, waveform, and transition animation.
- All component colors resolve from the approved token file across the Shadow DOM boundary.
- Axe WCAG 2 A/AA reports zero violations; translucent backgrounds receive a manual contrast check where axe is incomplete.

Presence and alignment failures are blockers. Small cosmetic variance may be logged as design debt.

## Approval record

- Approved artifact: Round 2 plus the artifact-proof collision correction.
- Approved transition: Mock Studio specification to production POC/MVP implementation.
- Approval scope: visual hierarchy, interaction states, responsive behavior, token system, runtime teaching rail, and the implementation contract above.
- Approval does not certify: a live MLX connection, live speech recognition, production Ignite integration, or accessibility parity. Those require implementation receipts.

## Production implementation receipt — 2026-07-13

The approved Mock Studio design is now represented by a test-only production
parity harness that imports the real component, source, commands, and
`renderWorkbench` projection. It allowlists `ready`, `listening`, `responding`,
`artifact`, and `permission`; unknown fixtures fail closed. Deterministic content
is visibly labeled **Parity harness only** and never enters the live entrypoint.

Automated verification passed with 10 test files and 36 tests, TypeScript
typechecking, and a two-page Vite build. The suite exercises all five fixtures
through the `igniteTest` accessibility bridge, checks ten opaque or translucent
WCAG AA token pairs, enforces a 44px global target contract, and guards the
parity entrypoint against imperative DOM lookup.

The final rendered-browser receipt is
`/private/tmp/ignite-voice-workbench-parity-20260713-final`: 25 PNGs plus
`measurements.json`, covering all five states at 1920×1080, 1440×900, 1280×800,
768×900, and 390×844. It reports no failures or browser logs, zero maximum
horizontal overflow, all visible targets at least 44px, every state proof
visible, correct actor and voice state, and the approved active panel in every
cell. The test-only artifact title was visible and the permission fixture
preserved its draft exactly. Earlier pre-fix browser captures are superseded by
this receipt.

This receipt certifies production projection parity for the deterministic
fixtures. It does not certify a live MLX process, live microphone permission,
speech-recognition quality, or assistive-technology behavior.
