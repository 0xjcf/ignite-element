# Voice and text workbench

This example starts with an empty conversation and proves one Ignite component
can accept typed or spoken prompts, authorize model-proposed semantic changes,
and project the accepted result to browser, terminal, and speech consumers.

It is a POC/MVP for agent-authored interfaces, not a scripted product tour. The
center artifact is actor-owned state. It changes only after the configured model
proposes `createArtifact` or `reviseArtifact` and the actor validates the
semantic document.

## What the example proves

The component exposes exactly five public commands:

- `submitPrompt`
- `createArtifact`
- `reviseArtifact`
- `completeResponse`
- `acknowledgeSpeech`

Text and speech are two input adapters for the same `submitPrompt` command. The
model receives only the currently authorized artifact commands from
`getSchema()` through `igniteTools`. It may propose a semantic artifact and a
response, but it cannot write DOM, JSX, JavaScript, or actor state directly.

The actor validates semantic nodes, revision conflicts, action payloads, and
command availability before accepting a proposal. Ignite then derives the view
and commits the same accepted response through independent consumers:

```text
text input ─┐
            ├─> submitPrompt ─> actor ─> getSchema() ─> igniteTools ─> MLX
speech ─────┘                                      model proposes commands
                                                           │
browser JSX <─ ProjectionDocument <─ actor validates <─────┘
terminal    <─ response-completed
speech      <─ ProjectionSpeechRequest ─> acknowledgeSpeech
```

The browser projection is declarative Ignite JSX. Browser-only draft, mobile
panel, microphone, trace, and commit-receipt facts live in a private typed
presentation slice of the same source actor; event handlers send facts and do
not mutate the rendered DOM.

## Run with a local MLX model

Start an OpenAI-compatible MLX server with a tool-capable model:

```bash
python -m pip install mlx-lm
python -m mlx_lm.server --model <model> --port 8080
```

Then start the example from the repository root:

```bash
VITE_MLX_BASE_URL=http://127.0.0.1:8080/v1 \
VITE_MLX_MODEL=<model> \
pnpm --dir examples/agents/voice-workbench dev
```

`VITE_MLX_API_KEY` is optional for a compatible endpoint that requires a bearer
token. Vite exposes `VITE_*` values to browser code, so use only a development
credential intended for that environment. An embedding host may instead set
`globalThis.MLX_BASE_URL`, `globalThis.MLX_MODEL`, and
`globalThis.MLX_API_KEY` before loading the entrypoint.

No model URL, model name, credentials, prompts, artifacts, or responses are
hard-coded. Without model configuration, a submitted prompt becomes an actor
fact, the UI explains the missing configuration, and the actor returns to
`ready` so the user can recover.

## Use text and speech

Type a request and choose **Send** to run the text path. Choose the microphone
button to start the capability-gated browser `SpeechRecognition` adapter. A
final transcript remains a draft until **Use transcript** submits it through
the same semantic command path.

Microphone denial, cancellation, unsupported browsers, and transcription errors
remain typed adapter facts. They do not corrupt the typed draft or advance the
conversation actor. Response playback uses browser `speechSynthesis`; the
speech projection records played, muted, or unavailable and acknowledges each
stable speech request so it does not replay after a re-render.

## Verify

```bash
pnpm --dir examples/agents/voice-workbench test
pnpm --dir examples/agents/voice-workbench typecheck
pnpm --dir examples/agents/voice-workbench build
```

The deterministic suite uses `igniteTest` and the headless runtime before it
tests the browser projection. It covers both prompt modalities, semantic-node
validation, stale revision rejection, schema-limited model commands, provider
failures, speech lifecycle, projection commits, and the no-imperative-DOM-writer
guard.

Production parity was manually verified on 2026-07-13 at 1920×1080,
1440×1000, 1280×900, 768×900, and 390×844. Every viewport had zero page-width
overflow and no browser warnings or errors. The mobile Chat, Artifact, and
Runtime panels switched declaratively; the Schema view rendered the empty
`{ artifacts: [] }` state; visible 390px interaction targets measured at least
44px; and an unconfigured MLX submission visibly recovered to actor `ready`.

## Deliberate boundaries

This example proves actor authority within one live browser session. It does not
yet prove persistence across reloads, multi-client synchronization, Actor-Web
transport, model-process supervision, or equivalent speech recognition across
all browsers and assistive technologies. Those remain outer-runtime or rendered
browser concerns rather than hidden responsibilities of `igniteCore` or
`igniteTools`.
