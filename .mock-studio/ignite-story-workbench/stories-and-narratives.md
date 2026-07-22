# Ignite Alchemy Stories and Narratives

Status: narrative-ready for the dev/test companion-tool direction
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`
Product: Ignite Alchemy
Category: Story Workbench

Ignite Alchemy is a reusable development/testing companion like TanStack
Devtools or Astro Dev Toolbar. It is not an end-user production page. Its job
is to host deterministic Story controls, docked inspection, and receipts around
an attached subject runtime such as Voice Workbench without becoming runtime
authority itself.

Two linked authority layers therefore remain explicit:

1. Operator/tool authority: `ALCH-US-*` and `ALCH-NAR-*` define how the
   developer launches Alchemy in `DEV` or `TEST`, attaches a subject runtime,
   selects a Story, steps or runs it, branches when a fixture allows multiple
   public commands, inspects Debug/Machine/Evidence, and detaches.
2. Subject-fixture authority: `STORY-*` and current Voice Workbench machine
   truth define the preview facts, admitted commands, checkpoints, and final
   receipts that Alchemy may project.

The tool may sequence, step, replay, contextualize, and inspect. It may not
replace the subject authority, invent new machine commands, or ship itself by
default in production builds.

## Product and host contract

- Primary local host: a dev/test-only Alchemy workspace with Story controls and
  a docked Inspector.
- Subject runtime: Voice Workbench renders or attaches inside the preview
  workspace through a dev-only bridge or host adapter.
- Tool authority boundary: Alchemy remains a projection and command surface,
  never lifecycle authority.
- Headless/CI parity: `igniteTest().story()` uses the same controlled
  Story/controller semantics and receipts without rendering Alchemy.
- Production invariant: the optimized subject application build ships no
  Alchemy UI, route, assets, bridge/listeners, fixture data, inspection
  endpoints, or receipts by default. Alchemy may still be served or
  distributed separately as a dev/test tool.
- Initial maturity: the current POC may remain example-local. Package
  extraction, CLI, and a public Ignite Alchemy API remain later decisions.

## Product stories

| Product story ID | User story | Outcome the product must provide | Bound fixture families | Maturity |
| --- | --- | --- | --- | --- |
| `ALCH-US-001` | As a developer, I can launch Ignite Alchemy in `DEV` or `TEST` and see which subject runtime is attached. | Tool chrome exposes environment, subject identity, and connection state before execution begins. | example-local Voice Workbench first | designed |
| `ALCH-US-002` | As a developer, I can select a deterministic Story and understand what subject fixture I am about to inspect. | Story identity, fixture summary, and review posture are visible before execution starts. | `STORY-002` first; other stories remain future scope | designed |
| `ALCH-US-003` | As a developer, I can step or run the selected Story while keeping Given, Intent, Behavior, Checkpoint, and branch boundaries legible. | The tool reveals one page at a time or the full remainder without changing subject truth. | `STORY-002` | designed over implemented fixture |
| `ALCH-US-004` | As a developer, I can choose between real public subject branches when the Story pauses at a branch boundary. | Branch choice is a tool-lane input that maps to real subject commands and is recorded in replay/receipt. | `STORY-002` page-4 branch boundary | designed over implemented commands |
| `ALCH-US-005` | As a developer, I can inspect failed checkpoints, Machine state, and Evidence without losing the selected Story or ordinary receipt. | Inspector tabs remain additive to subject truth and stay docked beside the preview. | selected `STORY-*`, initially `STORY-002` | designed |
| `ALCH-US-006` | As a developer, I can complete the same Story deterministically in headless/CI without rendering Alchemy. | Headless receipts remain semantically aligned with the tool-hosted Story controller. | any selected `STORY-*` | designed |
| `ALCH-US-007` | As a developer, I can prove that optimized production builds expose no Alchemy surface or inspection leakage. | Production absence is a build/security contract, not a hidden CSS state. | all future hosts | designed |

## Product narratives

| Narrative ID | Product narrative | Product intent | Bound `STORY-*` evidence | Terminal / rejoin | Maturity |
| --- | --- | --- | --- | --- | --- |
| `ALCH-NAR-001-DEVTOOL-STORY-REVIEW` | Golden dev/test tool walkthrough | developer launches Alchemy in `DEV`/`TEST`, attaches Voice Workbench, selects `STORY-002`, steps/runs it, chooses a branch when required, verifies the receipt, inspects the docked Inspector, then detaches | `STORY-002` | terminal pass into receipt/Inspector review | designed over implemented fixture |
| `ALCH-NAR-002-ATTACH-AND-DETACH` | Attach, disconnect, restart, or HMR subject runtime | tool truthfully reflects connected, disconnected, restarting, or reattached subject runtime posture | current example-local host | recoverable; rejoins story selection | designed |
| `ALCH-NAR-003-FAILED-CHECKPOINT-DEBUG` | Failure-first Debug branch | failed checkpoint auto-opens Inspector on Debug while the selected Story remains visible and ordinary receipt stays available | selected `STORY-*`, initially `STORY-002` | recoverable terminal | designed |
| `ALCH-NAR-004-BACK-REPLAY` | Fresh-fixture deterministic replay branch | Back disposes the current run, rebuilds a fresh fixture, and rejoins the prior page or branch boundary without in-place rewind | selected `STORY-*` page | rejoins restored prior page or branch boundary | designed |
| `ALCH-NAR-005-NO-LENS-REVIEW` | Full review without Machine proof | tool keeps Story pages and receipt reviewable while Machine says exactly `No XState lens` | selected `STORY-002` first | rejoins same review flow | designed |
| `ALCH-NAR-006-HEADLESS-CI-PARITY` | Headless receipt parity | CI and headless Story execution use the same controller semantics and branch defaults without rendering Alchemy | selected `STORY-*`, initially `STORY-002` | terminal receipt | designed |
| `ALCH-NAR-007-PRODUCTION-ABSENCE` | Production absence invariant | optimized subject application build exposes no Alchemy UI, route, bridge, or inspection surface while Alchemy remains a separate dev/test tool | build/security contract | terminal pass/fail contract | designed |

## Subject-fixture portfolio

| Story ID | Executable Story | Why this fixture matters | Commands | Named checkpoints | Final view / receipt posture | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| `STORY-001` | `preparation failure retries into ready` | clean retry-to-ready recovery path and simplest pass receipt | `beginModelPreparation` | `ready after retry` | final view returns to `status: "ready"` with `model.status: "available"` and `submitPrompt: true` | implemented |
| `STORY-002` | `microphone permission denial recovers to typed prompt` | golden subject fixture because page 4 exposes two real public recovery commands and the later pages prove deterministic continuation | `startVoiceCapture`, `submitPrompt` | `voice permission stays a fact`, `text recovery starts a new turn` | final view stays `status: "responding"` while `voiceState: "permission"` remains visible | implemented |
| `STORY-003` | `timed out turn retries to an accepted response` | timeout, retry, artifact creation, and accepted completion as ordinary deterministic truth | `submitPrompt`, `createArtifact`, `completeResponse` | `timeout returns the turn to idle`, `retry can finish with an accepted artifact`, `accepted retry returns to ready` | final view returns to `status: "ready"` with accepted response text and retained artifact revision `1` | implemented |
| `STORY-004` | `stale correlated model receipts stay inert until the live turn ends` | additive stale-evidence branch and live-correlation proof | `submitPrompt` plus actor-owned cancel events | `cancelled first turn returns idle`, `second turn is responding`, `stale port result stays inert`, `live correlation still controls exit` | final view returns to `status: "ready"` only when the live turn ends | implemented |

## Golden devtool walkthrough over `STORY-002`

| Product page ID | Product phase | Bound fixture page | Operator-visible tool outcome | Fixture evidence shown in preview / receipt | Controls before / after | Terminal / rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `ALCH-NAR-001-PAGE-00-LAUNCH-AND-ATTACH` | Launch / Attach | host attach surface | developer sees `Ignite Alchemy`, `DEV` or `TEST`, and subject status such as `Local · Voice Workbench · Connected` | host/bridge state only; no subject mutation implied | before: launch or attach; after: Story select | rejoin to story selection |
| `ALCH-NAR-001-PAGE-01-DISCOVER-GIVEN` | Discover / Given | `STORY-002-GIVEN-READY` | developer sees the attached Voice Workbench fixture and confirms the preview is ready for review | `view.status: "ready"`, `voiceState: "idle"`, `startVoiceCapture: true`, `submitPrompt: true` | before: select Story; after: Step or Run | rejoin to first release |
| `ALCH-NAR-001-PAGE-02-STEP-INTENT-START-VOICE` | Intent | `STORY-002-INTENT-START-VOICE` | one page is released and the tool shows that voice capture was explicitly requested | command trace shows `startVoiceCapture` and pending permission result | before: Step or Run; after: permission behavior | rejoin to permission behavior |
| `ALCH-NAR-001-PAGE-03-BEHAVIOR-PERMISSION-DENIED` | Behavior | `STORY-002-BEHAVIOR-PERMISSION-DENIED` | the attached preview visibly preserves the permission denial rather than silently recovering | correlated denial evidence and permission failure message remain visible as fixture truth | before: permission result pending; after: checkpoint | rejoin to page 4 |
| `ALCH-NAR-001-PAGE-04-CHECKPOINT-PERMISSION-STAYS-A-FACT` | Checkpoint / Branch boundary | `STORY-002-CHECKPOINT-VOICE-PERMISSION-STAYS-A-FACT` | tool pauses at the branch boundary and shows two admitted recovery choices in the Alchemy control lane while the preview keeps the real microphone and typed controls | named checkpoint `voice permission stays a fact`; `startVoiceCapture: true`; `submitPrompt: true`; `submitVoiceTranscript: false` | before: Step or Run; after: choose branch or continue default golden branch | branch boundary; rejoin depends on branch |
| `ALCH-NAR-001-PAGE-05-INTENT-TYPED-FALLBACK` | Intent | `STORY-002-INTENT-SUBMIT-TYPED-FALLBACK` | under the declared golden branch, the tool issues typed fallback and the preview shows that same input | exact input `{ modality: "text", text: "Continue with text fallback." }` is inspectable | before: typed fallback selected or defaulted by Run; after: responding checkpoint | rejoin to page 6 |
| `ALCH-NAR-001-PAGE-06-CHECKPOINT-NEW-RESPONDING-TURN` | Checkpoint | `STORY-002-CHECKPOINT-TEXT-RECOVERY-STARTS-A-NEW-TURN` | the attached preview moves into a new responding turn without clearing the permission fact | named checkpoint `text recovery starts a new turn`; final preview remains `status: "responding"` and `voiceState: "permission"` | before: branch continuation; after: receipt/Inspector review | terminal pass into page 7 |
| `ALCH-NAR-001-PAGE-07-VERIFY-RECEIPT` | Verify receipt | Story terminal receipt | the developer verifies the deterministic final receipt, branch choice, and changed command posture after every visible release has surfaced | final view remains `status: "responding"`, `voiceState: "permission"`, `createArtifact: true`, `completeResponse: false` | before: receipt hidden; after: Back, Restart, inspect tabs, detach | terminal review state |
| `ALCH-NAR-001-PAGE-08-CLOSE-OR-DETACH` | Close / Detach | host detach surface | developer closes or detaches Alchemy without mutating production behavior | host/bridge disposal facts only | before: close/detach; after: detached or closed | terminal host state |

## Page-4 admitted subject branches

Current Voice Workbench source proves exactly two public recovery branches at
page 4:

- `examples/agents/voice-workbench/src/workbench-narratives.test.ts:600-613`
  records `startVoiceCapture: true` and `submitPrompt: true` at checkpoint
  `voice permission stays a fact`.
- `examples/agents/voice-workbench/src/main.test.tsx:613-632` proves the
  microphone button remains public after denial and starts a new voice attempt.

| Branch ID | Branch type | Subject fact | Operator action in Alchemy | Bound subject command | Stable pages | Rejoin / terminal | Subject maturity | Operator maturity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ALCH-NAR-001-BRANCH-TYPED-FALLBACK` | golden continuation | text fallback is publicly admitted at page 4 | choose typed fallback in the runner lane or allow Run to use the declared default | `submitPrompt` | pages 5-7 as currently defined | rejoins page 5 and terminates at receipt review | implemented | designed over implemented command |
| `ALCH-NAR-001-BRANCH-RETRY-MICROPHONE` | alternate recovery | microphone retry is publicly admitted at page 4 after denial | choose retry microphone in the runner lane | `startVoiceCapture` | `ALCH-NAR-001-BRANCH-RETRY-PAGE-01-INTENT-START-VOICE-RETRY`, `ALCH-NAR-001-BRANCH-RETRY-PAGE-02-CHECKPOINT-VOICE-ATTEMPT-LISTENING` | alternate rejoin into the next voice attempt in `listening`; later terminal outcome stays under subject authority | implemented | designed over implemented command |

