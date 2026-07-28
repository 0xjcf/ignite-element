# Define the versioned evidence-governed Actor-Web consumer contract for Ignite

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Define the additive, optional consumer boundary through which Ignite can project Actor-Web authenticated admission facts, execution receipts, durable-session checkpoints, replay/restart state, and reconciliation outcomes without becoming the execution authority. Start from the accepted cross-repo ownership contract and Actor-Web tasks task-1785250528660, task-1785250545761, and task-1785250562339; preserve current loose structural source compatibility and treat any unavailable upstream schema as provisional rather than inventing shipped interoperability.

## Acceptance criteria
- A versioned JSON-safe consumer envelope distinguishes command proposal, schema admission, domain acceptance, execution authorization, effect intent, execution receipt, checkpoint, rehydration, and reconciliation facts.
- A source-of-truth matrix names the owner of durable facts, principal and approval state, artifact revisions, intent and correlation ids, attempt and sequence ids, retry and replay rules, and effect-confirmation receipts.
- The contract defines unsupported-version, malformed, stale, conflicting, redacted, and unavailable dispositions that fail closed as diagnostic facts.
- Projected capability availability is explicitly descriptive and the Actor-Web runtime remains responsible for execution-time authorization, payload, approval, revision, idempotency, and policy rechecks.
- Ignite Story traces, Actor-Web execution receipts, and FAS evidence bindings remain separate provenance-bearing artifacts with explicit join keys.
- Current, accepted-target, candidate, and deferred maturity labels prevent the Actor-Web task briefs from being described as already shipped.
- No public Ignite inspection, blueprint, orchestration, receipt, or universal interaction-plan API is introduced by this architecture task.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Architecture Context

This task inherits the accepted exact-source and native-lifecycle boundary from
`task-1784909239951`, then narrows it for evidence consumption. The referenced
Actor-Web execution-trace, admission, and durable-checkpoint tasks are still
deferred, and no authoritative versioned fixture exists in the inspected
Actor-Web checkout. Their field shapes therefore remain accepted-target inputs,
not shipped compatibility claims.

