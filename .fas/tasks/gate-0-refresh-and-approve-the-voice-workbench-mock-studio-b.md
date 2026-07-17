# Gate 0: refresh and approve the Voice Workbench Mock Studio behavior handoff

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Amend the approved 2026-07-13 Voice Workbench Mock Studio handoff so it matches the live implementation before further refactoring. Reuse the approved visual hierarchy, tokens, responsive anatomy, and parity harness; this is an architecture-only handoff amendment unless the state-to-screen audit proves a material visual gap. Replace the stale five-command and ready/responding-only contract with the implemented compound parent plus model-turn, voice-capture, and speech-delivery child machines, exact current public schema, raw snapshot and native metadata contract, lifecycle disposition inventory, source-of-truth matrix, actor topology, command/event/guard/effect/fact tables, machine-to-projection-to-host map, expected failure facts, state-to-screen coverage, reuse/extend/move/retire matrix, proposed epic slices, and current verification receipts. Record explicit implemented, proposed, designed, retained, and deferred maturity. Add a durable approval record that cites this conversation but leave the architecture amendment pending final human approval before downstream implementation starts.

## Acceptance criteria
- The handoff no longer claims an exact five-command schema or a ready/responding-only machine and instead records the exact live command schema and all implemented parent/child statecharts.
- Every lifecycle, reducer-owned aggregate, policy/effect fact, and presentation-only concern has one owner and an explicit disposition with evidence.
- The raw snapshot contract, derived views, command availability, internal events, adapter receipts, guards, invariants, recovery paths, and host consumers are mapped separately.
- The source-of-truth matrix names owners for durable facts, artifact identity and revision, attempts and correlations, retries and replay, model proposals, authorization, effect intent, and execution receipts.
- The existing visual prototype, tokens, responsive rules, donor decisions, and parity receipts are explicitly classified as retained or superseded; no unapproved UI mutation is introduced.
- The state-to-screen matrix includes preparing, unavailable, idle, responding, voice listening/transcript/permission/failure, speech queued/delivered/muted/unavailable/failed/cancelled, stale receipts, validation, conflict, timeout, and recovery dispositions.
- An approval artifact records the amendment scope and remains pending human approval; downstream epic tasks depend on this gate.
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
```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Public commands express the smallest caller-provided user intent and do not derive actor-owned correlation data."
    ],
    "behavior": [
      "The compound session machine and its model-turn, voice-capture, and speech-delivery child machines own lifecycle transitions and authoritative workflow state."
    ],
    "policies": [
      "Deterministic guards and domain functions decide authorization, validation, stale-receipt rejection, retry, cancellation, timeout, and recovery."
    ],
    "capabilities": [
      {
        "name": "voice-workbench-session",
        "qualifier": "business",
        "owner": "Voice Workbench statechart"
      },
      {
        "name": "model-turn-orchestration",
        "qualifier": "agent-model",
        "owner": "Model-turn child machine"
      },
      {
        "name": "voice-and-speech-host-integration",
        "qualifier": "host-product",
        "owner": "Voice Workbench host adapters"
      },
      {
        "name": "ignite-projection-runtime",
        "qualifier": "runtime",
        "owner": "ignite-element"
      }
    ],
    "ports": [
      "Framework-neutral command and read-model port between hosts and the actor system.",
      "Provider, microphone, speech-delivery, persistence, clock, and identifier ports around the deterministic actor core."
    ],
    "adapters": [
      "Browser and terminal adapters perform host-dependent effects and return correlated facts or receipts.",
      "The probabilistic LLM remains an edge adapter behind the model provider port."
    ],
    "infrastructure": [
      "Browser media, speech, history, storage, and transport APIs plus terminal and provider SDK integrations."
    ],
    "projections": [
      "Ignite view callbacks and pure selectors derive presentation and command-availability read models from actor snapshots.",
      "Renderers consume projected values and return only template or JSX output."
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "Statecharts, reducers, guards, selectors, schemas, and domain functions are deterministic and host-agnostic."
    ],
    "imperativeShell": [
      "Host composition, provider implementations, browser and terminal effects, subscription lifecycles, and rendering mounts perform imperative work."
    ]
  },
  "ownership": [
    {
      "owner": "Voice Workbench actor topology",
      "responsibilities": [
        "Own workflow lifecycle, durable facts, attempts, correlation identifiers, retries, replay, effect intent, and receipt acceptance."
      ],
      "maturity": "target"
    },
    {
      "owner": "Ignite projection layer",
      "responsibilities": [
        "Expose derived views and thin intent commands without becoming a second workflow authority."
      ],
      "maturity": "target"
    },
    {
      "owner": "Host adapters",
      "responsibilities": [
        "Execute environment-dependent work and report correlated facts without deciding workflow transitions."
      ],
      "maturity": "target"
    }
  ],
  "maturity": [
    {
      "claim": "The existing visual hierarchy, tokens, responsive anatomy, and parity harness remain the approved presentation baseline.",
      "status": "current",
      "evidenceRefs": [
        ".mock-studio/voice-text-workbench/mock-studio-handoff.md",
        ".mock-studio/voice-text-workbench/mock-studio-log.md"
      ]
    },
    {
      "claim": "The implementation has compound and child machines but still contains mixed deterministic, host, projection, and adapter responsibilities that require characterization before extraction.",
      "status": "transitional",
      "evidenceRefs": [
        "examples/agents/voice-workbench/src/session.ts",
        "examples/agents/voice-workbench/src/workbench-agent.ts",
        ".fas/artifacts/audits/voice-workbench-state-machine-audit.md"
      ]
    },
    {
      "claim": "The target is a machine-authoritative actor system with neutral ports, deterministic cores, imperative adapters, projection-only Ignite composition, and thin renderers.",
      "status": "target",
      "evidenceRefs": [
        ".fas/tasks/gate-0-refresh-and-approve-the-voice-workbench-mock-studio-b.md"
      ]
    }
  ],
  "boundaries": [
    "Machines may depend on deterministic domain contracts and ports, never browser, terminal, framework, or provider implementations.",
    "Commands carry only caller-contributed intent data; actor-owned sequences, revisions, attempts, and correlations are allocated in authoritative transitions.",
    "Views and selectors derive read models from snapshots but never feed derived presentation state back into commands or machines.",
    "Adapters execute port requests and return explicit correlated receipts or failure facts; probabilistic output is never authoritative until validated and accepted by the machine.",
    "Each lifecycle or workflow has exactly one FSM or statechart source of truth."
  ],
  "forbiddenCouplings": [
    "Deterministic machine or domain files importing DOM, browser, terminal, provider SDK, renderer, or ignite-element host APIs.",
    "Renderers reading actor snapshots, sending events, allocating identity, performing effects, or deciding workflow transitions.",
    "Commands capturing a snapshot at command-factory creation time or calculating actor-owned correlation payloads.",
    "Views performing effects, mutating context, or becoming an input authority for commands.",
    "Host adapters mutating domain state directly or returning uncorrelated success and failure results."
  ],
  "evidenceRefs": [
    ".mock-studio/voice-text-workbench/mock-studio-handoff.md",
    ".mock-studio/voice-text-workbench/mock-studio-log.md",
    ".fas/artifacts/audits/voice-workbench-state-machine-audit.md",
    "examples/agents/voice-workbench/README.md",
    "examples/agents/voice-workbench/src/session.ts",
    "examples/agents/voice-workbench/src/model-turn.ts",
    "examples/agents/voice-workbench/src/voice.ts",
    "examples/agents/voice-workbench/src/speech.ts",
    "examples/agents/voice-workbench/src/ports.ts",
    "examples/agents/voice-workbench/src/workbench-agent.ts",
    "examples/agents/voice-workbench/src/workbench-runtime.ts",
    "examples/agents/voice-workbench/src/workbench-view.ts",
    "examples/agents/voice-workbench/src/workbench-component.ts"
  ]
}
```

## Affected files
- .mock-studio/voice-text-workbench/mock-studio-handoff.md
- .mock-studio/voice-text-workbench/approval.md
- .mock-studio/voice-text-workbench/mock-studio-log.md
- examples/agents/voice-workbench/README.md
- .fas/artifacts/audits/voice-workbench-state-machine-audit.md

## Scope Amendments
- 2026-07-17 user-approved amendment: make explicit validation of every state
  machine a Mock Studio approval gate by updating the global `mock-studio`
  skill, its behavior-handoff reference, and its Ignite/XState reference.
- Correct the audit diagrams so they describe the implemented parent,
  model-turn, voice-capture, and speech-delivery machines rather than their
  superseded proposed shapes.
- Strengthen downstream task `task-1784298626529` into the explicit
  create-and-validate-every-state-machine-contract characterization gate while
  preserving its position in the epic dependency chain.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

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
