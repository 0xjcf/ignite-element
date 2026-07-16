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
constrains product selection and evidence quality. The generic path remains
model-owned: the model uses the existing `createArtifact` or `reviseArtifact`
commands to compose any supported list, table, chart, timeline, decision log,
or mixed-node document. An applicable domain pack may optionally materialize a
canonical artifact from accepted domain facts before the actor executes that
command. Packs without that hook, hooks that return `null`, and unrelated
prompts preserve the model proposal unchanged. HTTP and HTTPS values in table
cells become safe source links, while chart nodes retain a textual accessible
name and per-series values.

For the supported Whole Foods Sarasota scope, the model never authors a search
query or product identity. It first calls `prepareProductPricing` with retailer,
location, and ordered subject-only items. If the first decision is rejected or
needs input, the model may repair that policy request once; the latest decision
supersedes the first. An admitted decision exposes `priceProducts` for one call
with the exact retailer, location, and ordered subjects. The provider owns
product and package-size selection.

For every subject, the provider first calls Whole Foods' store-scoped native
search and accepts only the bounded
`mainResultSet.searchResults[].asin` envelope. It fetches offer details for the
deduplicated candidate ASINs in one batch, then applies the versioned
`whole-foods-candidate-v1` ranking policy. Low-confidence or closely ranked
candidates remain explicitly `unverified`; there are no catalog aliases or
model-supplied product defaults. The offer response must match the selected
ASIN, parse a product and package size, report `GROCERY` and `IN_STOCK`, and
contain a positive USD price. Unrelated numeric values never become evidence.

Selected identities—not prices—enter an injected 300-second, 64-entry LRU keyed
by store, normalized subject/query, and ranking-policy version. Concurrent
identical discovery calls coalesce, while every request still performs a fresh
offer batch. Brave runs with zero retries only after a decoded HTTP 200 native
search returns no candidates. Native transport errors, schema drift, and
ambiguous rankings never spend Brave. The aggregate fact preserves every
subject, provider selection, sourced or unverified price, and native/cache/Brave
receipt; `queryCount` counts only discovery requests actually made.

## Lifecycle machine contract and maturity

The workbench exports `voiceWorkbenchSessionMachine` as reusable unstarted
XState logic and `createVoiceWorkbenchSessionActor()` as the fresh actor
boundary for tests and independent runtimes. Every call creates new top-level
and nested context. The existing `source` export still starts one actor for the
browser, terminal, and compatibility tests that intentionally use the example
singleton.

The executable session is a compound statechart: provider readiness owns the
outer lifecycle, and turn activity exists only inside `available`. The
model-turn, voice-capture, and speech-delivery child machines below remain
**planned** follow-up work. Those child protocols add explicit terminal,
cancellation, and timeout behavior without weakening the compound ownership
already enforced by the session machine.

### One owner per lifecycle or fact

The exported `voiceWorkbenchLifecycleOwnership` data mirrors this table so
tests and later graph tooling can detect contract drift:

| Surface | Single owner | Disposition | Implementation | Maturity |
| --- | --- | --- | --- | --- |
| Session/provider/turn | `voiceWorkbenchSessionMachine` | Statechart | Executable | Target compound topology |
| Model-turn orchestration | Model-turn child actor | Statechart | Planned | Target |
| Voice capture | Voice-capture child actor | Statechart | Planned | Target |
| Speech delivery | Speech-delivery child actor | Statechart | Planned | Target |
| Conversation and artifact aggregate | `reduceConversationSession` | Pure reducer | Executable | Target |
| Domain admission and authorization | Domain-pack policies | Typed facts | Executable | Target |
| Capability execution | Capability ports | Typed facts | Executable | Target |
| Draft, selection, preview, and receipt UI | `reduceWorkbenchPresentation` | Pure reducer | Executable | Target separation |

Reducers and typed result unions stay authoritative for data and decisions; a
statechart consumes those facts only when it owns a real lifecycle. Ignite
projects snapshots and binds commands. It is not another writer of provider,
turn, voice, speech, policy, capability, conversation, or artifact truth.

### Current executable session contract