```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Define an additive, optional, versioned, JSON-safe consumer boundary through which Ignite can project Actor-Web admission, execution, checkpoint, rehydration, replay, and reconciliation evidence without acquiring authentication, authorization, execution, persistence, replay, or reconciliation authority."
    ],
    "behavior": [
      "Models and other advisors propose commands or artifacts; explicit application behavior and policy constrain what may be admitted.",
      "Actor-Web validates, authorizes, executes, persists, resumes, reconciles, and emits authoritative runtime facts and receipts.",
      "Ignite consumes exact caller-owned sources, projects semantic facts and diagnostic dispositions, binds command intent, and produces separate Story or narrative evidence.",
      "FAS normalizes optional evidence inputs and governs FAS workflow, review, and evidence policy without becoming an application runtime."
    ],
    "policies": [
      "Projected canExecute or capability availability is descriptive preflight only; Actor-Web rechecks command existence, payload validity, principal authority, approval freshness, revision freshness, idempotency, and policy at execution.",
      "Ignite never infers authoritative success from send, optimistic state, projected availability, or an Ignite Story trace.",
      "Actor-Web execution receipts, Ignite Story traces, and FAS evidence bindings remain separate provenance-bearing artifacts joined only by explicit identifiers.",
      "Unsupported, malformed, stale, conflicting, redacted, and unavailable inputs fail closed as diagnostic facts rather than projection-owned exceptions.",
      "Published architecture uses current, accepted-target, candidate, and deferred labels; deferred Actor-Web task briefs are not described as shipped schemas.",
      "Every Actor-Web, Ignite, and FAS integration remains optional, and every repository remains independently useful."
    ],
    "capabilities": [
      {
        "name": "domain command proposal and artifact intent",
        "qualifier": "business",
        "owner": "consumer application and its explicit behavior model"
      },
      {
        "name": "authenticated admission, execution, durable receipts, checkpointing, replay, and reconciliation",
        "qualifier": "runtime",
        "owner": "Actor-Web runtime"
      },
      {
        "name": "workflow evidence normalization, review policy, and conformance governance",
        "qualifier": "agent-model",
        "owner": "FAS when optionally present"
      },
      {
        "name": "semantic projection, command binding, diagnostics, and narrative evidence",
        "qualifier": "host-product",
        "owner": "Ignite Element and the consuming host"
      }
    ],
    "ports": [
      "the exact caller-owned Actor-Web source and its current loose structural snapshot, command, emitted-event, and transport-status seams",
      "a future authoritative versioned Actor-Web evidence fixture carrying admission, execution receipt, checkpoint, rehydration, replay, and reconciliation facts",
      "Ignite semantic projection and command-intent bindings that never authorize or confirm execution",
      "a versioned redacted JSON-safe fixture exported for optional FAS behavioral-evidence adapters without importing FAS at Ignite runtime"
    ],
    "adapters": [
      "the current optional structural Actor-Web adapter in packages/ignite-adapters",
      "the future additive Actor-Web execution-evidence projection adapter gated on an accepted upstream fixture",
      "Ignite Story and narrative evidence serializers with provenance and join keys distinct from Actor-Web receipts",
      "FAS optional behavioral-evidence adapters that consume exported fixtures outside Ignite runtime"
    ],
    "infrastructure": [
      "Actor-Web actor lifecycle, authentication boundary, effect journal, durable checkpoint storage, replay, transport, and reconciliation infrastructure",
      "Ignite Core, ignite-adapters, headless testing, Story evidence, and host projection infrastructure",
      "FAS queue, review, evidence normalization, and conformance infrastructure when optionally composed"
    ],
    "projections": [
      "descriptive admission and availability facts that never replace execution-time authorization",
      "authoritative Actor-Web execution, timeout, retry, cancellation, partial-failure, checkpoint, replay, and reconciliation facts rendered without changing their provenance",
      "Ignite-owned diagnostic facts for unsupported, malformed, stale, conflicting, redacted, or unavailable evidence",
      "Ignite Story traces and FAS evidence bindings stored separately and correlated through explicit intent, correlation, attempt, revision, sequence, and receipt identifiers"
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "validate version and JSON-safe envelope shape without I/O or clocks",
      "classify maturity, freshness, redaction, unsupported, malformed, stale, conflicting, and unavailable dispositions as deterministic facts",
      "map accepted Actor-Web evidence into semantic projection facts without inventing missing authority or success",
      "preserve provenance and explicit join keys while keeping Actor-Web receipts, Ignite traces, and FAS bindings distinct"
    ],
    "imperativeShell": [
      "subscribe to the exact caller-owned Actor-Web source through optional structural capabilities",
      "obtain authoritative evidence from Actor-Web runtime and durable infrastructure",
      "bind user intent to source commands while leaving admission and execution reauthorization in Actor-Web",
      "export redacted versioned fixtures for tests and optional FAS consumers without runtime imports",
      "dispose only Ignite-owned subscriptions and projection resources, never the caller-owned source"
    ]
  },
  "ownership": [
    {
      "owner": "consumer application and explicit behavior model",
      "responsibilities": [
        "own domain commands, artifact meaning, guards, approval requirements, and business policy",
        "propose intent without treating model output or projection state as transition authority"
      ],
      "maturity": "current"
    },
    {
      "owner": "Actor-Web runtime",
      "responsibilities": [
        "own authentication reduction, principal context, command admission, execution-time authorization, lifecycle, persistence, effect attempts, durable receipts, retry, replay, resume, and reconciliation",
        "emit authoritative facts with provenance, redaction, ordering, idempotency, freshness, and retention semantics"
      ],
      "maturity": "target"
    },
    {
      "owner": "Ignite Element",
      "responsibilities": [
        "preserve exact source identity and native lifecycle ownership",
        "project semantic runtime facts, bind command intent, expose errors as diagnostic facts, and produce separate Story or narrative evidence",
        "remain independent of Actor-Web and FAS as required runtime dependencies"
      ],
      "maturity": "current"
    },
    {
      "owner": "FAS",
      "responsibilities": [
        "normalize optional evidence, govern FAS workflow and review policy, and retain FAS provenance",
        "consume exported fixtures without becoming Actor-Web execution authority or an Ignite runtime dependency"
      ],
      "maturity": "current"
    }
  ],
  "maturity": [
    {
      "claim": "Ignite currently accepts the canonical Actor-Web source through a loose self-contained structural adapter and compile-time compatibility lane without leaking the optional peer into shipped declarations.",
      "status": "current",
      "evidenceRefs": [
        "packages/ignite-adapters/src/adapters/ActorWebAdapter.ts",
        "packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts"
      ]
    },
    {
      "claim": "Actor-Web currently publishes a neutral schemaVersion 1 runtime event envelope with correlation and causation identifiers, but this is not the requested authoritative agent execution-receipt or checkpoint fixture.",
      "status": "current",
      "evidenceRefs": [
        "../actor-web/packages/actor-core-runtime/src/runtime-projection.ts"
      ]
    },
    {
      "claim": "A provider-neutral Actor-Web execution trace and receipt contract with ordering, idempotency, freshness, retention, and redaction semantics is an accepted target that is still dependency-deferred.",
      "status": "target",
      "evidenceRefs": [
        "../actor-web/.fas/tasks/define-provider-neutral-agent-execution-trace-and-receipt-co.md",
        "../actor-web/.fas/queue/tasks.json"
      ]
    },
    {
      "claim": "Authenticated command-admission facts and durable agent-session checkpoint and rehydration envelopes are accepted targets that remain downstream of the deferred trace and receipt contract.",
      "status": "target",
      "evidenceRefs": [
        "../actor-web/.fas/tasks/propagate-authenticated-principal-context-and-emit-command-a.md",
        "../actor-web/.fas/tasks/add-durable-agent-session-checkpoint-and-rehydration-seam.md"
      ]
    },
    {
      "claim": "Ignite evidence-governed projection field shapes remain provisional until an authoritative versioned Actor-Web fixture and package version are accepted and reconfirmed.",
      "status": "target",
      "evidenceRefs": [
        ".fas/tasks/define-the-versioned-evidence-governed-actor-web-consumer-co.md"
      ]
    }
  ],
  "boundaries": [
    "Actor-Web owns authentication, authorization, execution, durable runtime facts, receipts, checkpoints, replay, resume, and reconciliation.",
    "Ignite owns projection, command-intent binding, deterministic diagnostic classification, and separate narrative evidence only.",
    "FAS owns FAS workflow evidence normalization and review policy only when optionally present.",
    "The consuming application owns domain commands, artifact lifecycle, guards, approvals, and business authorization rules.",
    "The exact caller-owned Actor-Web source and its native lifecycle are preserved; Ignite subscriptions never create, wrap, start, stop, or persist that source.",
    "No public Ignite inspect, getBlueprint, orchestration, receipt-authority, or universal InteractionPlan API is introduced by this architecture task."
  ],
  "forbiddenCouplings": [
    "Ignite authorizes commands, persists Actor-Web sessions, retries effects, reconciles runtime truth, or synthesizes authoritative execution success.",
    "send or optimistic projection is treated as an execution receipt.",
    "Actor-Web types leak into Ignite shipped declarations or become required runtime dependencies.",
    "Ignite Story traces, Actor-Web execution receipts, and FAS evidence bindings collapse into one authority or provenance record.",
    "Voice Workbench or Ignite Alchemy introduces another runtime, graph, recorder, trace, receipt, checkpoint, replay, or state authority.",
    "FAS is imported at Ignite runtime or Actor-Web imports FAS or Ignite product semantics.",
    "Deferred Actor-Web task briefs are presented as a shipped schema, fixture, or package contract."
  ],
  "evidenceRefs": [
    ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md",
    ".fas/tasks/define-the-versioned-evidence-governed-actor-web-consumer-co.md",
    "packages/ignite-adapters/src/adapters/ActorWebAdapter.ts",
    "packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts",
    "../actor-web/packages/actor-core-runtime/src/runtime-projection.ts",
    "../actor-web/.fas/tasks/define-provider-neutral-agent-execution-trace-and-receipt-co.md",
    "../actor-web/.fas/tasks/propagate-authenticated-principal-context-and-emit-command-a.md",
    "../actor-web/.fas/tasks/add-durable-agent-session-checkpoint-and-rehydration-seam.md",
    "../actor-web/.fas/queue/tasks.json"
  ]
}
```

