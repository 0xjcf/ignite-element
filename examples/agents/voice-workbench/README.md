# Voice and text workbench

This example starts with an empty conversation and proves one Ignite component
can accept typed or spoken prompts, authorize model-proposed semantic changes,
and project the accepted result to browser, terminal, and speech consumers.

It is a POC/MVP for agent-authored interfaces, not a scripted product tour. The
center artifact is actor-owned state. It changes only after the configured model
proposes `createArtifact` or `reviseArtifact` and the actor validates the
semantic document.

## What the example proves

The component's domain contract centers on five commands:

- `submitPrompt`
- `createArtifact`
- `reviseArtifact`
- `completeResponse`
- `acknowledgeSpeech`

Text and speech are two input adapters for the same `submitPrompt` command.
Additional presentation commands keep browser intent actor-owned without
exposing the source. The model receives only the currently authorized artifact
commands from `getSchema()` through `igniteTools`. It may propose a semantic
artifact and a response, but it cannot write DOM, JSX, JavaScript, or actor
state directly. When a model emits one tool call per response, the pure turn
protocol accepts the artifact first and requests `completeResponse` in a second
round against the updated actor view.

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

Provider lifecycle is part of that same behavior contract. The workbench mounts
while MLX is preparing, but `submitPrompt` remains unavailable at both the
command and actor-transition boundaries. A minimal chat completion—not the
`/models` metadata response—produces the `MODEL_AVAILABLE` fact that unlocks
text and speech. Expected failures become sanitized `MODEL_FAILED` facts and a
retryable projection.

The browser projection is declarative Ignite JSX. Browser-only draft, mobile
panel, microphone, trace, and commit-receipt facts live in a private typed
presentation slice of the same source actor. UI handlers invoke projected
component commands and never mutate the rendered DOM; the `actor` supplied to
`igniteCore.commands` owns every source write.

## Run with a local MLX model

From the repository root, run one command:

```bash
pnpm example:voice-workbench
```

The launcher requires macOS on Apple Silicon and `python3`. On its first run it:

1. Creates an isolated environment under
   `~/Library/Caches/ignite-element/voice-workbench/`.
