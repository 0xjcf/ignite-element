# Publish ecosystem conformance evidence and issue the Ignite public API verdict

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Close the Evidence-Governed Runtime Projections epic after Voice Workbench and Ignite Alchemy dogfood. Publish the versioned neutral fixtures and adoption guidance, prove compatibility with FAS optional behavioral-evidence adapters and scenario-evidence read models, and record an explicit no-change or follow-up API verdict. This task documents and validates evidence; it must not silently add public Ignite, Actor-Web, or FAS coupling.

## Acceptance criteria
- The published fixture set covers admission, authorization, execution, timeout, retry, cancellation, partial failure, checkpoint, restart, replay, reconciliation, stale evidence, unsupported versions, and malformed inputs.
- Fixtures preserve redacted provenance plus principal, intent, correlation, attempt, revision, sequence, and receipt identities required by the source-of-truth matrix.
- A fixture-backed compatibility lane proves FAS can consume Ignite Story evidence and Actor-Web execution receipts through its existing optional adapter contract without sibling-checkout or runtime imports.
- Documentation names standalone Ignite, Actor-Web plus Ignite, FAS plus either runtime, and full-stack adoption modes without making any integration mandatory.
- The verdict explicitly states whether getSchema, getSnapshot, getView, canExecute, execute, events, watchers, Story evidence, and adapter projections were sufficient.
- If dogfood finds a public API gap, this task creates a separately reviewed compatibility brief with migration, versioning, and second-consumer evidence; it does not implement the API opportunistically.
- The final review confirms Ignite owns projection only, Actor-Web owns execution authority and durable runtime evidence, FAS owns workflow evidence policy, and consumer applications own domain commands and authorization rules.
- Epic dependency reconciliation, focused fixture verification, documentation validation, full repository verification, and an independent review receipt pass.
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

## Affected files
- test/fixtures/actor-web-evidence
- examples/agents/voice-workbench/test/fixtures
- docs/actor-web-evidence-governed-projections.md
- docs/shared-architecture-model.md
- docs/source-native-provisioning.md

## Scope Amendments
- None.

## Implementation plan
- Collect the accepted architecture adapter conformance Voice Workbench and Ignite Alchemy receipts into one versioned fixture and coverage inventory.
- Run the fixture through the existing FAS optional behavioral-evidence adapter and scenario-evidence read-model contract without runtime imports.
- Publish standalone and composed adoption guidance with source versions provenance freshness and unsupported-version behavior.
- Record an explicit no-change verdict or create a separate public API compatibility brief backed by dogfood and second-consumer evidence.

## Verification plan
- Run fixture schema compatibility FAS adapter compatibility documentation and package verification lanes.
- Reconcile Epic membership reciprocal dependency edges source-of-truth ownership and maturity labels.
- Run fas validate-task full repository verification and independent final review before Epic closeout.

## Risks
- Do not mutate sibling repositories or make fixture verification depend on their live checkouts.
- Do not collapse Ignite Story traces Actor-Web execution receipts and FAS review evidence into one authority or status store.
- A public API gap may be real but must leave this task as a separate reviewed follow-up rather than opportunistic implementation.

## Dependencies
- Queue dependency: task-1785255004194 supplies Voice Workbench dogfood and the neutral FAS-compatible fixture.
- Queue dependency: task-1784602955608 supplies Ignite Alchemy integration dogfood and gap disposition.
- External compatibility target: the completed FAS optional evidence adapter task-1784322839920 and queued scenario-evidence matrix task-1784322861378.

## Open questions
- The public API verdict remains intentionally open until both dogfood receipts exist; absence of friction defaults to a documented no-change decision.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
