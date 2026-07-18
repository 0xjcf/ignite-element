# Improve voice-workbench partial-result UX and provider reason codes

## Source

Created with `fas create-task` on 2026-07-15.

## Problem

The voice workbench now produces an honest artifact when store prices cannot be
verified, but the accepted document and successful provider execution read as a
fully successful shopping outcome. Blank price cells, generic `unverified`
labels, empty policy sections, a raw slug title, and implementation-first proof
make it difficult to understand that the exact Sarasota prompt matched two
products but verified zero prices. Provider facts also collapse materially
different outcomes into an unstructured reason string.

DoorDash released `dd-cli` v0.2.0 as a consumer ordering CLI for humans and AI
agents, but it is waitlist-only and its bundled access terms restrict it to
personal transactions, prohibit products or services that rely on it, prohibit
retaining or analyzing CLI-accessed price data beyond an authorized
transaction, and may allow autonomous checkout. It therefore cannot be a
committed provider for this persistent open-source example without separate
DoorDash authorization.

## Acceptance criteria

- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- Product-pricing outcomes expose a bounded stable reason code instead of only a provider-authored explanation.
- The exact Sarasota three-item partial result derives a distinct shopper outcome in `igniteCore.view`: three requested, two products matched, zero prices verified, and a warning/partial status.
- Actor/model readiness, artifact commit status, provider execution status, and shopper result quality remain separate facts.
- Artifact display title, null-price copy, safe product-page links, empty policy-section visibility, and result-summary conditions are prepared in the view callback; JSX only maps prepared values.
- The center artifact leads with the shopper outcome and actionable next steps while technical receipts remain available in the right rail.
- Generic prompts and non-product-pricing artifacts preserve their existing behavior.
- DoorDash CLI is documented as evaluated but not integrated; no CLI binary, credential, catalog data, checkout command, or DoorDash-specific runtime code is committed.
- Focused headless and JSX tests cover complete, partial, unmatched, and empty-section presentation states.

## Proposed solution

- Define a small product-pricing reason-code vocabulary at the provider fact boundary and preserve the bounded human-readable explanation for diagnostics.
- Project reason codes through capability outcomes into a view-derived shopper result-quality summary with counts, tone, status, and next actions.
- Prepare display-only artifact titles, table cells, and safe link metadata inside `igniteCore.view` without mutating the actor-owned document or its schema.
- Map the prepared result summary and policy sections in JSX and add only the styles needed for clear partial/complete/needs-input states.
- Document why DoorDash CLI is not an eligible committed adapter and keep the existing provider-neutral domain boundary available for a future authorized integration.

## Alternatives considered

- Treat provider success as shopping success: rejected because a successful request can return zero verified prices.
- Put null formatting, title humanization, link parsing, and empty-section checks in JSX: rejected because presentation conditions and derived values belong in the Ignite view callback.
- Add DoorDash CLI as a local shell adapter now: rejected because the current waitlist access terms do not permit this persistent product/example use or retained pricing facts.
- Improve only the LLM prompt: rejected because the missing distinctions are deterministic provider and presentation facts.

## Affected files

- .fas/TASKS.md
- .fas/memory/architecture.md
- .fas/memory/decisions.md
- .fas/memory/incidents.md
- .fas/memory/integrations.md
- .fas/memory/patterns.md
- .fas/memory/pr-feedback.md
- .fas/tasks/improve-voice-workbench-partial-result-ux-and-provider-reaso.md
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.test.ts
- examples/agents/voice-workbench/server/product-pricing/whole-foods.ts
- examples/agents/voice-workbench/server/product-pricing/whole-foods.test.ts
- examples/agents/voice-workbench/src/workbench-agent.ts
- examples/agents/voice-workbench/src/workbench-agent.test.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/README.md

## Scope Amendments

- Five pre-existing, git-ignored `.fas/memory` projections are declared as
  reference-only scope because the closeout scanner includes them in its live
  ChangeSet. This task did not edit or commit those projections.

## Implementation plan

1. Add failing provider and projection tests for stable per-item reason codes.
2. Implement the bounded reason-code contract and preserve it through the existing product-pricing capability proof.
3. Add failing headless tests for partial, complete, and needs-input result-quality projections plus prepared artifact display values and filtered policy sections.
4. Derive the result-quality and display read models in `igniteCore.view` without changing actor-owned artifacts.
5. Add failing JSX tests for the shopper summary, readable title/table/link presentation, and omission of empty policy sections.
6. Map the prepared view in JSX, style the result states, and update example documentation and integration memory.

## Verification plan

- Run focused product-pricing provider, workbench-agent, session headless, and JSX tests after each plan step.
- Run the self-contained voice-workbench typecheck and complete example suite.
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks

- Reason-code vocabulary can overfit Whole Foods. Keep codes about observable resolution/price outcomes and preserve a diagnostic message separately.
- A display projection can accidentally mutate the actor document or leak into schema output. Derive separate display metadata and test raw schema parity.
- A partial shopper outcome can be confused with actor or provider failure. Keep each status axis separately named and rendered.
- UI density can increase. Lead with one bounded summary and retain technical detail under the existing proof rail.
- DoorDash access terms and CLI behavior can change. Do not add runtime code until an authorized contract is available and re-evaluated.

## Dependencies

- Existing example-private product-pricing pack and capability federation.
- DoorDash CLI is explicitly not a runtime dependency for this slice.

## Open questions

- A future DoorDash adapter requires written permission or a developer contract that permits persistent example integration and an explicit human checkout boundary.
- A follow-up architecture slice should split the product-pricing functional core, ports, capabilities, and adapters so the same application contract can be hosted idiomatically by XState, Actor-Web, Redux, or MobX without changing Ignite.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
