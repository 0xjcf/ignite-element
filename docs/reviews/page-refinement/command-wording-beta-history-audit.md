# Command wording and beta-history audit

## Scope and custody

Operator-requested consistency audit on 2026-09-17, starting at local candidate `c59e53713cbbbce7fcfeecd980a436387a92cc42`, tree `2af5a1be7ecdca20ca3cef34d168496d11200362`, branch `fas/docs-getting-started-source`. The starting worktree was clean. This is a bounded continuation of the Getting started reconciliation, not acceptance or the full Sources editorial pass.

Reviewed current handbook, retained guide/reference and migration text, example READMEs, the package changelog and pending command-context changeset. Searched current docs and examples for obsolete callback destructuring and prose references to the command actor; inspected matching context rather than replacing valid XState/Actor-Web terminology or deliberate aliases. A supplementary prose scan covered 72 non-archive site/example/package Markdown files. This is a command-vocabulary and release-boundary audit, not a fresh semantic validation of every example or completion of A01–A12/E01–E10.

The parked branch remains at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`. Runtime, API, workflows, shared styles, navigation, package versions, changesets, changelogs and v2 archives are unchanged. No remote publication is authorized.

## Findings and bounded corrections

| Finding | Classification | Evidence and disposition |
| --- | --- | --- |
| MobX prose names the wrong callback variable | `blocking_correctness` | Sources said the action runs through `actor`; its canonical fixture uses `{ source: store }`. Corrected the explanation to `store.increment()` on the observable instance. |
| Sources installs an incompatible published package | `blocking_correctness` | Three install blocks pinned beta.14 alongside unreleased source-context examples. Removed the Ignite package from those commands, explicitly labeled them as source-library installation only, and retained the candidate requirement. Public Ignite installation remains pending release. |
| Command-context note describes a superseded Getting started page | `blocking_correctness` | It claimed Getting started still used beta.14 syntax. Corrected the link description and separated existing-beta upgrade readers, new projects and v2 upgrade readers. Labeled the page unreleased beta, removed consumer-specific and internal integration narration. Existing URL and section anchors remain. |
| Headless reference claims all content is published beta.14 | `blocking_correctness` | Runtime baseline is beta.14, but callback examples use the unreleased rename. Made that distinction explicit. |
| Plain-controller instructions recommend beta.14/beta.12 for migrated code | `blocking_correctness` | The site note recommended beta.14; the linked example README recommended beta.12. Both now require the candidate checkout for this syntax. Existing local run commands and source files remain unchanged. |
| Historical beta.13 effects description can be mistaken for current guidance | `blocking_correctness` | Shared-readiness note includes the former host-attached effects description. Marked the entire note as a beta.12-to-beta.13 historical comparison, removed its current-install recommendation, and linked the current effects contract. Historical body preserved. |
| Stable upgrade guidance and beta history remain mixed | `workflow_improvement` | `migration/v3.mdx` interleaves v2 upgrade guidance, beta.12/.13/.14 history, publication/custody narration and the phrase “APIs are stable.” This is existing A04 scope, still queued for the migration page review. No wholesale rewrite or route relocation in this pass. |

Remaining `actor` occurrences in current callback examples use explicit `{ source: actor }` aliases or refer to actual source actors. The command-source diff removals and command-emission historical fragment intentionally retain obsolete syntax. Negative type tests, historical beta.14 fixtures, archived v2 and prior review receipts remain unchanged.

## Proposed organization — not implemented

Keep the handbook focused on the API of its stated release. New readers should not need beta history to learn it.

Use the existing Changesets/package changelogs for version-by-version changes. `.changeset/command-context-source.md` already records the breaking rename; do not invent a second release entry or an unpublished version number. Root `CHANGELOG.md` contains stable v2 history, while `packages/ignite-element/CHANGELOG.md` records v3 prereleases.

Offer a secondary **Release notes** entry for beta readers, with a short **Upgrade from the previous beta** subsection when action is required. The command-context before/after diff belongs there. Keep a separate **Upgrade from v2 to v3 (beta)** guide for stable-v2 users opting into the prerelease. Until v3 is stable, do not label it a stable-v3 migration.

Preserve existing `/migration/...` URLs and section links when reorganizing. Historical beta.13 differences remain useful as explicitly versioned history. Detailed instructions can be linked from a changelog when a one-line entry is insufficient.

## Validation

Passed: docs build and agent regeneration (68 routes), snippets (31 compiled blocks; one existing fragment and seven explicit exclusions unchanged), handbook checks (five tests, 23 legacy mappings), 3,151 internal links/fragments, built version routing, publication contract (297 tests), and formatting/Markdown lint. Inspected the current agent export for the corrected MobX explanation, removal of the stale Getting started claim and explicit beta.13 history. HTTP verification confirmed the local preview serves the revised beta note.

An initial publication test required the phrase “published beta.14” in the headless reference. Preserved that accurate runtime-baseline description alongside the new unreleased-syntax qualification; all 297 tests then passed unchanged. No assertion was weakened.

No runtime or example source changed; previous strict packed-consumer results remain applicable to those unchanged modules. No new tests were added for prose-only corrections. No new browser interaction or responsive matrix is claimed; shared presentation and behavior are unchanged.

Focused checks took seconds each; both docs builds took about five seconds. The second build refreshed exports after the final wording correction. No installs, downloads or package packing were needed. Existing ignored site build output was regenerated and retained for the authorized local preview. Logs remain with the existing local evidence receipt; no new dependencies, release artifacts or archives were created.

## Checkpoints and release boundary

Getting started awaits re-review. Sources awaits review. Views is queued. No page acceptance is inferred from this audit.

Supporting package publication and actual-version install text remain separate authorized release work. The preview notice is not evidence of a published package. Deployment remains gated; nothing was pushed, merged, published or deployed.
