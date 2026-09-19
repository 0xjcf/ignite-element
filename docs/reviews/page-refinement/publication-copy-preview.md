# Publication-copy preview

## Authorization and starting identity

The Operator asked to see documentation as it will appear live, because the supporting beta will be released before deployment. This supersedes the temporary unreleased warnings required by the earlier Getting started prompt. It authorizes final learner-facing copy in the local candidate, not a package release or documentation deployment.

Started on `fas/docs-getting-started-source` at `8f8e0f71b069031c022be0109f47f157b6f88a94`, tree `51f23b362b47b92c2b19e573db60e59fa1277ab0`, with a clean worktree. The parked branch remains unchanged at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`.

## Changes

- Removed temporary command-source warnings from current site pages and coupled example READMEs. Later-page content was otherwise preserved; this is not their editorial review or acceptance.
- Restored `pnpm add ignite-element@beta` instructions on Getting started, Sources, the command-context upgrade note, and the root/facade quickstarts. Stable v2 remains separate.
- Restored complete-example download wording and its `pnpm install` / `pnpm dev` instructions. The canonical downloadable manifest now selects `beta`; its README describes normal use.
- Kept the existing command-context URL and rename/ownership sections, removed unreleased/integration narration, and named the installation section “Update Ignite.” No new migration navigation was introduced.
- Updated generated agent headers to match the publication copy. Historical beta.14 fixtures, beta release history, negative API checks and v2 archives remain intact.
- Replaced temporary warning assertions with checks that Getting started installs the beta channel, cannot regress to beta.14, includes installation, and excludes internal release instructions. The download must select the same channel. Historical publication checks and deployment workflow rules remain unchanged.

## Release reconciliation — required before deployment

This candidate is publication copy for local review. It is not evidence that the registry beta channel currently supports `commands({ source })`.

1. Select and prepare the supporting package version under separate release authorization.
2. Publish and verify the package family and confirm `ignite-element@beta` resolves to that release.
3. Validate the exact downloaded archive with registry packages, without local tarball substitutions. Recheck public installation, strict types, build and browser behavior.
4. Reconcile version-specific references such as compatibility and v2-to-v3 guidance during their page reviews. Preserve historical entries as historical; do not invent publication facts.
5. Deploy only after the package verification and required page acceptance, using the existing manual gate.

A green local docs check verifies content consistency, not release readiness. No workflow, credential, dist-tag, package version, changeset or release tag was changed.

## Validation and custody

Passed: 68-route build and agent regeneration; five handbook tests with 23 legacy mappings and ZIP/source equality; 3,151 internal references; 298 publication/version tests; built version routing; 31 compiled snippets; and formatting. Strict packed web/native consumers and the canonical light-switch project passed, including the standalone Vite build. The separate registry beta.14 historical fixture also passed. Browser inspection confirmed normal install/download text on Getting started and the cleaned command-context note. The light-switch source and shared presentation are unchanged. Candidate consumers explicitly replace the download's public beta selector with local package tarballs for pre-publication validation; the separate historical beta.14 consumer remains a registry test. That distinction must not be represented as a successful public beta install of the new API.

Existing dependencies and generated site output remain available for local review. Newly packed validation outputs are retained as authorized evidence. No remote changes are authorized. Validation took approximately 30 seconds for packed consumers and five seconds for the site build. Temporary consumer installs and tarballs were retained for review; shared visual styles and runtime inputs were not changed, so the earlier responsive matrix was not repeated.

## Page checkpoints

Getting started awaits re-review. Sources awaits review. Views is queued. Earlier audit receipts describe their historical candidates; this receipt supersedes their temporary learner-facing warning requirements only.
