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

One `searchWeb` call accepts 1–8 focused `{ subject, query }` requests, an
optional two-letter country code, and 1–5 results per request. The model still
makes one tool call and receives one aggregated result; the server schedules the
individual Brave requests internally. Each returned search preserves its
subject identity. A price becomes `sourced` only when one unambiguous
currency-marked decimal is present in a returned source; otherwise the subject
remains `unverified` with no invented numeric value. This keeps a multi-item
research turn inside the five-round model budget, and its receipt records both
query and source counts.

Before `completeResponse` can close a researched turn, a pure evidence audit
compares those accepted search facts with the current actor view. Checklist
labels remain action state, while a semantic table must preserve each subject's
exact Price, Status, and Source. Evidence charts may contain exact sourced
numeric values but must exclude unverified values. Incomplete evidence returns
bounded structured feedback to the next model round so it can revise the
artifact instead of completing with an unsupported projection.

The same-origin route rejects request bodies larger than 16 KiB before buffering
additional chunks. Search titles, URLs, descriptions, per-query results, and the
total source set are bounded before evidence enters model context. The latest
sanitized provider receipt or manifest collision is retained in presentation
state and shown in the live runtime inspector; raw responses and server
credentials are never retained there.

Rate limiting stays inside the server adapter. A shared server-side gate paces
Brave requests within and across batches from the provider's short-window
remaining/reset headers, so a multi-subject call does not burst over a
one-request-per-second plan. Brave `429` and `503` responses receive at most one
retry after the initial request by default. Numeric and HTTP-date `Retry-After`
guidance is honored within a bounded delay; when it is absent, Brave's
`X-RateLimit-Reset` guidance supplies the retry delay. The final failure returns
attempt counts, provider status, and exhaustion as structured facts instead of
throwing. Concurrent identical normalized requests share one in-flight
execution, while only successful exact requests enter the bounded 15-second
cache. Cache hits, misses, coalesced calls, and TTL remain visible in the
sanitized receipt. An alternate provider runs only when explicitly injected and
configured for the exhausted status; the adapter never invents fallback
evidence.

This keeps the workbench shell generic. Shopping research is the first optional
domain pack, not a shopping-specific Ignite component or renderer. The pack
constrains product selection and evidence quality, while the model still uses
the existing `createArtifact` or `reviseArtifact` commands to compose any
supported list, table, chart, timeline, decision log, or mixed-node document.
HTTP and HTTPS values in table cells become safe source links, while chart nodes
retain a textual accessible name and per-series values.

## Domain packs and policy ownership

The example makes application-specific behavior visible under `src/domains/`:

```text
src/domains/
├─ contracts.ts                 generic example-private domain contracts
├─ registry.ts                  ordered capability, instruction, and audit routing
└─ product-pricing/
   ├─ policy.ts                 pure representative-product decision
   ├─ capability.ts             local policy capability boundary
   ├─ authorization.ts          pre-execution search authorization
   ├─ projection.ts             bounded policy fact projection
   ├─ completion-audit.ts       domain artifact conformance
   └─ *.test.ts                 deterministic policy and audit proofs
```

This structure is intentionally example-private. It does not add a policy
engine to Ignite and it does not depend on Actor-Web. The pure policy can later
be invoked by XState guards/actions, Redux or MobX domain services, a backend
actor, or an Actor-Web policy-composition API without changing its decisions.

The source-of-truth boundary is:

| Layer | Owns |
| --- | --- |
| Product-pricing policy | Required scope, representative defaults, clarification questions, and evidence requirements |
| Local domain capability | Validating model input and returning the deterministic decision as a fact |
| Domain registry | Asking applicable packs for authorization before capability dispatch and returning bounded validation facts when denied |
| Model | Proposing the policy call, research call, and semantic artifact commands |
| XState workbench source | Retaining the bounded policy fact and accepting or rejecting artifact transitions |
| `igniteCore.view` | Deriving domain, policy, status, assumption, question, and evidence rows |
| Ignite JSX | Mapping only the prepared rows; it contains no product defaults or outcome rules |
| Search provider | Returning external facts and receipts; it does not authorize actor transitions |

