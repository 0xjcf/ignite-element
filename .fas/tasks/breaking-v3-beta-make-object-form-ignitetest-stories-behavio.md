# BREAKING v3 beta: make object-form igniteTest stories behavior-evidenced and adapter-neutral

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Replace the experimental beta narrative composition surface before evaluating the optional XState graph bridge. Make object-form igniteTest input canonical with component required and host optional; remove the positional call form and remove narrative entirely. Add story with an async narrative context whose given and checkpoint phases await bounded adapter-neutral snapshot, view, event, and command-availability evidence. Add a named behavior operation for externally driven actor, adapter, clock, network, or environment behavior while reusing the existing Story recorder and trace. Preserve typed deep-partial or predicate snapshot assertions across XState, Redux, MobX, and Actor-Web, including XState value and context without XState-specific matches vocabulary. Dogfood the clean contract in Voice Workbench. Owner decision overrides the earlier compatibility-alias epic wording because v3 remains beta: no deprecated aliases or positional overloads.

## Acceptance criteria
- igniteTest accepts only an object with component required plus optional host, and existing positional calls are migrated without a compatibility overload
- story is the only managed multi-step API; narrative is removed with no deprecated alias
- The story callback receives only the narrative context; actor and adapter dependencies remain ordinary fixture-owned closures rather than igniteTest-owned composition
- given and checkpoint are async bounded assertions that resolve immediately for synchronous adapters and await source or projection changes for actor-driven adapters with actionable Story diagnostics on timeout
- behavior records a named externally driven operation plus before and after snapshot and view evidence in the existing Story trace without adding a second recorder or trace format
- snapshot assertions remain adapter-neutral typed deep partials or predicates and cover XState value plus context, Redux state, MobX state, and Actor-Web snapshot data without importing XState into testing.ts
- Voice Workbench failure and recovery stories use story, behavior, snapshot evidence, and real boundary collaborators without a StorySystem abstraction or raw parent-actor receipt helpers
- Runtime, type, cleanup, timeout, failure-precedence, serialization, entrypoint, documentation, changeset, and full verification coverage pass
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- Keep the positional igniteTest form and add story as an alias: rejected because the owner explicitly chose a clean beta contract with no deprecated APIs.
- Register actors in igniteTest and pass them as a second story callback argument: rejected because actor construction, wiring, and cleanup belong to the consumer composition root and ordinary test fixtures.
- Add XState-specific matches assertions: rejected because snapshot deep-partial and predicate assertions already express XState value and context while remaining valid for Redux, MobX, and Actor-Web.
- Add a parallel narrative receipt or trace: rejected because behavior steps and checkpoints must enrich the existing Story evidence path.

