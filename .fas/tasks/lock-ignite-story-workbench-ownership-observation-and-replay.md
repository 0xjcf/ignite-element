# Lock Ignite Alchemy product, ownership, observation, and replay contracts

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Create the example-local architecture contract that establishes Ignite Alchemy as the product identity and Story Workbench as its descriptive category before Mock Studio synthesis or implementation. Lock the product promise and maturity, source-of-truth matrix, responsibility and execution axes, browser host placement, browser-safe Story boundary, stable page model, fresh-fixture lifecycle, replay, coverage dispositions, optional XState evidence limits, derived report boundary, verification lanes, migration, rollback, and post-MVP packaging threshold. Preserve literal Ignite and XState vocabulary and existing Story execution and receipts. Do not add a public API, package, runner, recorder, trace, graph algorithm, browser import of tests, or authoritative mock.


## Acceptance criteria
- The artifact defines the product promise and maturity ladder for Ignite Alchemy: approved prototype, technical POC, example-local MVP, second-adopter preview, and only then a separate packaging decision.
- A dedicated examples/agents/voice-workbench/story-workbench-architecture.md records the problem, source-of-truth matrix, responsibility axis, execution axis, maturity, host placement, and rollback boundary.
- The contract defines a browser-safe shared Story module shape that ordinary functions can implement while both Vitest and the browser invoke the existing igniteTest component story API directly.
- The page model assigns stable story and page identities and distinguishes given, intent, behavior, checkpoint, assertion-only, expected-no-change, projection-only, internal-system, excluded, and unmapped dispositions.
- Replay semantics require a fresh fixture for every run and require Back to dispose, rebuild, and replay to the target page; no in-place state rewind is allowed.
- The XState lens contract is optional and shows only observed or directly provable topology, active states, transitions, triggers, guard labels, and causality; unavailable causality fails closed.
- Timing is classified as reviewer telemetry and excluded from semantic replay equivalence unless a deterministic fake clock supplies the asserted value.
- The derived coverage and CI or LLM review artifact references existing Story receipts and lens evidence without becoming a replacement trace or execution authority.
- No files under packages/ignite-element are planned for modification and the task records that public package extraction requires a separate post-dogfood adoption decision.
- The README links the architecture artifact and describes Ignite Alchemy as an example-local product MVP rather than a shipped public package.
- Documentation validation proves that the source-of-truth matrix, forbidden couplings, dependency graph, Mock Studio handoff inputs, and W2 decisions are complete and mutually consistent.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Write one architecture artifact organized around product maturity, authorities, the controlled execution envelope, portable Story/page contracts, session lifecycle, optional observation, evidence joins, host placement, coverage, reports, verification, migration, and rollback.
- Treat Ignite Story execution and receipts, XState topology and actor evidence, fixture-owned external controls, and Ignite Alchemy reviewer projections as separate authorities joined by stable identities and ordered evidence.
- Make the artifact the input contract for both shared Story extraction and the Mock Studio/MagicPath product prototype.

## Alternatives considered
- Rejected a public Workbench package or API before dogfood and a second adopter.
- Rejected defineStory, runStory, graph helpers, public inspect or blueprint APIs, getSchema metadata, a second recorder, and a replacement trace.
- Rejected browser imports of Vitest files, in-place state rewind, machine mocks as transition authority, and universal statechart language for non-XState adapters.

