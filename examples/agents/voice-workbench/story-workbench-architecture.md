# Ignite Alchemy Story Workbench Architecture

Date: 2026-07-21
Example: `examples/agents/voice-workbench`
Task: `direct-1784656450498` / `task-1784602834084`

## Product promise and category

Ignite Alchemy is the product identity for the example-local reviewer workflow
around executable Voice Workbench Stories. Story Workbench is the descriptive
category: a controlled review surface that steps through existing Story pages,
projects bounded evidence, and helps a human or downstream agent inspect what
the current Voice Workbench machines and fixtures already proved.

Ignite Alchemy is not a public Ignite package, a second Story runner, a graph
engine, or a hosted service commitment. It is an example-local MVP target under
`examples/agents/voice-workbench` that preserves literal Ignite and XState
vocabulary under the Alchemy presentation language.

## Maturity ladder

| Stage | Meaning | Status |
| --- | --- | --- |
| Approved prototype | Product identity, reviewer stories, design-system direction, and MagicPath provenance are approved as design evidence. | Planned by `task-1784655399770` |
| Technical POC | The narrow browser proof exercises risky seams such as page stepping, Back replay, and optional observation without claiming production readiness. | Planned by `task-1784655415553` |
| Example-local MVP | The first real product target stays inside this example, composes the existing Story executor, and remains separate from public package decisions. | Target |
| Second-adopter preview | A second real adopter proves repeat value beyond this example and validates what should stay example-local versus extracted. | Future gate |
| Separate packaging decision | Only after dogfood plus a second adopter can the repo evaluate a public package, CLI, hosted service, or compatibility commitment. | Explicitly deferred |

No stage above may be implied early. Prototype approval is not MVP admission,
POC success is not a production handoff, and example-local MVP is not a public
distribution promise.

## Controlled execution envelope

Ignite Alchemy is deterministic only within a controlled envelope:

- Real Voice Workbench XState machines remain the transition authority.
- The existing `igniteTest({ component }).story(...)` executor remains the
  Story execution authority.
- Fixtures own external controls such as clocks, provider receipts,
  microphone/speech capabilities, identifiers, persistence, and teardown.
- Ignite Alchemy may gate, project, join, redact, and sequence evidence; it may
  not mutate machine state through hidden shortcuts or replace the Story receipt.

The product must therefore present certainty honestly. When evidence is exact,
it may say so. When evidence is only candidate or unavailable, the UI and any
derived report must fail closed instead of manufacturing causal confidence.

## Source-of-truth matrix

| Surface | Authority | Why it stays authoritative |
| --- | --- | --- |
| Story pages, awaited outcomes, assertions, and final receipt | Existing `igniteTest({ component }).story(...)` execution plus ordinary Story receipts | This is the current executable review contract. |
| Workflow transitions, guards, child actors, retries, cancellation, and recovery | Real Voice Workbench XState machines and actor-owned reducers | Workbench state and lifecycle truth already live here. |
| External facts | Controlled fixture ports and host adapters | Fixtures model the boundaries without replacing machine behavior. |
| Reviewer stepping session | Ignite Alchemy controller built around the existing Story executor | It sequences review without becoming another execution authority. |
| Topology and observation evidence | Optional XState lens | Statechart evidence is additive and may be unavailable. |
| Coverage joins and gap review | Example-local coverage projection | Coverage is derived from stable joins, not from test-source parsing or graph execution. |
| Read-only JSON-safe downstream artifact | Derived review report | The report embeds unchanged Story receipts and additive evidence; it is not a competing trace. |

## Responsibility axis

Ignite Alchemy keeps capability ownership explicit instead of collapsing
business, runtime, host-product, and agent-model roles into one layer.

| Capability | Qualifier | Owner |
| --- | --- | --- |
| Voice Workbench Story execution | `business` | Shared Story definitions plus real Voice Workbench machines |
| Ignite Story receipts | `runtime` | Existing Ignite Story executor and receipt surface |
| XState topology and observation evidence | `runtime` | Optional example-local XState lens |
| Reviewer session control and projection | `host-product` | Example-local Vite-hosted Ignite Alchemy application |
| Derived report consumption | `agent-model` | Read-only downstream human, CI, or LLM consumers |

Business meaning stays with Story and machine behavior. Runtime meaning stays
with Ignite and XState. Host-product meaning stays with the reviewer
application. Agent-model meaning stays with consumers of the derived report.

## Functional core and imperative shell

The execution axis stays independent from the responsibility axis.

Functional core:

- Stable `storyId` and `pageId` joins
- Story/page catalogs
- Page disposition classification
- Semantic context diffs
- Replay equivalence rules
- Coverage classification and gap labeling
- Evidence certainty labels
- Report normalization, redaction, and bounding

