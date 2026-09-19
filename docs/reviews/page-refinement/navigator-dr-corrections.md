# Navigator DR-01–DR-03 correction receipt

Status: **IGNITE_DOCS_RELEASE_BOUNDED_CORRECTIONS_READY_FOR_REVIEW**.

Parent candidate: `1464abef91cd8c2664233ee69ed379dea67db025`, tree `67592199e5f574dbdd566f3aad800db0a8038c39`. The successor commit/tree and incremental patch are recorded in the external correction packet. Accepted runtime baseline remains `4e1441ead1f91d4f6de60ab0f4187bcee59c9a21`.

## Corrections

| Finding | Classification | Result |
| --- | --- | --- |
| DR-01 | blocking_public_contract | Current core/bindings, command-availability and API guides describe the current v3 beta and beta installation; beta.13/beta.14 behavior statements are explicitly historical. |
| DR-02 | blocking_correctness | Both quickstart READMEs link to the absolute rendered Getting started route and its build-a-component anchor. |
| DR-03 | blocking_public_contract | Compatibility separates TypeScript 5.9.3 repository/packed-consumer evidence from the starter’s tested 7.0.2 and Vite 8.3.0 combination, without promising compiler-major-wide support. |

The existing publication contract now checks the three current repository guides and both READMEs. Six focused tests reject stale candidate/branch wording and source-only quickstart links while allowing explicit historical release statements. Historical fixtures, archives, prior receipts and verified-version guards are unchanged.

## Focused evidence

- Fresh frozen installation; Node 22.16.0 and pnpm 10.33.0.
- Package build completed as a prerequisite for the documentation build; no runtime suite was repeated.
- Publication checks: 308 tests passed; five repository guides checked with zero problems. Deployment permissions and v2 install checks remain green.
- The existing permissive snippet scanner accounts for 31 checked blocks, not 31 independent strict packed consumers.
- Documentation and agent exports regenerated: 69 HTML routes, 29 legacy mappings, 3,121 internal references, eight handbook tests and canonical ZIP/export checks passed.
- Focused built-content inspection confirms the README anchor, component, stylesheet, HTML and download, plus both tested compiler versions in the Compatibility page and full agent export.
- Actual deployed URL verification remains part of the authorized live closeout, after public verification of supporting packages.
- Normal formatting and local commit hooks apply. Baseline lint warnings and the previously disclosed import-order limitations are not claimed fixed.

Unaffected strict packed consumer, native-host and browser evidence from the parent is reused for unchanged implementation, manifests, lockfile, canonical example modules and fixtures. The package README changed, so the old packed README is historical evidence; final release packaging must include its corrected link. No new packed-payload identity or hosted CI is claimed here.

## Custody and next checkpoint

The eight-page structure, runtime source, package metadata, lockfile, native fixtures, workflow protections, original archive and parked branches are preserved. Only six documentation files, two checker/test files and this receipt change. Task-generated build/dependency output is removed after retaining the updated preview and focused logs.

Return this successor for acceptance of the completed documentation release set. Getting started still awaits re-review; Sources awaits review; Views remains queued. No editorial acceptance, push, integration, staging, publication or deployment occurred. After release-set acceptance, continue the already authorized protected release sequence; independent exact-stage acceptance and public verification still precede publication/deployment at their established boundaries.