## Architecture Context
```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Portable Story pages express reviewer-readable given, intent, behavior, and checkpoint steps through the existing igniteTest component Story API; they do not introduce a second runner or execution vocabulary."
    ],
    "behavior": [
      "The real Voice Workbench XState machines, child actors, guards, context, correlation, cancellation, retry, and recovery remain the transition authority while fixture-owned external boundaries provide controlled facts."
    ],
    "policies": [
      "Fresh-fixture execution, dispose-before-rebuild replay, stable Story and page identity, evidence certainty, coverage dispositions, redaction, and bounded report generation govern reviewer behavior without changing machine semantics."
    ],
    "capabilities": [
      {
        "name": "voice-workbench-story-execution",
        "qualifier": "business",
        "owner": "Voice Workbench shared Story definitions and real state machines"
      },
      {
        "name": "ignite-story-receipts",
        "qualifier": "runtime",
        "owner": "Existing igniteTest component Story API"
      },
      {
        "name": "xstate-topology-and-observation-evidence",
        "qualifier": "runtime",
        "owner": "Optional example-local XState lens"
      },
      {
        "name": "ignite-alchemy-reviewer-experience",
        "qualifier": "host-product",
        "owner": "Example-local Vite Story Workbench application"
      },
      {
        "name": "llm-review-artifact-consumption",
        "qualifier": "agent-model",
        "owner": "Downstream consumers of the derived JSON-safe review report"
      }
    ],
    "ports": [
      "Browser-safe Story modules expose ordinary fixture and page functions consumed by both Vitest and the browser through the existing igniteTest Story API.",
      "Fixture ports control clocks, providers, microphone or speech capabilities, identifiers, persistence, and external receipts while preserving real machine execution."
    ],
    "adapters": [
      "Vitest and browser hosts adapt the same portable Story definitions to their environment without importing test files into browser code.",
      "The optional XState lens adapts graph topology and actor observations into bounded evidence and fails closed when causality is unavailable."
    ],
    "infrastructure": [
      "The existing Voice Workbench Vite host, Vitest lanes, XState graph utilities, browser automation, fake clock, and deterministic fixtures provide execution and validation infrastructure."
    ],
    "projections": [
      "Ignite Alchemy projects existing Story receipts, active snapshots, views, command availability, topology, observations, context diffs, coverage, and timing telemetry for review.",
      "The derived review report references unchanged Story receipts and optional lens evidence without becoming a replacement trace or source of execution truth."
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "Story and page catalogs, stable identity joins, semantic context diffs, replay equivalence, coverage classification, evidence certainty, normalization, and redaction are deterministic and browser-safe."
    ],
    "imperativeShell": [
      "Fixture creation and disposal, actor startup and observation, clocks and provider controls, Vite mounting, browser interaction, animation, and report persistence remain host-owned imperative work."
    ]
  },
  "ownership": [
    {
      "owner": "Existing igniteTest Story execution and receipts",
      "responsibilities": [
        "Own page execution, awaited outcomes, assertions, and the authoritative final Story receipt."
      ],
      "maturity": "current"
    },
    {
      "owner": "Voice Workbench XState machines and fixture-controlled ports",
      "responsibilities": [
        "Own workflow transitions and controlled external facts used by deterministic Story runs."
      ],
      "maturity": "current"
    },
    {
      "owner": "Ignite Alchemy example-local application",
      "responsibilities": [
        "Own reviewer session control, visual projection, evidence joins, coverage review, and the derived report without becoming an execution authority."
      ],
      "maturity": "target"
    },
    {
      "owner": "Optional XState lens",
      "responsibilities": [
        "Own bounded topology and observation evidence with explicit exact, candidate, or unavailable certainty."
      ],
      "maturity": "target"
    }
  ],
  "maturity": [
    {
      "claim": "The existing igniteTest Story API, Story receipts, Voice Workbench machines, graph evaluation, and Vite example host are implemented authorities that Ignite Alchemy must compose.",
      "status": "current",
      "evidenceRefs": [
        "examples/agents/voice-workbench/README.md",
        "examples/agents/voice-workbench/xstate-graph-story-evaluation.md",
        "packages/ignite-element/src/testing"
      ]
    },
    {
      "claim": "The Ignite Alchemy architecture contract, shared browser-safe Stories, approved MagicPath prototype, and browser POC are pre-MVP gates rather than shipped product claims.",
      "status": "transitional",
      "evidenceRefs": [
        ".fas/tasks/lock-ignite-story-workbench-ownership-observation-and-replay.md",
        ".fas/tasks/create-and-approve-the-ignite-alchemy-mock-studio-foundation.md",
        ".fas/tasks/prove-ignite-alchemy-story-stepping-replay-and-observation-s.md"
      ]
    },
    {
      "claim": "The initial deliverable is an example-local Ignite Alchemy MVP; public packaging is considered only after dogfood and a second real adopter prove repeated value.",
      "status": "target",
      "evidenceRefs": [
        ".fas/queue/tasks.json",
        ".fas/tasks/produce-the-approved-ignite-alchemy-mvp-implementation-hando.md"
      ]
    }
  ],
  "boundaries": [
    "Story execution and receipts remain authoritative for narrative outcomes; Ignite Alchemy may project but not replace them.",
    "XState machines remain authoritative for workflow transitions; controlled fakes model only external boundaries and cannot stand in for machine behavior.",
    "XState topology and observation are optional evidence lenses; adapters without statecharts remain reviewable without pretending to expose statechart semantics.",
    "Back and restart dispose the active fixture before creating and replaying a fresh fixture; no in-place state rewind is permitted.",
    "Timing is reviewer telemetry unless an asserted value comes from a deterministic fake clock.",
    "The MVP stays under examples/agents/voice-workbench and does not modify packages/ignite-element."
  ],
  "forbiddenCouplings": [
    "A public defineStory, runStory, recorder, trace, graph helper, inspection, blueprint, or schema API added for the Workbench.",
    "Browser code importing Vitest test files or depending on Vitest globals and assertions.",
    "Workbench UI, coverage, or report code mutating actor state, driving hidden transitions, or becoming a second Story execution authority.",
    "Machine mocks used as transition authority instead of real XState machines with controlled external ports.",
    "Snapshot deltas presented as exact transition source, trigger, guard, or causality when observation evidence is ambiguous.",
    "Alchemy presentation language replacing literal Ignite API, XState state, event, guard, receipt, and evidence vocabulary.",
    "A public package, CLI, or hosted-service commitment before MVP dogfood and second-adopter evidence."
  ],
  "evidenceRefs": [
    "examples/agents/voice-workbench/README.md",
    "examples/agents/voice-workbench/xstate-graph-story-evaluation.md",
    ".fas/tasks/lock-ignite-story-workbench-ownership-observation-and-replay.md",
    ".fas/tasks/extract-browser-safe-shared-voice-workbench-story-modules-an.md",
    ".fas/tasks/create-and-approve-the-ignite-alchemy-mock-studio-foundation.md",
    ".fas/tasks/prove-ignite-alchemy-story-stepping-replay-and-observation-s.md",
    ".fas/tasks/produce-the-approved-ignite-alchemy-mvp-implementation-hando.md",
    ".fas/queue/tasks.json"
  ]
}
```