### `ALCH-NAR-001-BRANCH-RETRY-MICROPHONE` page materialization

| Branch page ID | Phase | Bound subject truth | Operator-visible outcome | Evidence boundary | Controls before / after | Rejoin |
| --- | --- | --- | --- | --- | --- | --- |
| `ALCH-NAR-001-BRANCH-RETRY-PAGE-01-INTENT-START-VOICE-RETRY` | Intent | page-4 denial checkpoint still admits `startVoiceCapture: true` | reviewer explicitly chooses Retry microphone in the Alchemy lane and the tool dispatches the public `startVoiceCapture` command | branch choice, command trace, and branch provenance are recorded; no transcript or acceptance is implied | before: branch boundary; after: next voice attempt checkpoint | rejoins retry branch page 2 |
| `ALCH-NAR-001-BRANCH-RETRY-PAGE-02-CHECKPOINT-VOICE-ATTEMPT-LISTENING` | Checkpoint | retry behavior in `examples/agents/voice-workbench/src/main.test.tsx:613-632` shows a new voice attempt entering listening after denial | preview remains on the same subject experience while the next voice attempt becomes active; Inspector may show additive details like a new attempt id or sequence increment | prove only new attempt/listening truth and command/evidence correlation; do not invent transcript success, second denial, or cancel | before: retry dispatch; after: inspect, continue later branch work, or Back replay | alternate recoverable rejoin at active listening attempt |

