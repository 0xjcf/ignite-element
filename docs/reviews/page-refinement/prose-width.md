# Getting started — native prose width

Status: awaiting review. Date: 2026-09-17. The Operator requested removal of the narrower text width if caused by an override. Getting started remains unapproved; Sources remains queued.

Starting commit: `94c1cf52b9a05fd17f1875a6ffecb665cc61d868`; tree: `1f3c29e957ed1e1ec7556366ec795b560d433b6e`. Clean starting worktree on `fas/docs-page-refinement`. The local commit containing this receipt is the candidate; its exact commit and tree are supplied in the handoff.

## Correction and evidence

The shared theme defined `--docs-prose-width: 72ch` and applied it to paragraphs, lists and blockquotes. This was a project override, absent from the installed Starlight markdown stylesheet. Removed the variable and selector. Prose now uses the available content column, retaining Starlight typography and native disclosure indentation. Existing configured content/sidebar/rail geometry is unchanged.

The previous page-polish receipt's statement that paragraphs retain the narrower reading width is historical and superseded by this correction. Existing semantic paragraphs remain; no viewport-specific hard line breaks were introduced. Runtime, example source, dependencies, lockfile, archived page sources and governing files are unchanged.

## Validation and custody

- Documentation build passed: 67 pages plus ZIP and agent exports, approximately four seconds.
- Browser checks passed: 50 page/theme/viewport cases across 1280, 1440, 1920, 768 and 390px; all 64 contrast checks and 14 native controls; expanded code alignment, local scrolling, navigation and live-example interaction checks.
- Reloaded the user-facing preview and inspected rendered prose. Computed paragraph max-width is now none, with paragraph and content widths both 601px in the current pane. Reviewed light desktop and dark mobile screenshots; existing paragraph boundaries remain readable.
- Formatting, diff whitespace and normal commit-hook checks passed. No new implementation test is needed for removal of a CSS width cap. Prior unchanged example, type-consumer and documentation-content validation remains recorded in preceding receipts; no fresh install or unrelated runtime suite is claimed.

No installs or downloads were required. Existing generated output is retained for the authorized local preview; logs and screenshots remain task-local evidence. Chromium and Git use their ordinary authorized local execution escalation. No push, PR, merge, deployment or release. Preview: <http://127.0.0.1:4323/ignite-element/>. Await Operator review before moving to Sources.