## Affected files
- examples/agents/voice-workbench/story-workbench-architecture.md
- examples/agents/voice-workbench/README.md

## Scope Amendments
- None.

## Implementation plan
- Review the completed Story, narrative ergonomics, XState graph, headless runtime, and open Voice Workbench host-convergence evidence.
- Write the dedicated Story Workbench architecture artifact with ownership, maturity, source-of-truth, execution-axis, host, page, replay, lens, coverage, evidence, migration, and rollback contracts.
- Define the Ignite Alchemy product promise and the exact behavior, machine, experience, and design-system inputs required before MagicPath synthesis.
- Lock forbidden couplings and the exact handoff criteria for shared Story extraction.
- Reconcile the artifact, task brief, and live epic graph before handoff.

## Verification plan
- Validate the architecture artifact against the current testing DSL, headless runtime contract, narrative dogfood, graph verdict, and live queue.
- Confirm every W2 acceptance decision is resolved without changing packages/ignite-element or introducing a public API.
- Run fas validate-task for the documentation and planning gate; run the full repository lane only if tracked product or example source changes enter scope.

## Risks
- Universal guard or passive-transition causality may be impossible to prove; the contract must fail closed.
- The open Voice Workbench hexagonal chain may change fixture or host boundaries; implementation remains gated on task-1784298700854.
- Workbench convenience could leak into Ignite public APIs or create a second trace unless forbidden couplings remain explicit.
- Product branding could obscure canonical API and evidence vocabulary unless the architecture requires literal technical labels beneath the Alchemy presentation language.

## Dependencies
- Consumes completed Story and graph evidence from task-1784171502136 as historical input, not a live edge.
- Blocks shared Story extraction task-1784602854408.
- Blocks Ignite Alchemy Mock Studio and MagicPath prototype task-1784655399770.
- Has no unresolved implementation dependency and remains the current eligible epic task.

## Open questions
- The public distribution form remains deliberately unresolved until the MVP has a second real adopter; W1 records evaluation criteria but does not choose a package, CLI, or hosted service.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