The exported machine currently defines exactly four raw state values:

- `"preparing"`;
- `"unavailable"`;
- `{ available: "idle" }`;
- `{ available: "responding" }`.

The initial value is `"preparing"`. `MODEL_AVAILABLE` enters
`available.idle`, while `MODEL_FAILED` enters `unavailable`.
`MODEL_PREPARATION_STARTED` retries from `unavailable` or leaves either
available child for `preparing`. An accepted `SUBMIT_PROMPT` moves only
`available.idle` to `available.responding`; an accepted `COMPLETE_RESPONSE`
moves it back to idle. Artifact creation, revision, and response completion are
structurally admitted only while responding. `SET_CHECKLIST_ITEM` is accepted
in both available children: model orchestration can invoke it while responding,
while the projected checkbox invokes the same revision-guarded command only
when exposed during idle. Restore and selection commands remain idle-only.

If `MODEL_FAILED` arrives while responding, the transition atomically records
the sanitized failure and a non-success turn receipt, clears no prior aggregate
fact, leaves `response` null, and enters `unavailable`. Artifact mutation and
completion are then unavailable until a later preparation succeeds.

The command and event vocabulary is intentionally classified by authority:

| Channel | Current commands | Contract direction |
| --- | --- | --- |
| `user-intent` | `submitPrompt`, `beginModelPreparation`, `restoreArtifactRevision`, `selectArtifact`, `acknowledgeSpeech`, voice start/cancel/transcript, presentation choices, replay, and play-speech intent | Schema-admitted only where a user or consumer can intentionally request behavior |
| `model-intent` | `createArtifact`, `reviseArtifact`, `setChecklistItem`, `completeResponse` | Continue through statechart guards and reducer validation; the model never writes context directly |
| `private-adapter` | `reportModelAvailable`, `reportModelFailure`, `presentVoice`, `commitDocument`, `commitSpeech` | Translate bounded adapter outcomes into private lifecycle or presentation facts |
| `read-model` | `recordTurn`, `recordRuntimeManifest`, `recordCapabilityOutcome`, `recordDomainPolicyDecision` | Project bounded orchestration facts without becoming lifecycle authorities |

Every one of the 28 commands carries one of these serializable channel labels
in `getSchema()`. The channel declares the primary orchestration authority for
the command, not an exclusive set of physical callers. Statechart admission,
reducer validation, and the narrower per-round model allowlist still decide
whether a particular invocation is accepted.

The exact current `getSchema()` command inventory assigns every name to one
category:

```text
user-intent:
  submitPrompt, beginModelPreparation, restoreArtifactRevision,
  selectArtifact, acknowledgeSpeech, startVoiceCapture,
  cancelVoiceCapture, submitVoiceTranscript, changeArtifactView,
  changeDraft, changeMobilePanel, changeSpeechPreference,
  selectRuntimePreview, playSpeech, replay

model-intent:
  createArtifact, reviseArtifact, setChecklistItem, completeResponse

private-adapter:
  reportModelAvailable, reportModelFailure, presentVoice,
  commitDocument, commitSpeech

read-model:
  recordTurn, recordRuntimeManifest, recordCapabilityOutcome,
  recordDomainPolicyDecision
```

The exact underlying machine event inventory is:

```text
Conversation intent and domain actions:
  SUBMIT_PROMPT, CREATE_ARTIFACT, REVISE_ARTIFACT,
  RESTORE_ARTIFACT_REVISION, SELECT_ARTIFACT, SET_CHECKLIST_ITEM,
  COMPLETE_RESPONSE, ACKNOWLEDGE_SPEECH

Provider lifecycle intent/results:
  MODEL_PREPARATION_STARTED, MODEL_AVAILABLE, MODEL_FAILED

Private presentation envelope:
  PRESENTATION_UPDATED
```

