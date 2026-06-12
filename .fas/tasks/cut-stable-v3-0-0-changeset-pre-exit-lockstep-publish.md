# Cut stable v3.0.0: changeset pre exit + lockstep publish

## Source
Created with `fas create-task` on 2026-06-11.

## Problem
OPERATOR-RUN publish, gated on the owner's decision that the v3 beta line is ready for stable. Flow (see .claude/skills/release-beta and v3-beta-release-flow memory): changeset pre exit -> changeset version rolls the retained beta changesets into 3.0.0 -> pnpm release flow publishes all 4 lockstep packages; ignite-element 'latest' moves from 2.2.2 to 3.0.0, scoped packages' tags self-resolve. Docs branding: OWNER DECISION 2026-06-11 — KEEP the beta (neon-green) theme as the v3 default; do NOT delete the 'v3 BETA accent' block in docs/site/src/styles/theme.css and do NOT restore the cyan logos/favicon. At stable, only update that block's comment (drop the 'DELETE this whole section at stable v3' instruction; the :has()-based scoping already keeps the 2.x archive on the cyan -stable variants). AUDIT AMENDMENT (pre-stable-v3 audit 2026-06-11, F2) — BETA-COPY SWEEP checklist, all must flip at the cut: (1) packages/ignite-element/README.md:5-13 — remove the beta callout and change the install matrix from ignite-element@beta to ignite-element (this README ships inside the 3.0.0 npm package); (2) docs/site/src/content/docs/index.mdx — remove the 'v3 beta' hero badge and the 'Upgrading?' beta wording; (3) docs/site/src/content/docs/getting-started/installation.mdx — @beta install commands; (4) docs/site/src/content/docs/api/compatibility.mdx — the ':::caution v3 is in beta' aside; (5) docs/site/src/content/docs/migration/v3.mdx — beta references. Blocks the T7 deprecated-surface removal (task-1780795342150), which lands at pre exit. Sequencing: the main-merge task (merge v3 line to main, retire branch-dispatch docs deploys) runs immediately after this cut.


## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-element/README.md
- docs/site/src/content/docs/index.mdx
- docs/site/src/content/docs/getting-started/installation.mdx
- docs/site/src/content/docs/api/compatibility.mdx
- docs/site/src/content/docs/migration/v3.mdx
- docs/site/src/styles/theme.css

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-12
- Added paths: packages/ignite-element/README.md, docs/site/src/content/docs/index.mdx, docs/site/src/content/docs/getting-started/installation.mdx, docs/site/src/content/docs/api/compatibility.mdx, docs/site/src/content/docs/migration/v3.mdx, docs/site/src/styles/theme.css

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