## Tool-lane branch and replay policy

- Step pauses at the page-4 branch boundary instead of silently choosing a
  future path.
- Branch choice is an Alchemy input recorded in replay and ordinary receipt
  provenance.
- Run uses the declared golden typed-fallback branch unless reviewer
  interaction is required.
- Back rebuilds to the branch boundary when needed, and changing choice
  truncates future evidence before replaying the newly selected path.
- The branch chooser belongs in Alchemy's runner/control lane. The subject
  preview continues to show its real microphone retry and typed input controls.

## Production absence invariant

`ALCH-NAR-007-PRODUCTION-ABSENCE` is a build/security contract for the
optimized subject application build:

- no Alchemy route;
- no Alchemy shell or assets;
- no dev bridge/listeners;
- no fixture data or receipts;
- no inspection endpoints; and
- no accidental production-mode toggle that reveals hidden devtools.

This invariant must be proven by build/exclusion receipts, not by a hidden CSS
state.

## Downstream implementation follow-through

- `task-1784602868853` must implement the Story controller branch lane,
  branch-default policy, replay semantics, and headless parity.
- `task-1784602883094` must implement the Machine/XState lens, including the
  retry-edge highlight and exact `No XState lens` fallback.
- `task-1784602901002` must implement the dev/test host shell, attach/detach
  lifecycle, docked split Inspector, and production exclusion.
- `task-1784602939863` must harden replay/receipt provenance for branch choice
  and rejoin semantics.
- `task-1784602955608` remains the package/distribution decision after
  dogfooding rather than part of this example-local pass.
