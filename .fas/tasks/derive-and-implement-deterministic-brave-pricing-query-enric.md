# Derive and implement deterministic Brave pricing query enrichment for voice-workbench

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
The first deterministic pricing slice overfit the example to three committed Whole Foods product identities and introduced a rejected-policy repair dead end. The exact Sarasota shopping-list prompt currently collapses requested subjects, hides prepareProductPricing after rejection, never reaches priceProducts, and surfaces a generic invalid model response. Replace the source catalog with scalable retailer-native discovery, deterministic candidate selection, bounded caching, explicit clarification, and observable repair behavior while retaining Brave only as a budgeted fallback.


## Acceptance criteria
- The exact prompt creates three distinct requested subjects and does not end in a generic invalid-response state
- Rejected or needs-input policy proposals retain a bounded repair or clarification path and expose their real reason
- No committed Bread Eggs or Milk product ASIN catalog or representative product identity is required for successful pricing
- Whole Foods retailer-native discovery resolves store-scoped candidates and batches selected identifiers into structured offer lookup
- Candidate normalization ranking ambiguity and price validation are deterministic schema-aware and fail closed
- A bounded TTL cache coalesces and reuses stable discovery facts without caching prices beyond their freshness policy
- Brave is invoked only as a no-retry budgeted fallback when retailer-native discovery cannot resolve a candidate
- The LLM receives one aggregated priceProducts result and generic research retains searchWeb
- Focused and end-to-end tests cover the failing prompt repair discovery ambiguity cache fallback and partial-price cases
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Keep retailer-specific store policy, native-response decoding, candidate-ranking
  policy, and official product URL helpers under
  `src/domains/product-pricing/providers/`.
- Route the exact admitted subject-only request through one same-origin
  `priceProducts` capability backed by a server-owned Whole Foods adapter; do not
  require committed representative product identities or ASINs.
- Decode at most 12 retailer-native candidates per subject and rank them with the
  versioned `whole-foods-candidate-v1` policy: `0.75 * requested-subject token
  coverage + 0.25 * inverse one-based native position`, a `0.80` minimum score,
  and a `0.10` minimum margin, with normalized product name and ASIN as stable
  tie-breakers.
- Invoke zero-retry Brave discovery only after a decoded HTTP-200 retailer-native
  miss. Treat native transport failure or schema drift as ineligible for fallback.
- Batch deduplicated selected ASINs through one store-scoped Whole Foods offer
  lookup, then validate identity, availability, USD currency, and a finite positive
  price before returning sourced or explicit unverified facts.
- Cache only selected identities, keyed by store, subject, native query, and the
  full candidate-policy fingerprint, with bounded TTL, LRU eviction, and in-flight
  coalescing; fetch current offer details on every request and report aggregate
  cache status with `miss > coalesced > hit` precedence.
- Consume the single `priceProducts` budget after any provider-dispatched attempt,
  including timeout or provider failure, while keeping pre-provider authorization
  and validation denials repairable.
- Hide generic `searchWeb` only for product-pricing turns when the domain provider
  is available, while preserving generic research behavior elsewhere.

## Alternatives considered
- Prompt-only query enrichment: rejected because baseline, site-restricted,
  answer-seeded, extra-snippet, and count=20 payloads did not return the known
  Sarasota price.
- Let the LLM interpret numeric snippets: rejected because the only returned prices
  belonged to Orlando, Reddit, or a different product.
- Hardcode numeric prices: rejected because prices must remain live observations;
  only stable provider references and store identity are configured.

## Affected files
- .fas/TASKS.md
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/integrations.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md
- .fas/tasks/derive-and-implement-deterministic-brave-pricing-query-enric.md
- examples/agents/voice-workbench/src/domains/contracts.ts
- examples/agents/voice-workbench/src/domains/registry.ts
- examples/agents/voice-workbench/src/domains/registry.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/artifact-materializer.ts
- examples/agents/voice-workbench/src/domains/product-pricing/artifact-materializer.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/policy.ts
- examples/agents/voice-workbench/src/domains/product-pricing/policy.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/providers/whole-foods.ts
- examples/agents/voice-workbench/src/domains/product-pricing/providers/whole-foods.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/providers/fixtures/whole-foods-native-search.json
- examples/agents/voice-workbench/src/domains/product-pricing/projection.ts
- examples/agents/voice-workbench/src/domains/product-pricing/authorization.ts
- examples/agents/voice-workbench/src/domains/product-pricing/authorization.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/completion-audit.ts
- examples/agents/voice-workbench/src/domains/product-pricing/completion-audit.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/index.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/server/product-pricing/whole-foods.ts
- examples/agents/voice-workbench/server/product-pricing/whole-foods.test.ts
- examples/agents/voice-workbench/vite.config.ts
- examples/agents/voice-workbench/vite.config.test.ts
- examples/agents/voice-workbench/README.md
- examples/agents/voice-workbench/src/domains/product-pricing/capability.ts
- examples/agents/voice-workbench/src/domains/product-pricing/capability.test.ts

## Scope Amendments
- Live payload evidence showed the missing price is not a query-prompt problem. The
  scope therefore adds an example-private retailer adapter while keeping Brave as
  the discovery fallback and preserving the generic search capability unchanged.