`PRESENTATION_UPDATED` carries a typed `user-intent`, `private-adapter`, or
`read-model` envelope. The pure `reduceWorkbenchPresentation` reducer is its
single writer and returns fresh presentation state. The state hierarchy itself
gates lifecycle-sensitive events, and the pure `transitionAccepted` guard adds
domain admission. The session machine invokes no async model, voice, or speech
effects yet; those effects still live in the imperative shell and are the
reason the three child lifecycles remain planned. Conversation facts such as
`prompt-submitted`, artifact changes, `response-completed`, and the
transport-neutral `speech-acknowledged` fact come from the conversation
reducer.

Every imported snapshot exposes the XState-native snapshot, but portable
consumers should treat these fields separately:

- authoritative raw state: `snapshot.value` plus serializable
  `snapshot.context`;
- relevant native lifecycle metadata: `status`, `output`, `error`, tags, and
  child identity/status when child actors exist;
- non-portable implementation details: machine nodes, methods, and internal
  XState objects;
- derived Ignite view: labels, prepared rows, status priority, and `can*`
  fields. The view is convenient read data, never a replacement for the raw
  value and context.

Current serializable context owns the conversation messages, documents,
artifact history, response, speech request, model failure, and the private
reducer-owned presentation slice. Command availability must come from the same
machine guard and reducer admission used by `canExecute()`; any `can*` view
field is only a projection of that rule.

The raw serializable context keys are:

```text
activeArtifactId, artifactRevisions, documents, factSequence, lastFact,
messages, modelFailure, presentation, response, revision, sessionId, speech
```

The derived view currently exposes these prepared top-level keys:

```text
activeArtifact, activeArtifactId, activeArtifactRevisions, artifactSummaries,
artifacts, canRestoreArtifactRevision, canRetryModel, canRevise,
canSetChecklistItem, canSubmitPrompt, documentSchema, lastFact, lastFactLabel,
messageCount, messages, microphoneUnavailable, model, modelContext,
modelFailed, modelPreparing, presentation, promptPlaceholder,
respondingProgress, response, resultQuality, revision, runtimeInspector,
sessionId, speech, speechStatus, status, statusLabel, transcript,
transcriptReady, turnCount, turnLabel, turnMessage, turnState, voiceFailure,
voiceState
```

### Executable graph invariant

Direct `xstate/graph` characterization proves the four exact raw vertices and
their event-labelled adjacency. The suite includes all 24 combinations of the
four vertices and six lifecycle/domain events, including unchanged snapshots
for rejected events. `voiceWorkbenchKnownForbiddenStateValues` is intentionally
empty, and `voiceWorkbenchSessionInvariants` requires responding to be nested
inside available. Tests inspect the authoritative raw snapshot independently
from the derived view.

### Executable session, provider, and turn shape

```mermaid
stateDiagram-v2
    [*] --> Preparing
    Preparing --> Available: MODEL_AVAILABLE
    Preparing --> Unavailable: MODEL_FAILED
    Unavailable --> Preparing: MODEL_PREPARATION_STARTED
    Unavailable --> Available: MODEL_AVAILABLE

    state Available {
        [*] --> Idle
        Idle --> Responding: SUBMIT_PROMPT [accepted]
        Responding --> Idle: COMPLETE_RESPONSE [accepted]
    }

    Available --> Preparing: MODEL_PREPARATION_STARTED
    Available --> Unavailable: MODEL_FAILED
```

This compound shape makes `Responding` impossible outside `Available`. A direct
model failure while responding records a non-success receipt and leaves no
fabricated response completion. The planned model-turn child protocol owns the
later addition of explicit failure, cancellation, and timeout terminal events.

### Planned target: model-turn orchestration

```mermaid
stateDiagram-v2
    [*] --> RequestingModel
    RequestingModel --> Evaluating: MODEL_RESULT
    RequestingModel --> Failed: MODEL_FAILED
    RequestingModel --> TimedOut: TIMEOUT

    Evaluating --> ExecutingCapability: COMMAND_AUTHORIZED
    Evaluating --> Completed: RESPONSE_ACCEPTED
    Evaluating --> Failed: COMMAND_REJECTED
    Evaluating --> Exhausted: ROUND_LIMIT_REACHED

    ExecutingCapability --> RequestingModel: CAPABILITY_RECORDED [incomplete and rounds remain]
    ExecutingCapability --> Completed: RESPONSE_ACCEPTED
    ExecutingCapability --> Failed: TURN_FAILED
    ExecutingCapability --> TimedOut: TIMEOUT

    RequestingModel --> Cancelled: CANCEL
    Evaluating --> Cancelled: CANCEL
    ExecutingCapability --> Cancelled: CANCEL

    Completed --> [*]
    Failed --> [*]
    TimedOut --> [*]
    Cancelled --> [*]
    Exhausted --> [*]
```