For the product-pricing pack, Bread, Eggs, and Milk have explicit representative
defaults. The policy exposes those defaults as assumptions. Missing retailer or
location scope, and unknown products without a product or size, produce
`needs-input`; malformed, duplicate, empty, or oversized requests produce
`rejected`. Only `admitted` decisions contain search queries. A successful
policy call is therefore neither price evidence nor permission by itself to
execute an external effect. Before `runCapability` can invoke the search owner,
the generic workbench asks the registry to authorize the proposed call. The
product-pricing pack denies searches after `needs-input` or `rejected`, and an
`admitted` decision permits one batch containing its complete exact
subject/query set. A strict subset is denied so the model cannot turn one
policy decision into repeated provider calls. Denials become bounded
capability-validation facts for model repair; the external provider is not
called. The next model manifest also hides `searchWeb` after a paused or
rejected decision, but the pre-execution check remains the authoritative guard.

To add a second domain:

1. Create a sibling directory with a pure policy, capability adapter,
   pre-execution authorization, bounded projection, completion audit, and
   focused tests.
2. Implement the generic `DomainPack` contract without importing JSX or the
   workbench source actor.
3. Give `appliesTo` a narrow prompt signal so unrelated requests retain the
   generic fallback behavior.
4. Register the pack in `main.tsx`. The registry supplies capabilities and
   instructions in order, retains the first recognized policy fact, applies
   authorization before provider dispatch, and runs only applicable completion
   audits.
5. Project any new generic rows in the `igniteCore.view` callback. Do not derive
   domain defaults, questions, or conditional labels in `workbench.tsx`.

The right rail makes this boundary observable. It shows the active domain and
policy, decision status, assumptions, clarification questions, and evidence
requirements from the current actor view. Starting another accepted prompt
clears the prior policy proof so the rail cannot imply that a previous domain
decision governs the new turn.

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
       → createArtifact/reviseArtifact → actor validation → evidence audit
       → repair when incomplete → table + chart + links → completeResponse
```

Each process imports that component contract directly. The terminal
intentionally owns an independent actor instance; sharing one live actor
between browser and terminal would require an explicit transport such as
Actor-Web, which this example does not hide behind a wrapper.

## Reading the live runtime inspector

The browser right rail is a projection of the current Ignite view, not a static
architecture diagram. Its top card keeps three kinds of evidence separate:

- **MLX readiness** comes from the provider branch of the current parallel actor
  state.
- **Actor state and facts** come from `snapshot.matches(...)` and the accepted
  conversation facts.
- **Capability outcomes** are bounded adapter facts, including HTTP, retry,
  cache, and configured-fallback provenance when present.

The Browser, Terminal, Speech, and Headless selectors format the same current
actor projection. They are previews, while document and speech receipts report
effects that actually committed. In particular, the Terminal card explicitly
says it does not represent remote terminal synchronization; the CLI owns an
independent actor unless an explicit transport is added.

The schema explorer has two deliberately separate sections. **Current model
manifest** is the exact owner-enriched, availability-scoped manifest captured at
the model request boundary for the latest round. **All component commands** is
the private `getSchema()` blueprint used for explanation. Expanding a command
shows its description, owner, live availability, gated state, nested input
schema, required fields, and constraints. The explorer does not introduce a
public inspection API or allow the model to authorize its own commands.

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

For repeatable local search configuration, copy the committed placeholder and
add your Brave Search subscription token to the ignored local file:

```bash
cp examples/agents/voice-workbench/.env.example \
  examples/agents/voice-workbench/.env.local
```

Vite loads that example-local `.env.local` automatically when the one-command
launcher starts the web server. A `BRAVE_SEARCH_API_KEY` supplied directly in
the shell takes precedence over the local file. Keep this variable server-only:
never rename it with a `VITE_` prefix, and never commit `.env.local`.

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
variable in either the shell or example-local `.env.local`, `searchWeb` is
omitted from the model manifest and the model receives
`internetAccess: "unavailable"`; it is instructed to say that current lookup
is unavailable instead of claiming or promising future research.

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
