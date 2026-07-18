# Repair Voice Workbench characterization typecheck conformance

## Source
Created with `fas create-task` on 2026-07-18.

## Problem
The committed executable machine-characterization tests pass at runtime but the direct Voice Workbench TypeScript lane reports four errors: architecture.test.ts uses String.replaceAll under the example target, and model-turn/speech graph helpers return nullable terminal facts where the asserted contract requires a terminal. Make the smallest test-only corrections, preserve the executable characterization semantics, and restore the full example typecheck before the shared repository full-verification closeout.

## Acceptance criteria
- pnpm --dir examples/agents/voice-workbench typecheck passes without changing production behavior
- The architecture test remains compatible with the example TypeScript target
- Graph tests prove terminal facts are present before returning non-null contract values
- The focused graph and architecture runtime tests remain green
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
      "Restore compile-time conformance for the already-approved executable characterization tests."
    ],
    "behavior": [
      "The existing graph and architecture tests continue to characterize machine topology, terminal facts, and dependency boundaries without changing production behavior."
    ],
    "policies": [
      "A graph helper may return a terminal fact only after an explicit non-null assertion, and test syntax must stay within the example TypeScript target."
    ],
    "capabilities": [
      {
        "name": "voice-workbench-characterization-typecheck",
        "qualifier": "runtime",
        "owner": "Voice Workbench test suite"
      }
    ],
    "ports": [
      "No production port contract changes; tests consume existing machine outputs."
    ],
    "adapters": [
      "No adapter changes; host and provider adapters remain outside this test-only repair."
    ],
    "infrastructure": [
      "TypeScript and Vitest provide the compile-time and runtime receipts."
    ],
    "projections": [
      "Graph and architecture tests remain checked projections of authoritative machine and module source."
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "Machine configurations, terminal facts, invariants, and architecture rules remain unchanged."
    ],
    "imperativeShell": [
      "Only the test runner and compiler execute; no production effects are introduced."
    ]
  },
  "ownership": [
    {
      "owner": "Voice Workbench state machines",
      "responsibilities": [
        "Remain the sole authority for lifecycle state and terminal facts."
      ],
      "maturity": "current"
    }
  ],
  "maturity": [
    {
      "claim": "Executable characterization tests pass at runtime but must also compile under the example target.",
      "status": "transitional",
      "evidenceRefs": [
        "examples/agents/voice-workbench/src/architecture.test.ts",
        "examples/agents/voice-workbench/src/model-turn.graph.test.ts",
        "examples/agents/voice-workbench/src/speech.graph.test.ts"
      ]
    }
  ],
  "boundaries": [
    "This repair is test-only and may not alter runtime machines, commands, views, ports, adapters, or public Ignite APIs."
  ],
  "forbiddenCouplings": [
    "Do not weaken terminal assertions with casts or non-null assertions that lack a preceding runtime guard."
  ],
  "evidenceRefs": [
    "examples/agents/voice-workbench/src/architecture.test.ts",
    "examples/agents/voice-workbench/src/model-turn.graph.test.ts",
    "examples/agents/voice-workbench/src/speech.graph.test.ts"
  ]
}
```

## Affected files
- examples/agents/voice-workbench/src/architecture.test.ts
- examples/agents/voice-workbench/src/model-turn.graph.test.ts
- examples/agents/voice-workbench/src/speech.graph.test.ts

## Reference files
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: test-only-verification-alignment
- Added at: 2026-07-18T15:42:00Z
- Trigger: The defect is a compile failure inside already-committed tests; the same files already pass at runtime.
- Reason: Treat the direct TypeScript failure as the red receipt. No production code or new runtime behavior exists to justify manufacturing a failing Vitest assertion.
- Evidence source: direct Voice Workbench TypeScript lane
- Evidence: direct Voice Workbench TypeScript lane | examples/agents/voice-workbench/src/model-turn.graph.test.ts | The base reports nullable terminal output errors while the focused runtime tests pass.
- Accuracy signal: Typecheck and focused runtime tests both pass after target-compatible normalization and explicit runtime narrowing.
- Follow-up needed: Keep this repair test-only.

- Type: reference-evidence-alignment
- Added at: 2026-07-18T15:42:00Z
- Trigger: FAS live ChangeSet classifies pre-existing ignored curated-memory projections as untracked reference changes during closeout.
- Reason: Declare the existing local memory projections as reference evidence only so they remain preserved and cannot be mistaken for implementation drift.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: root closeout inspection
- Evidence: root closeout inspection | .fas/state/closeout-readiness/latest.json | Git check-ignore confirms the five paths are ignored local projections.
- Accuracy signal: Plan alignment reports zero unexpected implementation and reference files without staging generated memory.
- Follow-up needed: Do not edit, stage, or publish these memory projections as part of this task.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Blocks `task-1784298626529` so the characterization task cannot close until its compile-time and runtime receipts agree.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
