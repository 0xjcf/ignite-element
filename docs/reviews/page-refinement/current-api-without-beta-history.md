# Current API without beta migration notes

## Scope and custody

Operator-authorized removal of beta-to-beta guidance and a consistency check of other current documentation pages. Started clean at `5c48cd055e4e2d25ab9429e3fe05cd728639fccd`, tree `4e406ee16fc77fcde535606434c23cf71d9f8d50`, on `fas/docs-getting-started-source`.

The parked branch remains at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`. Runtime, public declarations, package manifests, lockfile, changesets, package changelogs, workflows and frozen v2 sources are unchanged. No package release or deployment is authorized.

## Findings and corrections

- Replaced command-context, shared-readiness and testing-retirement beta notes with standard legacy-route redirects. They are excluded from search and current agent exports. Their old URLs reach Sources, Ownership or Testing; command-note fragments retain corresponding destinations. Sources no longer links a beta upgrade note.
- Removed beta-number comparisons and obsolete preparation/disposal instructions from headless, compatibility, ownership, testing, Actor-Web and plain-controller guidance. Preserved the current disposal, borrowed-source ownership and effect timing contracts.
- Replaced the Events page's per-view migration subsection with current view-lifecycle guidance. Preserved its old anchor for existing links.
- Removed retired beta helper/recorder narration from command metadata and agent guidance. Removed an old beta-publication receipt from contributor instructions while preserving the release procedure link and local/public distinction.
- Preserved historical bundle measurements with a version-neutral warning that they do not measure the current release.
- Rewrote the v2-to-v3 guide around stable-v2 differences. The old guide incorrectly called `states` a beta cutover relevant to v2 and mixed v3-only testing/headless changes into the stable upgrade. Removed that material and kept ESM, configuration entrypoints, command context, event emission and application validation.
- Corrected the historical v2 event-emission fragment to its positional `emit(name, payload)` signature. The fragment remains explicitly historical and excluded from current-API compilation; no new snippet exclusions were added.

## Stable-v2 evidence

Inspected the local authenticated `origin/main` tree at `90b73dad980a9608eef82d957d2c2f967ee494b4`; its package manifest identifies v2.2.2. `src/RenderArgs.ts` exposes the v2 command context `{ actor, emit, host }`, positional event emission and a snapshot-based states callback. `src/igniteCore/types.ts` already supports `states`. The package export map includes CommonJS and the old configuration/renderer subpaths. `src/index.ts` exposes configuration and factory internals, not the later beta testing/recording surface.

Thus the ordinary command callback existed in stable v2, even though the newer headless/API work happened during v3 beta. The `actor` to `source` change belongs in the real v2 upgrade instructions, not a separate beta-to-beta tutorial. This source comparison does not claim a new registry publication check.

## Validation

Passed: 68-route docs build and regenerated agent exports; six route tests with 26 legacy mappings and fragment destinations; 3,103 internal references; built version routing; 299 publication/version tests; and 30 compiled snippets with one existing fragment and seven existing exclusions. The previous count was 31 compiled snippets: the removed block was the misleading v2/early-beta `view` cutover example. No baseline or exclusion was added to suppress it.

Version tests now check actual registered-disposal/effect behavior instead of requiring beta.13/.14 labels in prose. Added regression coverage for retired note destinations and the stable migration's separation from early-beta APIs. One initial prose assertion matched only `dispose()` rather than the equivalent “dispose” wording; corrected that matcher while retaining both positive disposal coverage and negative checks against registration prohibiting disposal.

Inspected the current agent export: retired beta tutorials and comparisons are absent; current API and genuine stable-upgrade guidance remain. Browser validation confirmed the command-note fragment reaches Sources at `#command-target`, the readiness note reaches Ownership, and the testing note reaches Testing. Formatting passed. Normal lint and commit-message hooks run for the local commit.

No code, package input or shared styles changed, so the previous packed-consumer and responsive-matrix results are reused for those unchanged inputs. Site output is regenerated and retained for local review. Checks took seconds each; no installs or packing were needed.

## Review and release status

Getting started awaits re-review. Sources awaits review. Views remains queued. This cross-page cleanup does not accept those pages. Package changelogs and historical review receipts remain intact; they are not current learner instructions.

The current documentation still represents intended publication copy. Supporting packages must be published and verified before the separately authorized manual docs deployment. Nothing was pushed, merged, published or deployed.
