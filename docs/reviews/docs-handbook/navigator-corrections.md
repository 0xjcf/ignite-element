# Navigator correction receipt

Date: 2026-09-16. Reviewed baseline: `ce4c577a52f78b1061c9d2629c71deb12c3549ef`, tree `42925e6cc355ac97955e2e4332c21206ee4a8d33`. PR #111 was authenticated open and unmerged at that head; the task worktree was clean. The original approval manifest and Operator's bounded correction request authorize this follow-up. The final exact head/tree are recorded in the PR and handoff.

PR #110's Navigator acceptance is recorded as a review disposition only. No merge or deployment is performed. The eight-page structure, APIs, runtime source, agreement, lockfile, frozen v2 pages and primary checkout are preserved. Historical custody uncertainty is unchanged.

## Corrections and focused evidence

| Finding | Correction | Evidence |
| --- | --- | --- |
| H01 | [Shared-source guide](../../site/src/content/docs/guides/shared-source-ownership.mdx) now states core/source evaluation, activation/baseline, queued source-processing delivery, shared lifetime through disposal and no commit guarantee; links canonical timing/error rules. | Before correction, regenerated `llms-full.txt` failed the new obsolete-statement guard. After correction, regenerated export and guard pass. Historical migration explanations remain historical. |
| H02 | [MobX README](../../../examples/adapters/mobx/README.md) names `mobx-cores.ts`, imports the real sibling store and supplies `adapter: "mobx"` for its factory. | Actual README extraction initially failed with TS2304 for the missing store. The corrected literal README module and real decorated store compile in a separate strict configuration against packed public exports, `skipLibCheck: false`. No placeholders, inference changes or helper added. The docs CI path filters and policy guard also include the README and real store. |
| H03 | [Routing guide](../../site/src/content/docs/guides/routing.mdx) calls `router.dispose()` inside the existing inline test cleanup, then stops the borrowed source in a nested `finally`. | Bounded contradiction was the original actor-only cleanup. Reviewed nested cleanup preserves source shutdown if core disposal throws; focused snippet validation passes. |
| H04 | [Route map](../../site/src/route-map.json) maps all four preserved Events headings to their corresponding headings in `handbook/events`. | Added subject-specific unit assertion failed on original mapping and passes after correction. Real browser regression navigates all four original fragment URLs at desktop and mobile widths, asserting destination URL/hash and actual heading text; destination-existence checks remain. |
| Reference leftovers | Vue/Svelte READMEs link the current interop contract instead of duplicating obsolete `getSchema()` and speculative wrappers. [API notes](../../api/README.md) now link canonical contracts with explicit beta.14/v2 context. | Updated source dispositions; no archived API prose changes. Link targets and current headings checked. |

The earlier green checks did not prove completeness: the strict lane omitted this linked MobX README and the route checker proved existence, not semantic equivalence. Both gaps now have focused coverage. The original broad D02/D05/D10 completeness claims should be read with this correction.

## Validation

- `pnpm run format:check`, `pnpm run lint`, `pnpm run architecture:check`.
- `pnpm --filter docs-site check:primary`: actual MobX README plus existing strict packed web/native modules; four web and two native tests; native isolation. Separate README configuration enables the real store's existing TypeScript decorator convention without changing package/compiler contracts.
- `pnpm --filter docs-site check:publication`: 283 tests, zero policy violations.
- `pnpm --filter docs-site check:docs`: 31 checked modules, one fragment, zero baselined failures; the actual README is additionally covered by the strict lane above.
- `pnpm --filter docs-site check:astro`: zero errors/warnings, one existing hint.
- `pnpm --filter docs-site build`: 67 pages and regenerated current/archive agent exports.
- `pnpm --filter docs-site check:handbook`: five focused tests, all routes/counterparts/fragments and export/README guards.
- `pnpm --filter docs-site check:links`: 3,020 internal references resolve. `check:versions:built` passes.
- `pnpm --filter docs-site check:contrast`: 52 contrast and 10 geometry checks, version round trips and four exact Events fragment destinations at 1366px and 390px.
- Normal commit/push hooks remain enabled; complete required package/script/example profile and fresh CI results are recorded in the PR.

Package/declaration build inputs are unchanged; strict consumers repack the same built packages. The broader responsive matrix and React browser interactions are retained original-candidate evidence, not claimed as newly rerun. New browser evidence is bounded to the existing contrast/navigation regression and corrected Events fragments. Production and physical-device verification remain outside this round.

## Custody and cost

One focused correction commit plus a small CI path-filter follow-up; no history rewrite. Task-local installs/generated outputs remain retained under the manifest. The strict run was repeated to prove red then green; docs checks were run after the corrections. Normal pre-push runs the full repository profile using the previously verified Node/pnpm launcher environment and canonical task-local TMPDIR; no test or hook is bypassed. GitHub CI is separate fresh evidence. Navigator re-review remains the acceptance boundary for PR #111.