The pure one-round model protocol remains policy. This planned child actor owns
request invocation, round count, cancellation, timeout, and exactly one
terminal outcome.

### Planned target: voice capture

```mermaid
stateDiagram-v2
    [*] --> CheckingSupport
    CheckingSupport --> Unsupported: UNSUPPORTED
    CheckingSupport --> Idle: SUPPORTED

    Idle --> Listening: START
    Listening --> Listening: INTERIM_TRANSCRIPT
    Listening --> TranscriptReady: FINAL_TRANSCRIPT
    Listening --> Idle: ENDED [no final transcript]
    Listening --> Cancelled: CANCEL
    Listening --> PermissionDenied: PERMISSION_DENIED
    Listening --> Failed: CAPTURE_FAILED

    TranscriptReady --> Idle: CONSUME
    TranscriptReady --> Listening: START
    Cancelled --> Idle: RESET
    PermissionDenied --> Idle: RETRY
    Failed --> Idle: RETRY
```

The browser recognition object remains an imperative port. The planned child
actor owns the serializable lifecycle and emits voice facts.

### Planned target: speech delivery

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Pending: SPEECH_REQUESTED
    Pending --> Muted: DELIVERY_SKIPPED
    Pending --> Queued: DELIVERY_ACCEPTED
    Pending --> Unavailable: DELIVERY_UNAVAILABLE
    Pending --> Failed: DELIVERY_FAILED
    Queued --> Delivered: PLAYBACK_ENDED
    Queued --> Failed: PLAYBACK_FAILED
    Queued --> Cancelled: CANCEL
    Delivered --> Idle: CLEAR
    Muted --> Idle: CLEAR
    Unavailable --> Idle: CLEAR
    Failed --> Idle: CLEAR
    Cancelled --> Idle: CLEAR
```

Projection acknowledgement is transport-neutral and is not a delivery fact.
`WorkbenchSpeechAcknowledgementFact` names that receipt separately.
`WorkbenchSpeechDeliveryFact` distinguishes queued, completed, muted,
unavailable, failed, and cancelled adapter outcomes; the broader
`WorkbenchSpeechLifecycleFact` is only their explicit union. Calling
`speechSynthesis.speak()` may produce `queued`, never `completed`; playback
callbacks must produce the terminal delivery fact. `ACKNOWLEDGE_SPEECH` remains
a separate aggregate/projection-consumption fact and never transitions the
speech-delivery machine.

## Domain packs and policy ownership

The example makes application-specific behavior visible under `src/domains/`:

```text
src/domains/
├─ contracts.ts                 generic example-private domain contracts
├─ registry.ts                  capability, authorization, materialization, and audit routing
└─ product-pricing/
   ├─ policy.ts                 pure subject-scope decision
   ├─ capability.ts             local policy capability boundary
   ├─ price-capability.ts       port contract + same-origin adapter (transitional)
   ├─ providers/
   │  └─ whole-foods.ts         store, native decoder, ranking, and URL policy
   ├─ authorization.ts          exact admitted-request authorization
   ├─ artifact-materializer.ts  canonical artifact from policy + price facts
   ├─ projection.ts             bounded policy fact projection
   ├─ completion-audit.ts       domain artifact conformance
   └─ *.test.ts                 deterministic policy and audit proofs