Imperative shell:

- Fixture construction and disposal
- Actor creation and optional observation installation
- Clocks, providers, microphone, and speech controls
- Vite/browser mounting
- Human stepping controls such as Step, Back, Restart, and Cancel
- Report persistence and local artifact writing

The core stays browser-safe and JSON-safe. The shell owns side effects and
never leaks them back into the semantic model as if they were pure facts.

## Host placement and convergence boundary

The intended host is an example-local Vite reviewer surface under
`examples/agents/voice-workbench`. That host is the product shell for Ignite
Alchemy, but host convergence is not complete yet.

- W1 records the target placement and contract.
- W2 (`task-1784602854408`) extracts browser-safe shared Stories and fixtures.
- W3 (`task-1784655415553`) proves the risky browser seams in a narrow POC.
- Production implementation and handoff remain downstream of those steps.

This document does not claim that browser, terminal, parity, and headless hosts
have already converged into the final Alchemy product. It only fixes where the
reviewer shell belongs once those prerequisites are satisfied.

## Browser-safe Story contract

Shared Story modules must remain ordinary functions that both Vitest and the
browser can consume through the existing Story executor. W2 may extract browser
safe modules, but it may not introduce `defineStory`, `runStory`, or a second
execution vocabulary.

The intended execution shape is:

1. Construct a fresh real fixture.
2. Build the real machine, actor, runtime, and controlled ports from that
   fixture.
3. Execute the Story through `igniteTest({ component }).story(...)`.
4. Release page-level reviewer controls around the existing Story steps rather
   than replacing them.
5. Return the ordinary final Story receipt unchanged.

Browser safety means the shared modules avoid Vitest globals, test-file imports,
and private package internals. It does not mean replacing real machine
execution with mocks.

## Stable story and page identity

Every reviewable Story needs a stable semantic `storyId`. Every page inside
that Story needs a stable semantic `pageId`. Both identifiers must be stable
across browser order, array position, replay count, receipt serialization, and
coverage projections.

Story/page identity joins are the basis for:

- stepping through exactly one page at a time;
- correlating optional lens evidence to a review page window;
- mapping coverage from Stories to machine states and edges;
- comparing repeated runs; and
- embedding page outcomes in the derived report.

Array index, render order, and timing must never be treated as identity.

## Page disposition model

Each page must have one explicit disposition. These dispositions are additive
review metadata, not alternate execution semantics.

| Disposition | Meaning |
| --- | --- |
| `given` | Preconditions or initial state setup the reviewer should inspect before intent starts. |
| `intent` | A public command or caller-owned action that contributes a new fact. |
| `behavior` | A fixture-owned external operation or passive runtime event. |
| `checkpoint` | A semantic assertion boundary with named evidence. |
| `assertion-only` | Test-only evidence kept in Vitest or direct verification and not rendered as an interactive reviewer page. |
| `expected-no-change` | An observed step that should preserve the current semantic state. |
| `projection-only` | A product projection page that does not claim a new machine transition. |
| `internal-system` | Internal orchestration or receipt data that may be visible as evidence but is not a public reviewer action. |
| `excluded` | Intentionally out of scope for coverage parity or reviewer stepping. |
| `unmapped` | Not yet classified; treated as incomplete work rather than silently guessed. |

The reviewer shell may surface these dispositions, but it may not relabel an
internal-system receipt as public intent or pretend a projection-only page
caused a transition.

## Real machines and controlled ports

Ignite Alchemy runs only against real Voice Workbench machines. It may control
ports, clocks, and adapters, but it may not replace the machine with a mock as
the transition authority.

Controlled ports remain the boundary for:

- preparation receipts;
- model-turn receipts;
- voice capture receipts;
- speech delivery receipts;
- timing and timeout control; and
- other external deterministic fixtures needed for Story execution.

This keeps actor-owned lifecycle truth and external-fact injection separate.

## Replay and fixture lifecycle

Every run, restart, and Back replay must create a fresh fixture. No in-place
rewind is allowed.

Rules:

- `Run` starts from a newly constructed fixture.
- `Restart` disposes the active fixture, rebuilds a fresh one, and reruns from
  the beginning.
- `Back` disposes the active fixture, rebuilds a fresh one, and deterministically
  replays to the target prior page.
- Replacement work must cancel or suppress stale async updates with generation
  tokens or equivalent session ownership.
- The product must never mutate snapshots or inject hidden events to simulate
  rewind.

This is stricter than a visual scrubber. Replay is semantic reconstruction from
the authoritative Story path, not timeline mutation.

## Optional XState topology and observation evidence

