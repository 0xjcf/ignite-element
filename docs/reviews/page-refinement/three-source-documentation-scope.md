# XState, Redux, and MobX documentation scope

## Authorization and custody

The Operator requested removal of Actor-Web text and examples from documentation because it is not ready for public support. This slice narrows current learner guidance to XState, Redux and MobX. It does not remove package exports, runtime support or contract tests, or amend the repository architecture.

Started clean at `9a9c439a32d712630457f79ada6b7473719dc427`, tree `915f79b97ec5def484fa7b3ce5757163d9da5bf5`, on `fas/docs-getting-started-source`. The parked branch remains at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`.

## Changes

- Removed Actor-Web from source tables, sidebar navigation, source ownership, event forwarding, compatibility, advanced configuration, accessibility, headless reference and historical bundle presentation. XState, Redux and MobX examples remain.
- Retired the Actor-Web guide and the plain-controller guide, which directly imports the deferred adapter. Their old URLs and section links redirect to Sources. The related contributor recipe redirects to Testing. Redirect stubs are excluded from search and current agent exports.
- Removed the plain-controller fixture from the example catalogue and replaced its public README tutorial with a brief internal-validation notice and a Sources link. Its implementation, scripts and regression coverage remain intact.
- Kept the smart-home example's XState instructions; removed the optional Actor-Web mode from its README and screencast instructions. Removed the public README link into its historical gap analysis. Runtime variants and their tests remain internal regression inputs and were not deleted or redesigned.
- Removed deferred-integration promotion from root/facade/adapter READMEs and the current core-binding, source-free, availability and tools references. The adapter README now labels its list “Documented entrypoints” rather than claiming to exhaustively list all exports.
- Replaced Sources' optional-integrations section with links to Shared sources and Routing. Preserved its old section anchor. The existing responsive navigation tests now exercise these retained guides in both themes and at desktop/mobile widths.
- Added guards against Actor-Web text in the current generated agent export and against deferred guides in the sidebar. Added redirect coverage. Updated version/lifetime checks to use retained reference pages rather than an absent tutorial.

## Preserved boundaries

Package source, exports, manifests, dependency lockfiles, workflow rules, AGENTS.md and frozen v2 content are unchanged. Existing architecture decisions, release history, design proposals and historical validation records retain their original evidence. Removing them would rewrite history or accepted architecture rather than narrow the public handbook.

The repository still contains the existing adapter and internal example regression code. This task does not represent their deletion, an API breaking change, or a package publication. The site and current linked guidance no longer recommend that integration.

## Validation

Passed: 68-route build and regenerated agent exports; seven handbook tests with 29 legacy mappings; 2,915 internal references; built version routing; 299 publication/version tests; and 25 compiled snippets. One pre-existing fragment and seven exclusions remain. The compiled count dropped from 30 because the five Actor-Web guide blocks were removed; no new suppression or baseline entry was added.

Fresh strict packed web/native consumers and the canonical standalone light-switch build passed. The historical registry beta.14 fixture remains separately checked. New package provenance is retained with the local validation evidence; README changes affect tarball bytes but not runtime behavior.

Responsive browser validation passed: 60 page/theme/viewport cases, retained-guide links and keyboard/sidebar return navigation in both themes at desktop/mobile widths, version round trips, preserved Events fragments, 64 AA contrast checks and 13 native-control geometry checks. The first run exposed a stale heading assertion from the earlier beta-history cleanup. It now verifies the retained legacy fragment plus the current “View-specific work” heading; coverage was not skipped. Formatting passed. Normal lint and commit-message hooks run for the local commit.

In-app browser verification confirmed the retired Actor-Web URL redirects to Sources; its visible content lists only XState, Redux and MobX and contains no deferred-integration text. Shared visual styling is unchanged. The navigation matrix was rerun because the promoted guides changed.

Current site-source scans find Actor-Web only in the retired guide's route identifier, needed for old URL preservation. Root/package/example READMEs and the current agent export contain no Actor-Web instructions. Historical source/architecture records and internal tests are intentionally outside that public-content scan.

## Review and release status

Getting started awaits re-review. Sources awaits review. Views is queued. Later-page content cleanup does not confer acceptance. Supporting beta publication still precedes a separately authorized manual documentation deployment. Nothing was pushed, merged, released or deployed.

Existing preview output and new packed-consumer evidence are retained for local review. No dependency or runtime work was introduced solely to remove documentation. The docs build took about five seconds; packed-consumer validation took roughly 30 seconds. Two browser runs were needed to expose and correct the stale assertion. Temporary validation installs and tarballs remain in the evidence directory; the application dependency graph and root lockfile are unchanged.
