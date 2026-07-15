# Structure voice-workbench domains and add a product-pricing policy with explicit UI projections

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Separate reusable voice-workbench infrastructure from optional example-owned domain packs, then add product pricing as the first policy-bearing domain. The policy must remain deterministic and framework-independent, execute through the configured domain capability/source boundary, and project admitted, needs-input, rejected, assumptions, questions, and evidence requirements through the Ignite view. Ignite public packages and renderers must not become domain or policy authorities.


## Acceptance criteria
- A visible src/domains structure separates generic domain contracts and registration from product-pricing-specific policy, capability, projection, and tests.
- The product-pricing policy deterministically returns admitted, needs-input, or rejected facts; representative product defaults are explicit assumptions and retailer or location gaps become clarification questions.
- The model can discover and call the product-pricing policy capability before web research without making the model authoritative for the configured policy.
- Generic workbench code records bounded domain-policy facts, and the Ignite view callback derives all policy-related UI values before the renderer consumes them.
- The browser right rail makes the active domain, policy decision, assumptions, clarification questions, and evidence requirements visible without domain checks in JSX.
- Completion guards preserve requested subjects, disclosed assumptions, verified evidence scope, and the existing no-invented-price rules.
- Non-pricing prompts and configurations without web search remain supported, and no Ignite public package API changes are introduced.
- Focused pure-policy, agent-loop, headless-view, and browser-projection tests cover happy, clarification, rejection, and generic fallback paths.
- The example README documents the source-of-truth boundary and how to add a second domain.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- examples/agents/voice-workbench/src/domains/
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/agent-loop.ts
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md

## Scope Amendments
- Type: planning-correction
- Added at: 2026-07-15
- Trigger: Generated plan returned zero explicit scope and unrelated package candidates.
- Reason: Anchor implementation in the voice-workbench example and explicitly prohibit a new Ignite policy engine.
- Added paths: examples/agents/voice-workbench/src/domains/, examples/agents/voice-workbench/src/capability-federation.ts, examples/agents/voice-workbench/src/workbench-agent.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts, examples/agents/voice-workbench/src/workbench.tsx, examples/agents/voice-workbench/src/workbench.test.tsx, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/main.tsx, examples/agents/voice-workbench/src/main.test.tsx, examples/agents/voice-workbench/src/styles.ts, examples/agents/voice-workbench/README.md
- Evidence source: user-architecture-decision
- Evidence: user-architecture-decision | examples/agents/voice-workbench/src | Domain packs are optional application-owned modules; Ignite projects policy facts but does not decide them.
- Accuracy signal: confirmed in current conversation and live example structure
- Follow-up needed: none

- Type: closeout-provenance-reconciliation
- Added at: 2026-07-15
- Trigger: Final done gate treated five ignored project-memory projection files as pending task changes.
- Reason: Classify the five pre-existing ignored project-memory projections as reference-only workflow evidence so ChangeSet provenance is complete without adopting unrelated repository history into this PR.
- Added paths: .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Removed paths: none
- Evidence source: final-closeout-audit
- Evidence: final-closeout-audit plus prior task direct-1784081714243 precedent | git check-ignore and file timestamps | all five paths are ignored by .gitignore, predate this task, and must remain reference-only and uncommitted.
- Accuracy signal: direct filesystem metadata and file-content review
- Follow-up needed: Keep the five memory paths reference-only and uncommitted.

- Type: implementation-discovery
- Added at: 2026-07-15
- Trigger: The model request envelope needed an additive domainPolicyInstructions field and closeout identified FAS memory projections.
- Reason: Align the exact generic model envelope file and routine FAS memory projection files without widening product source scope.
- Added paths: examples/agents/voice-workbench/src/agent-loop.ts, .fas/memory/architecture.md, .fas/memory/decisions.md, .fas/memory/incidents.md, .fas/memory/patterns.md, .fas/memory/pr-feedback.md
- Evidence source: closeout-readiness
- Evidence: closeout-readiness | .fas/state/closeout-readiness/latest.json | agent-loop.ts is the only unexpected implementation file; five .fas/memory files are reference-scope projections.
- Accuracy signal: direct committed diff plus live ChangeSet
- Follow-up needed: none

- Type: scope-demotion
- Added at: 2026-07-15
- Trigger: Fast closeout found the existing capability federation contract already satisfied the domain-pack integration.
- Reason: Avoid an artificial no-op edit; keep capability-federation.ts as inspected reference evidence rather than planned implementation scope.
- Added paths: none
- Removed paths: examples/agents/voice-workbench/src/capability-federation.ts
- Evidence source: fast-closeout
- Evidence: fast-closeout | .fas/state/closeout-readiness/latest.json | capability-federation.ts was the only planned-but-unchanged implementation path.
- Accuracy signal: direct implementation diff and passing focused verification
- Follow-up needed: none

## Implementation plan
- Define example-private generic domain-pack contracts and a deterministic product-pricing policy/capability under src/domains/.
- Register the product-pricing domain with the capability federation, record its bounded decisions in actor-owned presentation state, and apply domain completion audits in the model loop.
- Derive policy rows and labels in igniteCore.view and render only the prepared projection in the right rail.
- Add deterministic and integration tests, then document the domain-policy-source-view-renderer architecture.

## Verification plan
- Run focused voice-workbench policy, agent, session, model, and browser tests.
- Run pnpm --dir examples/agents/voice-workbench typecheck and build.
- Run fas validate-task for the fast workflow gate.
- Run .fas/scripts/verify.sh --full at the final release-quality gate.

## Risks
- The LLM may skip the domain tool unless discovery instructions and repair feedback are explicit.
- A policy fact could be confused with execution authorization; the actor and provider must retain final authority.
- Domain-specific checks could leak into the renderer or Ignite packages; keep them in the example domain pack and derive UI in view.
- Live public web search cannot guarantee store-local Whole Foods prices; policy and UI must preserve evidence scope and unverified values.

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
