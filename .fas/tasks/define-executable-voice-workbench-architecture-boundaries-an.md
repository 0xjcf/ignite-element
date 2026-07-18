# Create and validate every Voice Workbench state-machine contract and executable architecture boundary

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Turn the approved Gate 0 ownership and layer model into executable example-local evidence before moving modules. First create and validate the complete contract for every explicit Voice Workbench state machine: the parent session, model-turn, voice-capture, and speech-delivery machines. Prove source-aligned diagrams, exhaustive event dispositions, bounded reachability, required terminal and recovery paths, forbidden-state invariants, correlation and idempotency, serializable snapshots, and parent-child supervision. Then define and enforce the allowed dependency direction for contracts, functional core, actors, application ports/runtime, adapters, pure projections, Ignite composition, renderers, and host roots. Record a bounded reviewed architecture-violation baseline that cannot grow; every later epic task must reduce it and final acceptance must reach zero.


## Acceptance criteria
- A checked-in machine-contract inventory covers the parent session, model-turn, voice-capture, and speech-delivery machines and names each machine's authoritative owner, states, typed events, guards, actions or effects, outputs or emitted facts, raw snapshot and context contract, derived views, command availability, recovery paths, and maturity.
- Every checked-in statechart diagram is source-aligned and an executable conformance test fails when configured state nodes, hierarchy, invocation identity, or transition vocabulary drift.
- Each machine has bounded xstate/graph or equivalent tests that reach every intended state or record an explicit exclusion rationale; parent graph coverage does not substitute for child coverage.
- Each typed event union has an exhaustive disposition table covering transition, self-transition, deliberate ignore, or rejection.
- Tests prove success, failure, cancellation, timeout, retry, recovery, unavailable, exhaustion, stale-receipt, duplicate-command, and idempotency behavior wherever applicable.
- Forbidden state combinations and invalid terminal outputs are asserted unreachable for every machine.
- Bounded path tests verify snapshot value, context, output, error, tags, and relevant child identity or status satisfy the serializable contract and agree with projections without making views authoritative.
- Parent-child tests prove invocation IDs, completion, cancellation, replacement, disposal, restart, and fresh actor isolation preserve one lifecycle writer.
- A checked-in layer manifest names every production Voice Workbench module and its allowed inward dependencies, side-effect allowance, and reuse, extend, move, split, or retire disposition.
- Architecture tests detect forbidden imports and effectful globals in deterministic layers, distinguish serializable port types from host execution, and fail on any unreviewed violation.
- The reviewed violation baseline enumerates every current violation by file and rule, cannot grow silently, and later epic tasks must reduce it to zero.
- No production behavior changes in this characterization slice; graph, headless, projection, command-schema, and example verification remain green.
- TDD: each new contract or architecture rule is introduced by a failing test and lands with its passing implementation.
- DDD: deterministic cores stay side-effect-free, actors own lifecycle, adapters return correlated facts, Ignite remains projection-only, and each lifecycle has one authoritative FSM.
- The work remains tracked in .fas/TASKS.md and .fas/queue/tasks.json with the existing epic dependency edges.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Architecture Context
```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Public commands express the smallest caller-provided intent; actor-owned attempts, sequences, revisions, and correlations are allocated by authoritative transitions."
    ],
    "behavior": [
      "The parent session, model-turn, voice-capture, and speech-delivery XState machines each own one explicit lifecycle contract and validation receipt."
    ],
    "policies": [
      "Deterministic guards and event-disposition tables decide admission, correlation, idempotency, stale-event rejection, terminal outcomes, and recovery."
    ],
    "capabilities": [
      {
        "name": "state-machine-contract-validation",
        "qualifier": "runtime",
        "owner": "Voice Workbench graph and contract tests"
      },
      {
        "name": "voice-workbench-session",
        "qualifier": "business",
        "owner": "Parent session statechart"
      },
      {
        "name": "model-turn-orchestration",
        "qualifier": "agent-model",
        "owner": "Model-turn child statechart"
      },
      {
        "name": "voice-and-speech-lifecycles",
        "qualifier": "host-product",
        "owner": "Voice-capture and speech-delivery child statecharts"
      }
    ],
    "ports": [
      "Serializable request, receipt, failure, command, event, snapshot, and output contracts may cross deterministic actor boundaries.",
      "Provider, capability, microphone, speech, clock, and identifier execution remains behind ports."
    ],
    "adapters": [
      "Browser, terminal, provider, and capability adapters execute port requests and return correlated facts without owning lifecycle transitions."
    ],
    "infrastructure": [
      "XState graph traversal, Vitest, architecture import analysis, and forbidden-global inspection provide executable evidence."
    ],
    "projections": [
      "Checked statechart diagrams, machine-contract tables, Ignite views, routes, speech requests, and terminal read models are derived projections of authoritative snapshots."
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "Machine configurations, guards, reducers, selectors, serializers, invariants, event dispositions, and architecture rules are deterministic and host-agnostic."
    ],
    "imperativeShell": [
      "Host adapters, provider SDKs, browser APIs, clocks, randomness, network, filesystem, and rendering mounts remain outside deterministic layers."
    ]
  },
  "ownership": [
    {
      "owner": "Each explicit Voice Workbench state machine",
      "responsibilities": [
        "Own its lifecycle states, typed events, correlation rules, terminal outputs, recovery, and one source-aligned validation receipt."
      ],
      "maturity": "current"
    },
    {
      "owner": "Voice Workbench architecture tests",
      "responsibilities": [
        "Enforce inward dependency direction and prevent reviewed import or effect violations from growing."
      ],
      "maturity": "target"
    },
    {
      "owner": "Ignite and host projections",
      "responsibilities": [
        "Derive views and perform host integration without becoming lifecycle authorities."
      ],
      "maturity": "current"
    }
  ],
  "maturity": [
    {
      "claim": "The parent session has bounded xstate/graph reachability and forbidden-state coverage.",
      "status": "current",
      "evidenceRefs": [
        "examples/agents/voice-workbench/src/session.graph.test.ts"
      ]
    },
    {
      "claim": "Child machines have behavioral tests but do not yet have complete per-machine graph, event-disposition, serialization, and diagram-conformance receipts.",
      "status": "transitional",
      "evidenceRefs": [
        "examples/agents/voice-workbench/src/model-turn.ts",
        "examples/agents/voice-workbench/src/voice.test.ts",
        "examples/agents/voice-workbench/src/speech.ts"
      ]
    },
    {
      "claim": "Every explicit machine and every deterministic module boundary has executable, bounded, source-aligned evidence before structural extraction begins.",
      "status": "target",
      "evidenceRefs": [
        ".fas/artifacts/audits/voice-workbench-state-machine-audit.md",
        "examples/agents/voice-workbench/architecture-boundaries.json"
      ]
    }
  ],
  "boundaries": [
    "Parent graph coverage never substitutes for direct validation of an invoked child machine.",
    "Diagrams and contract inventories are checked projections of executable statecharts, never parallel authorities.",
    "Every typed event receives an exhaustive disposition and every intended state is reachable or explicitly excluded.",
    "Graph traversal is bounded with explicit payload events, deterministic serializers, limits, and stop conditions.",
    "Architecture characterization records current violations without permitting the baseline to grow."
  ],
  "forbiddenCouplings": [
    "A deterministic machine or domain module importing browser, terminal, provider SDK, renderer, network, filesystem, clock, or randomness implementations.",
    "A hand-authored diagram or manifest drifting from configured state nodes, invocation IDs, typed events, or transition vocabulary.",
    "An Ignite view, renderer, host effect, or adapter becoming a second writer for machine-owned lifecycle facts.",
    "An unbounded graph traversal over growing context being treated as valid coverage.",
    "A reviewed architecture-violation baseline accepting new files or rules silently."
  ],
  "evidenceRefs": [
    ".mock-studio/voice-text-workbench/mock-studio-handoff.md",
    ".fas/artifacts/audits/voice-workbench-state-machine-audit.md",
    "examples/agents/voice-workbench/src/session.ts",
    "examples/agents/voice-workbench/src/model-turn.ts",
    "examples/agents/voice-workbench/src/voice.ts",
    "examples/agents/voice-workbench/src/speech.ts",
    "examples/agents/voice-workbench/src/session.graph.test.ts",
    "examples/agents/voice-workbench/src/session.headless.test.ts",
    "examples/agents/voice-workbench/src/workbench-view.test.ts"
  ]
}
```

