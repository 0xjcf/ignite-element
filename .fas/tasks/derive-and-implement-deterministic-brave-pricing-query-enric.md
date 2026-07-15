# Derive and implement deterministic Brave pricing query enrichment for voice-workbench

## Source
Created with `fas create-task` on 2026-07-15.

## Problem
Brave Web Search can discover the correct Whole Foods product pages, but no tested
query payload exposes the store-scoped numeric price. Broad results also contain
misleading prices for different products and locations. The example needs to use
Brave as bounded discovery rather than treating snippets as authoritative pricing.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The admitted Bread, Eggs, and Milk defaults resolve official Sarasota Whole Foods
  offers without spending Brave requests.
- Uncatalogued selections use at most one no-retry Brave HTTP request per item to discover an
  official Whole Foods product page, then resolve its ASIN through one store-scoped
  structured product request.
- Retailer, store, product, package size, availability, price, and source validation fail closed;
  unrelated snippet prices never become admitted evidence.
- Product-pricing prompts use the domain-owned `priceProducts` capability while
  generic research retains `searchWeb`.
- Focused tests prove catalog hits, discovery fallback, store mismatch, missing
  offers, malformed pages, tool authorization, and completion evidence.

## Proposed solution
- Keep retailer-specific catalog and store policy under
  `src/domains/product-pricing/providers/`.
- Add a same-origin `priceProducts` capability and a server-owned Whole Foods
  adapter. Known representative products go directly to official product pages;
  unknown products use the existing paced Brave adapter only for discovery.
- Batch resolved ASINs through the official Whole Foods product endpoint with the
  Sarasota offer-listing discriminator, then validate product identity,
  availability, currency, and price before returning the existing bounded evidence.
- Hide generic `searchWeb` for product-pricing turns when the domain price provider
  is available, preventing redundant or lower-quality calls.

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
- .fas/tasks/derive-and-implement-deterministic-brave-pricing-query-enric.md
- examples/agents/voice-workbench/src/domains/product-pricing/policy.ts
- examples/agents/voice-workbench/src/domains/product-pricing/policy.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/providers/whole-foods.ts
- examples/agents/voice-workbench/src/domains/product-pricing/providers/whole-foods.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/projection.ts
- examples/agents/voice-workbench/src/domains/product-pricing/authorization.ts
- examples/agents/voice-workbench/src/domains/product-pricing/authorization.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/completion-audit.ts
- examples/agents/voice-workbench/src/domains/product-pricing/completion-audit.test.ts
- examples/agents/voice-workbench/src/domains/product-pricing/index.ts
- examples/agents/voice-workbench/src/web-search-capability.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/model.test.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/server/product-pricing/whole-foods.ts
- examples/agents/voice-workbench/server/product-pricing/whole-foods.test.ts
- examples/agents/voice-workbench/vite.config.ts
- examples/agents/voice-workbench/vite.config.test.ts
- examples/agents/voice-workbench/README.md

## Scope Amendments
- Live payload evidence showed the missing price is not a query-prompt problem. The
  scope therefore adds an example-private retailer adapter while keeping Brave as
  the discovery fallback and preserving the generic search capability unchanged.

## Implementation plan
1. Add pure Whole Foods store/catalog/query policy and update representative defaults.
2. Add the `priceProducts` browser capability and server route.
3. Resolve known catalog URLs directly; use paced Brave discovery only for misses.
4. Validate the store-scoped structured product response and return bounded evidence facts.
5. Route product-pricing turns through the domain capability and update audits.
6. Document request accounting and the provider/policy boundary.

## Verification plan
- Run focused product-pricing, Brave adapter, workbench-agent, Vite, and browser tests.
- Run the self-contained example typecheck.
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Whole Foods can change its structured product contract or store discriminator.
  Bound responses, parse defensively, and return unverified facts rather than guessing.
- Catalog references can become unavailable. Treat them as discovery hints and fail
  closed when the store-scoped offer is absent.
- Product-pricing routing could accidentally suppress generic search. Limit tool
  filtering to prompts where the product-pricing pack applies.

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
