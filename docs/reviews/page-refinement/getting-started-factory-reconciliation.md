# Getting started re-review after factory reconciliation

## Scope and identities

The Operator authorized reconciling the merged factory refinement into
`fas/docs-getting-started-source`, preserving its editorial changes, and returning
Getting started only for re-review. Sources follows acceptance; Views follows Sources.
No package release, staging, publication, remote push or documentation deployment
was performed or authorized by this continuation.

- Editorial starting commit: `5800ebfb082a3235449486377dfed250c0c00b1f`.
- Editorial starting tree: `0f61fcee894b5afaa549869ebe14fa5a6e603f91`.
- Integrated beta commit: `af0de5696b60922aacbbcc895879adcc72851357`, from [PR #114](https://github.com/0xjcf/ignite-element/pull/114).
- Local reconciliation commit: `06f18ee49b6959d158572699016bf417ff22ea8a`.
- Validated reconciliation tree: `06998f3d3654aea87244488adc14c67ca868a72c`.
- Preserved original parked branch: `fas/docs-page-refinement`, commit `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`, tree `14689a7da715fa2cfde41745438f7485bbb34b5d`.

The merge has both the editorial starting commit and integrated beta as parents.
Only Sources and Ownership required conflict resolution. Their edited prose,
three-source scope and source-ownership rules were retained. The checked MobX
and Redux factory examples and narrow API/README corrections were carried forward.
These are integration corrections, not a new page review or acceptance.

All package source and workflows match integrated beta. Getting started, its
canonical example, shared styles, site configuration and the editorial lockfile
are byte-identical to the editorial starting commit. The follow-up receipt commit
changes only this review record and the ledger.

## Getting started candidate

The page retains short sentences, one idea per paragraph, scannable headings,
native Starlight controls and both themes. Optional Vite setup remains a disclosure.

The light switch passes the machine definition as `source`, derives the label,
boolean state and count in `states`, and declares `commands: ({ source })` with
`source.send({ type: "FLIP" })`. The view uses `ctx`. Each element gets its own
private actor. The simple example links to ownership guidance without adding a
teardown wrapper. No factory catalogue was added to Getting started.

Displayed source, live demo, downloadable ZIP and agent export continue to consume
the same canonical files. The publication copy installs `ignite-element@beta`.

## Validation

Fresh validation used Node 22.16.0 and pnpm 10.33.0. The editorial lockfile SHA-256
is `8aa8b83320068170d821c4dc2d8f472a8f6e13b542bb18117739af835548fccf`.

| Check | Result |
| --- | --- |
| `pnpm --filter ignite-element... build` | Passed for the four package family members. |
| `pnpm --filter ignite-element typecheck` | Passed production, strict type fixtures and browser-test declarations. |
| `pnpm --filter docs-site check:primary` | Passed packed web/native declarations and behavior, including both factory fixtures, actual MobX README, canonical light switch and standalone Vite build. |
| Packed behavioral tests | Four web tests and two native tests passed. The light switch test checks independent sibling actors and label/count/ARIA updates. |
| Historical registry lane | The separate unchanged beta.14 fixture compiled and its one test passed. |
| `pnpm --filter docs-site check:docs` | 25 blocks typechecked, one incomplete fragment skipped and seven explicit exclusions; zero new drift. Raw-imported primary examples are covered by strict packed consumers. |
| `pnpm --filter docs-site check:publication` | 299 tests passed; manual deployment gate and publication contract passed. |
| `pnpm --filter docs-site check:astro` | Zero errors, zero warnings; one existing hint. |
| Site build and agent exports | 68 routes built successfully; current and archived agent exports regenerated separately. |
| Built version routing, links and handbook | Seven handbook tests, 29 legacy mappings, 2,915 internal references and ZIP/source equality passed. |
| `pnpm --filter docs-site check:contrast` | 60 layout cases, 64 contrast checks and 13 native-control geometry checks passed. |
| Browser interactions | Pointer, Space and Enter light-switch input; copied canonical source; pagination hover/focus; footer links; mobile menu; keyboard scrolling and navigation passed in both themes. |
| Architecture, formatting, lint and whitespace | Passed. Normal commit hooks ran; lint reports existing non-fatal warnings and informational diagnostics. |

In-app browser inspection confirmed Off/0 → On/1 → Off/2 through pointer and Space
on both the documentation demo and the fresh standalone packed consumer. Desktop
and mobile screenshots were inspected in light and dark themes. The full runtime
suite was not rerun for this documentation-only merge resolution; the package
implementation is unchanged from integrated beta, and fresh build/type/consumer
checks cover the reconciled documentation inputs.

## Preview and release boundary

- Getting started: <http://127.0.0.1:4326/ignite-element/>.
- Standalone packed-candidate example: <http://127.0.0.1:4331/>.

Candidate consumers replace the public beta selector with locally built tarballs.
Their package manifests still carry the pre-release preparation version; those
labels are not registry publication evidence. Tarball hashes, resolved paths and
consumer lock hashes are retained in the task-local provenance record.

Before deployment, separately authorize and publish the supporting beta, verify
its registry availability, and rerun the downloadable project with registry
packages and no candidate overrides. The [publication-copy receipt](publication-copy-preview.md)
retains that release sequence. The existing manual deployment gate is unchanged.

## Custody and workflow cost

The original parked branch remains clean and unchanged. The editorial branch's
pre-existing dependencies, package output and generated site output were preserved
and refreshed for validation and local preview. No unexpected ignored-output
locations were added. Local consumer installations, tarballs, logs, provenance and
screenshots are retained as authorized review evidence outside the repository.

The four-package build, packed validation and site build each completed in under
a minute; responsive browser validation completed in under two minutes. The first
headless browser launch was denied by the sandbox; the same existing regression
command passed with approved execution permissions. One commit-message attempt
was rejected because `merge` is not an allowed conventional type; the commit then
passed normally with `docs`. No hooks or assertions were bypassed. Receipt-only
changes do not invalidate the recorded executable checks.

## Checkpoints

Getting started awaits re-review. Sources awaits review with the simplified
factory examples reconciled. Views remains queued. No acceptance has advanced.

`IGNITE_GETTING_STARTED_SOURCE_API_READY_FOR_REVIEW`