- Type: correctness-and-scalability
- Added at: 2026-07-15
- Trigger: Live exact-prompt reproduction after the first provider slice
- Reason: The committed catalog does not scale and the rejected policy decision removes its own repair tool before price lookup
- Added paths: examples/agents/voice-workbench/src/domains/product-pricing/capability.ts, examples/agents/voice-workbench/src/domains/product-pricing/capability.test.ts, examples/agents/voice-workbench/src/domains/product-pricing/policy.ts, examples/agents/voice-workbench/src/domains/product-pricing/policy.test.ts, examples/agents/voice-workbench/src/domains/product-pricing/authorization.ts, examples/agents/voice-workbench/src/domains/product-pricing/authorization.test.ts, examples/agents/voice-workbench/src/domains/product-pricing/providers/whole-foods.ts, examples/agents/voice-workbench/src/domains/product-pricing/providers/whole-foods.test.ts, examples/agents/voice-workbench/server/product-pricing/whole-foods.ts, examples/agents/voice-workbench/server/product-pricing/whole-foods.test.ts, examples/agents/voice-workbench/src/model.ts, examples/agents/voice-workbench/src/model.test.ts, examples/agents/voice-workbench/src/workbench-agent.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts, examples/agents/voice-workbench/README.md
- Evidence source: local browser and manual same-origin provider request
- Evidence: local browser and manual same-origin provider request | examples/agents/voice-workbench/src/domains/product-pricing | prepareProductPricing rejected duplicate Groceries subjects; manual valid priceProducts returned one sourced and two unverified facts
- Accuracy signal: live reproduction plus current source inspection
- Follow-up needed: Replan implementation and verify the exact Sarasota prompt end to end

- Type: live-proof-projection
- Added at: 2026-07-15
- Trigger: Fresh SRE review against the explicit requirement to complete the live right rail in this PR
- Reason: The provider returns bounded per-subject native, Brave, and cache receipts, but the workbench capability proof and session presentation currently collapse them to aggregate counts and cannot prove each subject's discovery path
- Added paths: examples/agents/voice-workbench/src/workbench-agent.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts, examples/agents/voice-workbench/src/session.ts, examples/agents/voice-workbench/src/session.headless.test.ts
- Evidence source: SRE source audit after provider lifecycle remediation
- Evidence: price-capability.ts preserves each search receipt; workbench-agent.ts capabilityProof and recordCapabilityOutcome omit the detail; session.ts capability cards cannot render it
- Accuracy signal: current source inspection plus the user's explicit same-PR right-rail requirement
- Follow-up needed: Add a bounded presentation projection and render subject, native, Brave, and cache facts in the capability card, then verify the exact prompt in the live browser

- Type: deterministic-domain-materialization
- Added at: 2026-07-15
- Trigger: Fresh live exact-prompt verification after structural identity normalization
- Reason: The actor now accepts the model artifact structurally, but the local model repeats completeResponse after audit rejection instead of revising semantic content; exact provider facts therefore need an optional domain-owned artifact materialization hook rather than a larger retry budget
- Added paths: examples/agents/voice-workbench/src/domains/contracts.ts, examples/agents/voice-workbench/src/domains/registry.ts, examples/agents/voice-workbench/src/domains/registry.test.ts, examples/agents/voice-workbench/src/domains/product-pricing/artifact-materializer.ts, examples/agents/voice-workbench/src/domains/product-pricing/artifact-materializer.test.ts, examples/agents/voice-workbench/src/domains/product-pricing/index.ts, examples/agents/voice-workbench/src/workbench-agent.ts, examples/agents/voice-workbench/src/workbench-agent.test.ts
- Evidence source: in-app browser exact prompt plus fresh QA source audit
- Evidence: createArtifact revision 1 was accepted after ID normalization, then Gemma repeatedly proposed completeResponse; the artifact remained table-only with N/A strings, no checklist, and missing selected size while the scripted test hard-coded a reviseArtifact call
- Accuracy signal: live runtime state, accepted actor revision, and current source inspection
- Follow-up needed: Materialize the canonical product-pricing artifact from the latest admitted decision and priceProducts facts, preserve one provider execution, align unverified Source semantics, and rerun live acceptance

## Implementation plan
- Repair policy subject extraction and allow bounded re-preparation after rejected or needs-input decisions
- Replace representative defaults and the committed Whole Foods product catalog with retailer-native product discovery and deterministic candidate ranking
- Add bounded in-memory TTL caching and request coalescing for stable product identity discovery
- Keep Brave as a no-retry fallback only after retailer discovery misses and preserve free-plan request accounting
- Batch selected product identifiers through the store-scoped offer endpoint and return sourced or explicit unverified facts
- Improve model failure diagnostics and right-rail policy feedback so expected clarification is not reported as invalid model output
- Preserve bounded per-subject pricing receipts in presentation state and render their native, Brave, and cache paths in the live right rail
- Update documentation and exact-prompt end-to-end verification

## Verification plan
- Run focused product-pricing policy authorization provider cache and model-loop tests
- Run the voice-workbench example typecheck and test suite
- Exercise the exact prompt against the local MLX and same-origin pricing route without spending Brave requests on a retailer-native success
- Run fas validate-task then full FAS verification and findings-aware review

## Risks
- Whole Foods retailer search and offer response shapes are private and can drift; parse defensively and fail closed
- Candidate ranking can select the wrong product; require confidence and ambiguity thresholds
- Cache keys and TTLs can leak stale or cross-store identities; include retailer store query and selection policy in identity
- Model repair can loop; enforce a small explicit retry budget and preserve policy facts

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