server/product-pricing/
└─ whole-foods.ts               imperative retailer adapter + Brave fallback
```

This structure is intentionally example-private. It does not add a policy
engine to Ignite and it does not depend on Actor-Web. The pure policy can later
be invoked by XState guards/actions, Redux or MobX domain services, a backend
actor, or an Actor-Web policy-composition API without changing its decisions.

The source-of-truth boundary is:

| Layer | Owns |
| --- | --- |
| Product-pricing policy | Required subject scope, one-repair lifecycle, clarification questions, and evidence requirements |
| Local domain capability | Validating model input and returning the deterministic decision as a fact |
| Domain registry | Asking applicable packs for authorization before capability dispatch and selecting the first applicable non-null artifact materialization |
| Product-pricing artifact materializer | Deriving canonical checklist, selection-disclosure, and evidence-table nodes from the latest admitted decision plus one ordered provider fact |
| Model | Proposing policy and price calls; owning generic semantic composition and the product-pricing artifact command envelope |
| XState workbench source | Retaining the bounded policy fact and accepting or rejecting artifact transitions |
| `igniteCore.view` | Deriving domain, policy, status, assumption, question, and evidence rows |
| Ignite JSX | Mapping only the prepared rows; it contains no product defaults or outcome rules |
| Product-price provider | Owning store mapping, native discovery, product/size ranking, identity caching, offer reads, validation, and receipts |
| Generic search provider | Returning public-web facts for non-product research; it does not authorize actor transitions |

### Recursive functional-core boundary

The example follows the recursive model behaviorally, but its product-pricing
files are still a transitional structure rather than the final reference
layout. The current ownership chain is:

```text
intent
└─ product-pricing behavior and policy
   └─ capability authorization
      └─ product-pricing fact contract
         └─ same-origin + Whole Foods + Brave adapters
            └─ external HTTP infrastructure
