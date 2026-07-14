# Voice and text workbench

This example starts with an empty conversation and proves one Ignite component
can accept typed or spoken prompts, authorize model-proposed semantic changes,
and project the accepted result to browser, terminal, and speech consumers.

It is a POC/MVP for agent-authored interfaces, not a scripted product tour. The
artifact workspace is actor-owned state. It changes only after the configured
model or a projected control invokes an authorized artifact command and the
actor validates the semantic change.

## What the example proves

The component's domain contract centers on eight behavior commands:

- `submitPrompt`
- `createArtifact`
- `reviseArtifact`
- `restoreArtifactRevision`
- `selectArtifact`
- `setChecklistItem`
- `completeResponse`
- `acknowledgeSpeech`

Text and speech are two input adapters for the same `submitPrompt` command.
Additional presentation commands keep browser intent actor-owned without
exposing the source. The model receives a narrower allowlist from `getSchema()`
through a fresh `igniteTools(component)` manifest on every model round:
`createArtifact`, `reviseArtifact`, `setChecklistItem`, and
`completeResponse`. It may propose semantic artifacts and responses, but it
cannot write DOM, JSX, JavaScript, or actor state directly.

The bounded pure turn protocol executes one proposed tool call, returns its
correlated Ignite observation to the model, and derives the next manifest from
the updated actor state. An artifact mutation and `completeResponse` therefore
cannot be accepted in the same unobserved round. Invalid or stale input returns
structured actor feedback that the model can repair on its next round.

The browser can optionally federate that component manifest with reusable
external capability providers. The example includes one provider-neutral
`searchWeb` contract backed by a same-origin server route and Brave Web Search.
Every manifest entry has exactly one owner. Duplicate tool names reject the
combined manifest before model inference, and each call routes only to its
recorded owner. External success, unavailable, validation, timeout, and provider
failure outcomes return as bounded facts with receipts; they never mutate the
conversation actor directly.

One `searchWeb` call accepts 1–8 focused queries, an optional two-letter country
code, and 1–5 results per query. This keeps a multi-item research turn inside
the five-round model budget: one bounded batch gathers evidence, one actor
command authors or revises the artifact, and one command completes the response.
Its receipt records both query and source counts.

The same-origin route rejects request bodies larger than 16 KiB before buffering
additional chunks. Search titles, URLs, descriptions, per-query results, and the
total source set are bounded before evidence enters model context. The latest
sanitized provider receipt or manifest collision is retained in presentation
state and shown in the **Authorized turn trace** panel; raw responses and server
credentials are never retained there.

This keeps the workbench generic. Shopping research is the golden-path scenario,
not a shopping-specific actor or renderer: the model can search for source facts,
then use the existing `createArtifact` or `reviseArtifact` commands to compose
any supported list, table, chart, timeline, decision log, or mixed-node document.
HTTP and HTTPS values in table cells become safe source links, while chart nodes
retain a textual accessible name and per-series values.

Projected checklist controls and MLX turns both call `setChecklistItem` with
stable artifact, node, and item identities plus the expected revision. The
functional core rejects stale or unknown identities and records an accepted
change as the next immutable artifact revision.

On a fresh turn with no accepted artifact, the live manifest exposes
`createArtifact` but withholds `completeResponse`. Once the actor accepts an
artifact, the next manifest can expose `reviseArtifact`, `setChecklistItem`,
and `completeResponse`. Checklist command schemas require at least one valid
item, and model requests set OpenAI-compatible `tool_choice` to `required`, so
MLX must repair invalid semantic input through the correlated tool-result loop
instead of answering outside the command contract.

The model can combine any of the nine supported semantic projection kinds in a
single artifact: `text`, `checklist`, `action`, `form`, `table`, `timeline`,
`chart`, `code-diff`, and `decision-log`. It can also create multiple distinct
artifacts in one continuing session. The workspace keeps them in an artifact
rail rather than replacing the previous document when a new deliverable is
created.

This feedback loop distinguishes actor acceptance from prompt satisfaction. If
the actor accepts a valid text node for a request that asked for a checklist,
the next model round sees the accepted document, can revise it to checklist
nodes, and only then completes. There are no prompt-specific node mappings in
the example; the local model chooses from the semantic shapes in the current
command schema and the actor remains the authority.

The actor validates semantic nodes, revision conflicts, action payloads, and
command availability before accepting a proposal. The same component module is
then consumed in three environments:

```text
same component = igniteCore({...})
├─ browser: text or speech → actor → MLX tools → JSX + speech
├─ terminal: text → actor → MLX tools → formatted text
└─ headless proof: igniteTest commands → actor → inspectable trace
```

With optional research configured, one browser turn adds a provider without
changing the component contract:

```text
prompt → combined owner index → searchWeb → source facts + receipt
       → createArtifact/reviseArtifact → actor validation → table + chart + links
```

Each process imports that component contract directly. The terminal
intentionally owns an independent actor instance; sharing one live actor
between browser and terminal would require an explicit transport such as
Actor-Web, which this example does not hide behind a wrapper.

