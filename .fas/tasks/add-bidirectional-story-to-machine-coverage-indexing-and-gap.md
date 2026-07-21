# Add Ignite Alchemy bidirectional Story-to-machine coverage and gap review

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Add the Ignite Alchemy coverage projection by joining explicit stable Story and page catalog identities, ordinary Story receipts, declared direct-test evidence, optional XState topology, and ordered observations. Support Story to path, state to Stories, edge to pages, and page to observed activity navigation while separating page dispositions, machine coverage, invariant or graph-test evidence, exclusions, and gaps. Treat missing lens evidence as machine coverage unavailable rather than zero or uncovered, preserve topology version and evidence provenance, and never parse test source, traverse the graph, mutate execution, or create a replacement trace.


## Acceptance criteria
- Every Story and page has a deterministic stable identity independent of wall-clock timing and browser session order.
- Story and page identities come from explicit W2 catalog metadata; ordinal array positions and receipt trace indexes are never canonical identifiers.
- Selecting a Story reveals its observed machine path and selecting a state or edge reveals every covering Story and page.
- The topology universe comes from the optional XState lens while observed execution comes from real Story sessions; the coverage layer implements no graph traversal algorithm.
- Every page is classified as opening assertion, intent transition, external transition, passive transition, expected no change, projection only, internal system, unmapped, or excluded with reason.
- Every state and transition is classified as narrative covered, direct invariant or graph-test covered, private or system only, unreachable by design, excluded with reason, or uncovered.
- Direct invariant and graph-test coverage enters through a declared evidence manifest containing stable evidence IDs, source references, covered topology identities, rationale, and freshness; implementation never parses test source.
- A page with no transition is reported as a mismatch only when its declared disposition requires machine activity; given and checkpoint pages do not create false gaps.
- Coverage recomputation is deterministic and does not mutate Story receipts, actor state, topology, or Workbench controller state.
- The UI supports bidirectional selection and exposes uncovered and excluded items with their evidence and rationale.
- Without an XState lens, page dispositions and Story evidence remain available while machine topology coverage is explicitly unavailable rather than empty, zero-percent, or uncovered.
- Topology identity/version participates in the coverage key so evidence from a changed machine cannot silently satisfy a new topology universe.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Build a pure normalized coverage projection over the Story catalog, controller page intervals, unchanged receipts, optional topology and observations, and an explicit direct-test evidence manifest.
- Maintain separate indexes for Story/page dispositions, observed state and edge evidence, direct test evidence, exclusions, and uncovered items, all carrying provenance and topology identity.
- Let the UI select into the projection bidirectionally without rerunning Stories, traversing machines, or changing controller state.

## Alternatives considered
- Rejected trace indexes and page ordinals as stable identities.
- Rejected parsing Vitest files or inferring invariant coverage from test names.
- Rejected coverage percentages as the primary success measure and rejected treating absent XState evidence as zero coverage.

## Affected files
- examples/agents/voice-workbench/src/story-workbench/coverage.ts
- examples/agents/voice-workbench/src/story-workbench/coverage.test.ts
- examples/agents/voice-workbench/src/story-workbench/coverage-evidence.ts
- examples/agents/voice-workbench/src/story-workbench/types.ts
- examples/agents/voice-workbench/src/story-workbench/workbench.tsx

## Scope Amendments
- None.

## Implementation plan
- Validate catalog Story/page IDs and define stable topology identities, version rules, evidence manifest, and disposition taxonomy.
- Join unchanged Story receipts, controller page intervals, optional lens topology and observations, and declared direct-test evidence in a pure coverage projection.
- Implement narrative-to-path, state-to-Stories, edge-to-pages, and page-to-machine navigation.
- Implement uncovered, invariant-only, private-system, unreachable, projection-only, expected-no-change, excluded, and unmapped classifications without false gaps.
- Integrate the coverage read model and bidirectional selection into the browser host.

## Verification plan
- Use deterministic fixtures to assert stable identities and coverage recomputation independent of session order and timing.
- Prove assertion-only Given and Checkpoint pages do not become transition gaps.
- Prove only pages declaring expected machine activity are mismatches when no transition is observed.
- Run coverage tests, browser interaction tests, fas validate-task, and the final full lane.

## Risks
- Index-based identifiers will drift when pages are inserted; stable semantic identifiers must be explicit.
- Coverage percentages can reward meaningless stories unless dispositions remain reviewable.
- Stale direct-test evidence can falsely close a gap unless topology versions and source references remain visible.
- Private or invariant-only behavior may be mislabeled as missing product coverage.

## Dependencies
- Depends directly on application task-1784602901002.
- Transitively consumes stable catalog metadata, controller page intervals, and ordered optional lens evidence.
- Blocks determinism and report task-1784602939863.

## Open questions
- Whether to display any aggregate ratio remains a product decision for dogfood; the implementation contract prioritizes classified evidence and gaps over a single score.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