```

At each boundary, the inner layer owns deterministic facts and decisions while
the outer layer performs effects. XState currently hosts the lifecycle and
accepted application state. `igniteCore.view` projects that state into a
renderer-ready read model, and Ignite JSX is only the browser adapter for that
projection. The same policy and projection contracts can therefore be hosted
by an Actor-Web actor, Redux store, or MobX store without adding source-specific
behavior to Ignite.

Two current files still mix recursive layers:

- `price-capability.ts` contains the product-price fact contract, response
  normalization, and the browser's same-origin fetch adapter.
- `server/product-pricing/whole-foods.ts` contains provider orchestration,
  decoding, retry/cache behavior, ranking, and HTTP effects.

A dedicated architecture slice should separate those responsibilities into
`core/`, `ports/`, `capabilities/`, and `adapters/` inside the example. That
refactor should preserve the current domain contracts and tests; it should not
add a new Ignite policy, capability, or port API. Actor-Web's policy composition
can authorize the same application policy when Actor-Web is the source runtime,
but it does not become the owner of product-pricing business rules.

The model tool manifest uses JSON Schema, while small explicit runtime readers
validate untrusted policy inputs and provider responses. This example does not
need Zod to become deterministic: the important boundary is that validation is
runtime-enforced and tested, not merely expressed as TypeScript types. A larger
application with many shared or nested domain schemas could adopt Zod (or
another schema library) behind the same domain/provider boundaries without
moving business policy into Ignite or the renderer.

For the product-pricing pack, the policy admits category subjects without
inventing representative products. Missing retailer or location scope produces
`needs-input`; malformed, duplicate, empty, or oversized subject lists produce
`rejected`. The model gets at most one repair after either outcome, and the
second decision becomes authoritative. A successful policy call is neither
price evidence nor permission by itself to execute an external effect. Before
`runCapability` can invoke the price owner, the generic workbench asks the
registry to authorize the proposed call. The pack always hides and denies
generic `searchWeb` for applicable product-pricing turns. An `admitted` decision
permits `priceProducts` once with the exact retailer, location, and ordered
subject set. A strict subset, reordering, or changed location is denied. After
success, `priceProducts` also leaves the next manifest. Denials become bounded
capability-validation facts for model repair; the provider is not called.

After the latest admitted decision and exactly one successful, ordered
`priceProducts` fact, the product-pricing pack can materialize a canonical
artifact when the model proposes `createArtifact` or `reviseArtifact`. It keeps
the proposed command identity and artifact envelope, but replaces its semantic
nodes with the requested-subject checklist, one provider-selection disclosure
per subject, and an exact Subject/Price/Status/Source table with no chart.
Missing, malformed, reordered, or repeated evidence makes the hook decline
rather than fabricate a document. The registry then preserves the original
model call, and the existing completion audit still prevents unsupported
completion.

`DomainPack.materializeArtifact` is application-owned domain policy in this
example. It is not Ignite runtime behavior, renderer behavior, or a generic
requirement that artifacts be deterministic. Ignite tools still execute the
resulting command against the XState source, the actor still validates the
transition, `igniteCore.view` derives presentation values, and JSX only maps
the accepted projection.

To add a second domain:

1. Create a sibling directory with a pure policy, capability adapter,
   pre-execution authorization, bounded projection, completion audit, and
   focused tests.
2. Implement the generic `DomainPack` contract without importing JSX or the
   workbench source actor.
3. Give `appliesTo` a narrow prompt signal so unrelated requests retain the
   generic fallback behavior.
4. Optionally implement `materializeArtifact` when the domain—not the model—owns
   a canonical semantic document derived from accepted facts. Preserve the
   command envelope, return `null` when prerequisites are incomplete, and omit
   the hook when free-form model composition is desired.
5. Register the pack in `main.tsx`. The registry supplies capabilities and
   instructions in order, retains the first recognized policy fact, applies
   authorization before provider dispatch, selects the first non-null artifact
   materialization, and runs only applicable completion audits.
6. Project any new generic rows in the `igniteCore.view` callback. Do not derive
   domain defaults, questions, or conditional labels in `workbench.tsx`.

The right rail makes this boundary observable. It shows the active domain and
policy, decision status, assumptions, clarification questions, and evidence
requirements from the current actor view. Starting another accepted prompt
clears the prior policy proof so the rail cannot imply that a previous domain
decision governs the new turn.

MLX turns and projected checklist controls invoke the same `setChecklistItem`
command with stable artifact, node, and item identities plus the expected
revision. Its primary channel remains `model-intent`; the projected control is
enabled only after response completion in `available.idle`, while model
orchestration can invoke it during `available.responding`. The functional core
rejects stale or unknown identities and records an accepted change as the next
immutable artifact revision.

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

This feedback loop distinguishes actor acceptance from prompt satisfaction. On
the generic path, if the actor accepts a valid text node for a request that
asked for a checklist, the next model round sees the accepted document, can
revise it to checklist nodes, and only then completes. The local model chooses
from the semantic shapes in the current command schema. The optional
product-pricing materializer is the explicit exception: that domain owns its
canonical evidence nodes, while the actor remains the authority that accepts or
rejects the resulting command.

The actor validates semantic nodes, revision conflicts, action payloads, and
command availability before accepting a proposal. The same component module is
then consumed in three environments:

```text
same component = igniteCore({...})
├─ browser: text or speech → actor → MLX tools → JSX + speech
├─ terminal: text → actor → MLX tools → formatted text
└─ headless proof: igniteTest commands → actor → inspectable trace
```

With product pricing configured, one browser turn adds a domain provider
without changing the component contract:

```text
prompt → prepareProductPricing → admitted exact request → priceProducts
       → native store search → versioned product/size selection
       → clean native miss only: one no-retry Brave discovery
       → one deduplicated Whole Foods offer batch → ordered facts + receipt
       → model proposes createArtifact/reviseArtifact envelope
       → product-pricing materializes canonical nodes → actor validation
       → evidence audit → completeResponse