Provider lifecycle is part of the same behavior contract. The workbench mounts
while MLX is preparing, but `submitPrompt` remains unavailable at both the
command and actor-transition boundaries. A minimal chat completion—not the
`/models` metadata response—produces the `MODEL_AVAILABLE` fact that unlocks
text and speech. Expected failures become sanitized `MODEL_FAILED` facts and a
retryable projection.

Artifact revisions are append-only inside the pure actor session. `documents`
remains the latest-only read model used by the browser and model context, while
the private `artifactRevisions` collection retains every accepted snapshot.
Choosing **Restore** copies the selected historical snapshot into a new forward
revision. Earlier and later snapshots remain available, which supports
undo-like and redo-like restoration without rewriting history.

The browser projection is declarative Ignite JSX. Browser-only draft, mobile
panel, microphone, trace, and browser/speech receipt facts live in a private
typed presentation slice of the same source actor. UI handlers invoke projected
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
| `BRAVE_SEARCH_API_KEY` | Enable the server-owned `searchWeb` capability | unset |

For example, a smaller timeout and a different model can be selected without
editing the example:

```bash
VOICE_WORKBENCH_MLX_MODEL=<model> \
VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS=1800000 \
pnpm example:voice-workbench
```

To enable source-backed public-web research for the browser workbench, provide a
Brave Search subscription token to the same one-command launcher:

```bash
BRAVE_SEARCH_API_KEY=<server-only-token> pnpm example:voice-workbench
```

Vite reads the token only in its server process and exposes a boolean capability
availability flag to the browser. The browser calls the same-origin
`/api/capabilities/web-search` route and never receives the token. Without the
variable, `searchWeb` is omitted from the model manifest and the model receives
`internetAccess: "unavailable"`; it is instructed to say that current lookup is
unavailable instead of claiming or promising future research.

Brave Web Search returns public search results and snippets, not guaranteed
store-inventory or checkout prices. The model must preserve returned URLs in the
artifact so people can inspect the evidence. A production commerce application
would plug a retailer or product-data provider into the same owner contract when
exact local price and availability guarantees are required.

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
commit-receipt presentation state. It also excludes the private artifact
revision history. Correlated tool-result messages contain a bounded outcome,
the current model context, and public actor-event facts rather than the raw
XState snapshot. Consumers still own that disclosure boundary and must redact
or remove sensitive artifact data before invoking the model. This example does
not apply application-specific redaction automatically.

The launcher provides overridable local URL and model defaults; credentials,
prompts, artifacts, and responses are never hard-coded. When the web-only
`pnpm --dir examples/agents/voice-workbench dev` command is used without model
configuration, the readiness adapter produces a configuration failure, the UI
projects **Model unavailable**, and prompt controls stay closed until a valid
provider can be prepared.

## Run the terminal and headless consumers

With the local MLX server running, open another terminal and send a prompt
through the same component and tool loop without a browser:

```bash
pnpm --dir examples/agents/voice-workbench demo:terminal -- \
  "Create a shopping checklist and a two-column budget table"
```

The output includes projected actor state, semantic node inventory, the final
response, and the accepted/rejected command trace. The default endpoint and
model match the browser launcher and can be overridden with `MLX_BASE_URL`,
`MLX_MODEL`, and `MLX_API_KEY` or their `VOICE_WORKBENCH_*` counterparts.

The deterministic proof needs no model server or browser:

```bash
pnpm --dir examples/agents/voice-workbench proof:headless
```

It uses `component.record(...)` and `igniteTest.snapshotStory(...)` to print the
five-command trace, emitted actor events, final nested state value, retained
revisions, and checked checklist state.

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
pnpm --dir examples/agents/voice-workbench proof:headless
```

The deterministic suite uses `igniteTest` and the headless runtime before it
tests the browser projection. It covers both prompt modalities, semantic-node
validation, stale revision rejection, schema-limited model commands, provider
failures, correlated multi-round tool feedback, accepted-artifact correction,
model-driven checklist interaction, all nine browser node projections,
multi-artifact selection, append-only restore history, real terminal formatting,
speech lifecycle, projection commits, and the no-imperative-DOM-writer guard.
The parity suite checks all seven states through the `igniteTest` accessibility
bridge, ten opaque or translucent WCAG AA token pairs, and the global 44px
target contract.

## Deliberate boundaries

This example proves actor authority within one browser or terminal process. It
does not yet prove persistence across reloads, synchronization between the
independent browser and terminal actors, Actor-Web transport, durable revision
storage, model-process supervision, or equivalent speech recognition across all
browsers and assistive technologies. Those remain outer-runtime or rendered
browser concerns rather than hidden responsibilities of `igniteCore` or
`igniteTools`.

The bundled `mlx-lm.server` is a loopback development server with basic security
checks, not a production deployment. Do not expose it to an untrusted network.
A hosted version must configure CORS and CSP `connect-src` for its model endpoint
and should send an explicitly redacted model-context projection rather than the
complete component view. Browser `SpeechRecognition` availability, audio
handling, and provider behavior remain browser- and vendor-dependent.