## Architecture Context
```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "A Story callback states a falsifiable experience claim; intent steps invoke only the component public command contract."
    ],
    "behavior": [
      "Named behavior steps execute consumer-owned actor, adapter, clock, network, or environment operations and record their observable effect through the existing Story evidence path.",
      "Given and checkpoint phases await bounded assertions over the component snapshot, semantic view, emitted events, and command availability without becoming runtime authorities."
    ],
    "policies": [
      "The v3 beta migration is a clean break: object-form igniteTest input and story are canonical, while the positional form and narrative are removed without aliases.",
      "Snapshot assertions remain adapter-neutral deep partials or predicates; no adapter-specific state matcher enters the common testing contract.",
      "The optional XState graph bridge remains downstream and evaluates the finalized Story vocabulary rather than shaping it."
    ],
    "capabilities": [
      {
        "name": "experience-claim-authoring",
        "qualifier": "business",
        "owner": "Consumer-authored Story callbacks"
      },
      {
        "name": "story-evidence-recording",
        "qualifier": "runtime",
        "owner": "Ignite component recorder and testing driver"
      },
      {
        "name": "narrative-challenge-and-diagnostics",
        "qualifier": "agent-model",
        "owner": "Testing and coding agents consuming portable Story evidence"
      },
      {
        "name": "external-behavior-driving",
        "qualifier": "host-product",
        "owner": "Consumer composition roots and test fixtures"
      }
    ],
    "ports": [
      "igniteTest receives one object containing the required component and optional host.",
      "The Story context exposes given, intent, behavior, and checkpoint while record and snapshotStory remain the low-level evidence ports."
    ],
    "adapters": [
      "XState, Redux, MobX, and Actor-Web provide their native snapshot shapes through the same runtime getSnapshot contract.",
      "Behavior operations close over consumer-owned collaborators; Ignite does not construct, discover, register, or dispose those collaborators."
    ],
    "infrastructure": [
      "Vitest runtime and type suites, entrypoint checks, Voice Workbench dogfood, docs checks, Changesets, and FAS verification provide migration evidence."
    ],
    "projections": [
      "Semantic views and command availability are derived from authoritative snapshots and may be asserted alongside source snapshot evidence at named checkpoints.",
      "Serializable Story snapshots remain the single portable receipt consumed by documentation, tests, and any later graph bridge."
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "Deep-partial and predicate matching, timeout decisions, trace normalization, Story serialization, and assertion diagnostics remain deterministic and adapter-neutral."
    ],
    "imperativeShell": [
      "Story orchestration, component subscriptions, behavior callbacks, actor and adapter operations, host overrides, cleanup, and bounded waiting remain in the testing shell."
    ]
  },
  "ownership": [
    {
      "owner": "Authoritative application source",
      "responsibilities": [
        "Own state transitions, context, guards, correlations, facts, and lifecycle outcomes."
      ],
      "maturity": "current"
    },
    {
      "owner": "Ignite Story recorder",
      "responsibilities": [
        "Capture the single ordered command, behavior, snapshot, view, event, checkpoint, and lifecycle evidence stream without making decisions for the source."
      ],
      "maturity": "transitional"
    },
    {
      "owner": "igniteTest Story composition layer",
      "responsibilities": [
        "Execute typed experience claims, await bounded evidence, report actionable failures, and guarantee recorder cleanup."
      ],
      "maturity": "target"
    },
    {
      "owner": "Consumer test fixture",
      "responsibilities": [
        "Construct, wire, configure, and dispose actors, adapters, clocks, servers, and other external collaborators used by behavior steps."
      ],
      "maturity": "current"
    }
  ],
  "maturity": [
    {
      "claim": "record, snapshotStory, IgniteStory, and serializable Story snapshots provide one existing evidence substrate.",
      "status": "current",
      "evidenceRefs": [
        "packages/ignite-element/src/runtime/agent.ts",
        "packages/ignite-element/src/types/agent.ts"
      ]
    },
    {
      "claim": "The beta narrative helper proves multi-step composition but exposes stale naming, positional construction, synchronous checkpoints, and unrecorded external behavior friction.",
      "status": "transitional",
      "evidenceRefs": [
        "packages/ignite-element/src/testing.ts",
        "examples/agents/voice-workbench/src/workbench-narratives.test.ts",
        "examples/agents/voice-workbench/narrative-ergonomics-audit.md"
      ]
    },
    {
      "claim": "The finalized Story API provides object-form construction, adapter-neutral bounded assertions, named behavior evidence, and Voice Workbench dogfood before graph evaluation begins.",
      "status": "target",
      "evidenceRefs": [
        "packages/ignite-element/src/tests/testing.test.ts",
        "packages/ignite-element/src/tests/types/testing.types.test.ts",
        "docs/site/src/content/docs/api/testing-dsl.mdx"
      ]
    }
  ],
  "boundaries": [
    "Story composition describes and verifies behavior but never owns application state or source transitions.",
    "The component remains the only required igniteTest subject; host and external collaborators remain consumer-owned shell dependencies.",
    "Snapshot means the exact adapter snapshot shape, including XState value and context where present; the common API does not normalize adapters into one state model.",
    "Behavior steps and checkpoints enrich the existing Story trace and portable snapshot instead of creating a second recorder or report format.",
    "The graph bridge consumes the finalized Story contract and never becomes the core narrative engine."
  ],
  "forbiddenCouplings": [
    "igniteTest constructs, discovers, registers, inspects, or disposes consumer actors or adapters.",
    "The common testing module imports XState or adds XState-only matching vocabulary.",
    "Behavior callbacks mutate Ignite recorder internals or become an alternate command channel into the component.",
    "Narrative or compatibility aliases survive the clean beta cutover.",
    "The optional graph bridge owns traversal, source state, projection truth, or Story serialization."
  ],
  "evidenceRefs": [
    "packages/ignite-element/src/testing.ts",
    "packages/ignite-element/src/types/agent.ts",
    "packages/ignite-element/src/runtime/agent.ts",
    "packages/ignite-element/src/tests/testing.test.ts",
    "packages/ignite-element/src/tests/types/testing.types.test.ts",
    "examples/agents/voice-workbench/src/workbench-narratives.test.ts",
    "docs/site/src/content/docs/api/testing-dsl.mdx",
    ".fas/tasks/evaluate-an-optional-ignite-xstate-graph-testing-bridge-from.md"
  ],
  "completeness": {
    "required": true,
    "triggers": [
      "migration"
    ],
    "status": "complete",
    "missing": []
  }
}
```

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- packages/ignite-element/src/tests/entrypoints.test.ts
- examples/agents/voice-workbench/src/workbench-narratives.test.ts
- docs/site/src/content/docs/api/testing-dsl.mdx
- .changeset
- .changeset/story-object-form-testing-dsl.md
- README.md
- docs/testing.md
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/narrative-ergonomics-audit.md
- packages/ignite-element/README.md
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts

## Scope Amendments
- Type: dependency-reachable closeout scope
- Added at: 2026-07-20
- Trigger: Public trace type export and beta migration review exposed required barrel, type-entrypoint, and documentation coverage.
- Reason: These files are required to keep all public adapter entrypoints and consumer migration docs consistent with the locked breaking beta contract.
- Added paths: .changeset/story-object-form-testing-dsl.md, README.md, docs/testing.md, examples/agents/voice-workbench/README.md, examples/agents/voice-workbench/narrative-ergonomics-audit.md, packages/ignite-element/README.md, packages/ignite-element/src/actor-web.ts, packages/ignite-element/src/index.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/xstate.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Evidence source: final reviewer and closeout readiness
- Evidence: final reviewer and closeout readiness | .fas/state/closeout-readiness/latest.json | Five public barrels, type equivalence coverage, and migration docs are dependency-reachable acceptance work; ignored pre-existing .fas memory projections remain outside product scope.
- Accuracy signal: Exact origin/beta..HEAD review approved the 20-file product scope.
- Follow-up needed: Refresh scope and re-run closeout readiness before ship or done.

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