## Affected files
- examples/agents/voice-workbench/src/architecture.test.ts
- examples/agents/voice-workbench/architecture-boundaries.json
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/session.graph.test.ts
- examples/agents/voice-workbench/src/model-turn.graph.test.ts
- examples/agents/voice-workbench/src/voice.graph.test.ts
- examples/agents/voice-workbench/src/speech.graph.test.ts
- .fas/artifacts/audits/voice-workbench-state-machine-audit.md
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-07-17
- Added paths: examples/agents/voice-workbench/src/architecture.test.ts, examples/agents/voice-workbench/architecture-boundaries.json, examples/agents/voice-workbench/src/session.graph.test.ts, examples/agents/voice-workbench/src/model-turn.graph.test.ts, examples/agents/voice-workbench/src/voice.graph.test.ts, examples/agents/voice-workbench/src/speech.graph.test.ts, examples/agents/voice-workbench/README.md, .fas/artifacts/audits/voice-workbench-state-machine-audit.md

- Type: reference-evidence-alignment
- Added at: 2026-07-18T15:06:00Z
- Trigger: FAS live ChangeSet classified pre-existing ignored curated-memory projections as untracked reference changes during closeout.
- Reason: Declare the existing local memory projections as reference evidence only so they are preserved, not deleted or force-tracked, and cannot be mistaken for implementation drift.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: root closeout inspection
- Evidence: root closeout inspection | .fas/state/closeout-readiness/latest.json | Git check-ignore confirms all five paths are ignored by .gitignore; git status is otherwise clean after the planned commits.
- Accuracy signal: Plan alignment should report zero unexpected implementation and reference files while Git remains clean.
- Follow-up needed: Do not edit, stage, or publish these generated memory projections as part of this task.

## Implementation plan
- Build the four-machine contract inventory and source-aligned validation matrix from the approved Gate 0 handoff and live XState configurations.
- Add failing-first per-machine topology, event-disposition, bounded graph, invariant, serialization, and supervision tests, reusing the existing parent graph harness.
- Add the layer manifest and failing-first architecture tests with a bounded reviewed violation baseline.
- Run focused graph and architecture tests, then the full example and repository verification lanes without changing production behavior.

## Verification plan
- Run focused Vitest coverage for session.graph.test.ts, model-turn.graph.test.ts, voice.graph.test.ts, speech.graph.test.ts, and architecture.test.ts through the repository-supported test lane.
- Run fas validate-task for the inner-loop gate.
- Run .fas/scripts/verify.sh --full for release-quality graph, headless, projection, architecture, and example coverage.

## Risks
- Naive graph traversal can explode when context grows; require explicit payload events, deterministic state and event serializers, stop conditions, and limits.
- A hand-authored contract manifest can become a second authority; derive from or executable-check it against machine source.
- Characterization must not bless accidental behavior indefinitely; every baseline violation needs an owner and reduction task.

## Dependencies
- None known at task creation.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