```

For generic prompts, the corresponding artifact step remains
`model nodes → unchanged registry pass-through → actor validation`. Neither
path moves artifact or policy decisions into Ignite JSX.

Each process imports that component contract directly. The terminal
intentionally owns an independent actor instance; sharing one live actor
between browser and terminal would require an explicit transport such as
Actor-Web, which this example does not hide behind a wrapper.

## Reading the live runtime inspector

The browser right rail is a projection of the current Ignite view, not a static
architecture diagram. Its top card keeps three kinds of evidence separate:

- **MLX readiness** comes from the top-level compound actor state.
- **Actor state and facts** come from `snapshot.matches(...)` and the accepted
  conversation facts.
- **Capability outcomes** are bounded adapter facts, including HTTP, retry,
  cache, and configured-fallback provenance when present.

The center document adds a fourth, separately named axis: **shopper result
quality**. `igniteCore.view` derives it from the admitted request and bounded
price facts, including requested, matched, and price-verified counts plus
stable per-item reason codes. The exact Sarasota partial result can therefore
show **Ready**, a committed artifact, and successful capability execution while
also saying **Partial result: 3 requested, 2 matched, 0 prices verified**. Those
facts are not contradictory; they answer different questions.

The same view callback prepares the human-readable artifact title, null-price
copy, safe product-page links, filtered policy sections, issue rows, and next
actions. JSX maps those prepared values without parsing URLs, interpreting null
cells, or reclassifying provider outcomes. Display-only values do not enter the
actor-owned artifact or its command schema.

The Browser, Terminal, Speech, and Headless selectors format the same current
actor projection. They are previews, while document and speech receipts report
effects that actually committed. In particular, the Terminal card explicitly
says it does not represent remote terminal synchronization; the CLI owns an
independent actor unless an explicit transport is added.

The schema explorer has two deliberately separate sections. **Current model
manifest** is the exact owner-enriched, availability-scoped manifest captured at
the model request boundary for the latest round. **All component commands** is
the private `getSchema()` blueprint used for explanation. Expanding a command
shows its description, owner, channel, live availability, gated state, nested
input schema, required fields, and constraints. The explorer does not introduce
a public inspection API or allow the model to authorize its own commands.

Provider lifecycle is part of the same behavior contract. The workbench mounts
while MLX is preparing, but `submitPrompt` remains unavailable at both the
command and actor-transition boundaries. A minimal chat completion—not the
`/models` metadata response—produces the `MODEL_AVAILABLE` fact that unlocks
text and speech. Expected failures become sanitized `MODEL_FAILED` facts and a
retryable projection. Model-response diagnostics identify the failed stage as
invalid JSON, an invalid completion envelope, or no authorized compatible tool
call; raw response bodies and model prose are never copied into those facts.

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
| `BRAVE_SEARCH_API_KEY` | Enable generic `searchWeb` and clean-native-miss product discovery | unset |

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
variable in either the shell or example-local `.env.local`, generic requests
omit `searchWeb` from the model manifest and receive
`internetAccess: "unavailable"`. A supported Whole Foods Sarasota request
instead receives `internetAccess: "available"` because its domain price
provider is configured, even while `priceProducts` remains hidden until policy
admission. Retailer-native discovery works without Brave; only a clean decoded
native miss may use the search token for official-product discovery.

Brave Web Search returns public search results and snippets, not guaranteed
store-inventory or checkout prices. The product-pricing adapter therefore uses
Brave only to discover an official product identity and obtains price and
availability from Whole Foods' structured, store-scoped product response. The
model must preserve returned URLs in the artifact so people can inspect the
evidence. A production commerce application would replace this example-private
retailer adapter with a supported commerce or inventory contract.

### DoorDash CLI evaluation

The example does not integrate the
[`dd-cli`](https://github.com/doordash-oss/doordash-cli) release. The July 14,
2026 [`v0.2.0`](https://github.com/doordash-oss/doordash-cli/releases/tag/v0.2.0)
build is waitlist-only, and the access terms bundled with that release limit it
to personal transactions, restrict retaining or analyzing accessed pricing
data, and allow transaction-completing operations. Those constraints conflict
with a persistent, reusable open-source artifact example and require a more
explicit human checkout boundary than this workbench currently has.

DoorDash's documented
[retail inventory and pricing APIs](https://developer.doordash.com/en-US/docs/marketplace/retail/inventory_pricing/overview/)
are merchant-facing inventory feeds rather than a consumer catalog-query API.
Accordingly, neither surface is used as a deterministic price source here. A
future authorized integration could implement the existing product-pricing
port as an imperative transaction adapter, keep cart and checkout actions
separately policy-gated, and return only bounded facts that the authorization
permits the application to retain.

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