The XState lens is optional and additive. Ignite Alchemy must remain useful
without it.

When the lens is present, it may project:

- observed topology version;
- active parallel nodes;
- snapshot deltas;
- directly evidenced transitions;
- candidate edges;
- trigger labels when directly supported;
- guard labels when directly supported; and
- child or passive activity evidence.

Certainty must be explicit:

- `exact` when the evidence directly proves the claim;
- `candidate` when the evidence suggests but does not uniquely prove the claim;
- `unavailable` when the lens cannot safely support the claim.

Unknown causality stays `unavailable`. Snapshot deltas are not universal proof
of source state, trigger, guard, or passive-transition cause.

## Coverage joins and no-lens behavior

Coverage is a stable join between declared Story/page identities, Story
receipts, optional XState evidence, and direct verification evidence already
owned elsewhere.

Required joins include:

- Story to machine path
- machine state to Story set
- edge to review page
- page to active observation window
- gap and exclusion provenance

When no lens is present, machine coverage is `unavailable`, not zero and not
implicitly uncovered. Absence of statechart evidence must fail closed.

## Derived report boundary

The derived report is a versioned, bounded, redacted, JSON-safe artifact for
read-only CI and LLM review. It embeds unchanged Story receipts and adds joined
review metadata such as page outcomes, optional observation evidence, coverage,
gaps, exclusions, and verification provenance.

The report is not:

- a replacement trace;
- a second execution receipt;
- a new source of runtime truth; or
- a public compatibility guarantee.

If a field is volatile, unbounded, or unsafe to expose, it must be omitted,
redacted, or normalized before the report is written.

## Reviewer timing telemetry

Timing inside Ignite Alchemy is reviewer telemetry by default. It helps explain
session pacing, browser responsiveness, and debugging context, but it is not
part of semantic replay equivalence unless a deterministic fake clock explicitly
owns the asserted timing fact.

Wall-clock or browser-tick timing must therefore stay out of semantic equality
claims and out of any exact causality conclusion.

## Mock Studio inputs

Mock Studio and MagicPath work consume this architecture contract rather than
inventing a new one. The reviewer prototype and later handoff must take input
from:

- behavior: approved reviewer stories and bounded narrative branches;
- machine: real lifecycle authorities, optional lens evidence, and race
  precedence cases;
- experience: state-to-screen coverage, control dispositions, responsive
  anatomy, accessibility, motion, and no-lens behavior;
- design system: token direction, surface inventory, and explicit deferred or
  unsupported states.

The generated MagicPath React, if any, remains design evidence only until a
later implementation artifact says otherwise.

## Verification lanes

W1 verification stays documentation-focused:

- structural consistency against current README, narrative audit, graph
  evaluation, and queue dependencies;
- focused doc inspection and `rg` checks for wording drift;
- `git diff --check`;
- `fas validate-task`.

W2 and later own runtime, browser, typecheck, build, and full-lane verification
when product source enters scope.

## Forbidden couplings

The following remain out of bounds:

- adding a public `defineStory`, `runStory`, recorder, trace, graph helper,
  inspection helper, blueprint helper, or schema API for Ignite Alchemy;
- importing Vitest files or globals into browser Story modules;
- treating Workbench UI or reports as a second execution authority;
- using machine mocks as transition authority;
- claiming exact causality from ambiguous observation evidence;
- replacing canonical Ignite, Story, receipt, XState, command, view, or guard
  vocabulary with product-only branding;
- deciding a public package, CLI, hosted service, or compatibility contract
  before dogfood and second-adopter proof.

## Migration, rollback, and packaging threshold

Migration is additive:

- W1 defines the contract.
- W2 extracts browser-safe Stories and fixtures without changing package APIs.
- W3 proves the risky seams in a narrow browser POC.
- Later work may build the example-local MVP shell, coverage joins, and derived
  report in bounded slices.

Rollback is equally explicit: if W2 or W3 cannot preserve these boundaries, the
repo keeps the current Story and verification surfaces and narrows claims rather
than widening Ignite APIs.

Public extraction is gated by dogfood plus a second adopter. Until then, Ignite
Alchemy remains an example-local product and Story Workbench remains a
descriptive category, not a shipped public package.

## Downstream dependency chain

This task blocks:

- W2 `task-1784602854408` to extract browser-safe shared Story modules and
  fresh-fixture entrypoints;
- M1 `task-1784655399770` to create and approve the Ignite Alchemy Mock Studio
  foundation and MagicPath prototype.

W2 still depends on `task-1784298700854` to finish host convergence and close
the reviewed hexagonal boundary gaps before shared browser-safe Story extraction
can become authoritative.