## Affected files
- docs/architecture.md
- docs/shared-architecture-model.md
- docs/source-native-provisioning.md
- docs/actor-web-evidence-governed-projections.md
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts

## Scope Amendments
- None.

## Implementation plan
- Reconcile the accepted cross-repo ownership contract with the live Actor-Web task briefs and mark every upstream surface current accepted-target candidate or deferred.
- Define the versioned JSON-safe envelope dispositions join keys and source-of-truth matrix without implementing runtime authority in Ignite.
- Characterize compatibility against the current loose Actor-Web structural adapter and add only contract/type fixtures needed to prevent drift.
- Update architecture and source-native guidance with standalone and composed adoption boundaries.

## Verification plan
- Validate the source-of-truth matrix against Actor-Web and FAS ownership invariants.
- Run the Actor-Web canonical type-compatibility lane and documentation contract checks.
- Run fas validate-task and fast verification during the task then full verification before closeout.

## Risks
- Actor-Web task contracts may change before publication; keep provisional shapes maturity-labeled and reconcile against a versioned upstream fixture before closeout.
- Do not leak an optional Actor-Web peer into shipped declaration graphs or convert shared conventions into Ignite-owned universal semantics.
- Do not add a public inspect getBlueprint orchestration receipt or interaction-plan API from architecture speculation.

## Dependencies
- Queue dependency: task-1784909239951 defines source-native provisioning ownership.
- Queue dependency: task-1784298626529 defines the accepted Voice Workbench actor and projection boundary.
- External evidence inputs: Actor-Web tasks task-1785250528660 task-1785250545761 and task-1785250562339; these are cross-repo contract gates recorded in the brief rather than invalid local queue ids.

## Open questions
- Upstream adoption gate: no authoritative versioned Actor-Web admission, receipt, checkpoint, rehydration, replay, and reconciliation fixture or accepted package version/path exists yet; keep downstream adapter task task-1785254961929 deferred until those live artifacts and retention/redaction/freshness/ordering semantics are reconfirmed.
- FAS closeout gate: fas validate-task classifies five ignored pre-existing July 27 .fas/memory projections as current unexpected reference-scope files, so current-task cannot advance from implementing to verifying and reviewer.sh cannot transition to review; do not call fas done or edit lifecycle state by hand until the root-owned FAS lifecycle issue is resolved.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