2. Installs the pinned `mlx-lm` package there without changing system Python.
3. Downloads and starts
   [`mlx-community/gemma-4-e4b-it-4bit`](https://huggingface.co/mlx-community/gemma-4-e4b-it-4bit),
   a 5.15 GB quantization whose native tool-call format is parsed by the pinned
   MLX server.
4. Waits only until `/v1/models` proves the endpoint is OpenAI-compatible, then
   starts Vite even if the model is still downloading or loading.
5. Opens the browser in a projected **Preparing local model** state. A minimal
   tool-call probe moves the actor to **Ready** only when MLX can return the
   OpenAI-compatible tool calls this example requires.
6. Keeps both processes attached to the same terminal.

The first run can take several minutes because it installs Python packages and
downloads the model. The UI intentionally loads before that work finishes and
keeps prompt controls disabled; download progress remains visible in the
terminal. Later runs reuse both caches. Press **Control-C** once to stop every
process the launcher owns. If a compatible server is already running on port
8080, the launcher reuses it and does not stop it on exit.

### Configuration

The defaults target the smooth local path. Override only what your machine or
model requires:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VOICE_WORKBENCH_MLX_MODEL` | Hugging Face model or local model path | `mlx-community/gemma-4-e4b-it-4bit` |
| `VOICE_WORKBENCH_MLX_LM_VERSION` | Isolated `mlx-lm` version | `0.31.3` |
| `VOICE_WORKBENCH_PYTHON` | Python used to create the environment | `python3` |
| `VOICE_WORKBENCH_CACHE_DIR` | Isolated environment cache | macOS user cache |
| `VOICE_WORKBENCH_MLX_PORT` | Managed loopback model-server port | `8080` |
| `VOICE_WORKBENCH_WEB_PORT` | Strict Vite port | Vite chooses `5173` or the next free port |
| `VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS` | Endpoint compatibility deadline | `1200000` |
| `VOICE_WORKBENCH_NO_OPEN` | Set to `1` to avoid opening a browser | unset |
| `VITE_MLX_BASE_URL` | Reuse an external OpenAI-compatible endpoint | managed local MLX endpoint |
| `VITE_MLX_API_KEY` | Development bearer token for an external endpoint | unset |

For example, a smaller timeout and a different model can be selected without
editing the example:

```bash
VOICE_WORKBENCH_MLX_MODEL=<model> \
VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS=1800000 \
pnpm example:voice-workbench
```

Setting `VITE_MLX_BASE_URL` makes the endpoint externally owned. The launcher
waits for it but never installs, starts, or stops its model process. This also
allows non-Apple systems to use an OpenAI-compatible server running elsewhere.

### Manual two-server workflow

The processes can still be managed independently when debugging the provider:

```bash
python3 -m venv .venv-mlx
.venv-mlx/bin/python -m pip install mlx-lm==0.31.3
.venv-mlx/bin/python -m mlx_lm.server \
  --model mlx-community/gemma-4-e4b-it-4bit \
  --host 127.0.0.1 \
  --port 8080
```

In another terminal:

```bash
VITE_MLX_BASE_URL=http://127.0.0.1:8080/v1 \
VITE_MLX_MODEL=mlx-community/gemma-4-e4b-it-4bit \
pnpm --dir examples/agents/voice-workbench dev
```

`VITE_MLX_API_KEY` is optional for a compatible endpoint that requires a bearer
token. Vite exposes `VITE_*` values to browser code, so use only a development
credential intended for that environment—never a production secret. An
embedding host may instead set `globalThis.MLX_BASE_URL`,
`globalThis.MLX_MODEL`, and `globalThis.MLX_API_KEY` before loading the
entrypoint. Those values are also available to browser code; this example's
configuration paths are development-only.

Each model invocation serializes the submitted prompt and a compact
`modelContext` derived by `igniteCore.view`. It includes artifact state needed
for creation and revision but excludes browser draft, microphone, trace, and
commit-receipt presentation state. Consumers still own that disclosure boundary
and must redact or remove sensitive artifact data before invoking the model.
This example does not apply application-specific redaction automatically.

The launcher provides overridable local URL and model defaults; credentials,
prompts, artifacts, and responses are never hard-coded. When the web-only
`pnpm --dir examples/agents/voice-workbench dev` command is used without model
configuration, the readiness adapter produces a configuration failure, the UI
projects **Model unavailable**, and prompt controls stay closed until a valid
provider can be prepared.

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

## Production parity harness

`parity.html?state=<state>` renders the production projection in one of seven
allowlisted states: `preparing`, `failed`, `ready`, `listening`, `responding`,
`artifact`, or `permission`. The harness uses the real component, source,
commands, and projection. Private presentation facts seed adapter-only state.
Its deterministic artifact is labeled **Parity harness only** and is never
loaded by the production entrypoint.

For example, after starting Vite, open:

```text
http://127.0.0.1:5173/parity.html?state=artifact
```

Unknown state names fail closed. The harness exists for repeatable rendered-
browser and accessibility checks; it is not a demo-data mode.

## Verify

```bash
pnpm --dir examples/agents/voice-workbench test
pnpm --dir examples/agents/voice-workbench typecheck
pnpm --dir examples/agents/voice-workbench build
```

The deterministic suite uses `igniteTest` and the headless runtime before it
tests the browser projection. It covers both prompt modalities, semantic-node
validation, stale revision rejection, schema-limited model commands, provider
failures, speech lifecycle, projection commits, and the
no-imperative-DOM-writer guard. The parity suite checks all seven states through
the `igniteTest` accessibility bridge, ten opaque or translucent WCAG AA token
pairs, and the global 44px target contract.

## Deliberate boundaries

This example proves actor authority within one live browser session. It does not
yet prove persistence across reloads, multi-client synchronization, Actor-Web
transport, model-process supervision, or equivalent speech recognition across
all browsers and assistive technologies. Those remain outer-runtime or rendered
browser concerns rather than hidden responsibilities of `igniteCore` or
`igniteTools`.

The bundled `mlx-lm.server` is a loopback development server with basic security
checks, not a production deployment. Do not expose it to an untrusted network.
A hosted version must configure CORS and CSP `connect-src` for its model endpoint
and should send an explicitly redacted model-context projection rather than the
complete component view. Browser `SpeechRecognition` availability, audio
handling, and provider behavior remain browser- and vendor-dependent.
