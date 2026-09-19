# Getting started — whole-page copy and code-block polish

Status: awaiting review. Date: 2026-09-17. The Operator requested an entire-page consistency review of text and code blocks, with an expanded-page screenshot. Getting started remains the current slice; Sources remains queued.

Starting commit: `8ad750c83af617e4631c268a1d1fe8f118609590`; tree: `1dfc13fa1cdf818e13547e28a8f24faf93d88665`. Clean starting worktree on `fas/docs-page-refinement`. The candidate is the local commit containing this receipt; the handoff supplies the exact commit and tree. No publication or deployment.

## Review findings and corrections

- A08: the shared prose-width selector also capped details containers at 72ch. At 1440px, an expanded terminal block ended at 989.625px while the content column ended at 1096px. Removed details from that selector. Native Starlight disclosure indentation remains; expanded code blocks now reach the content column's right edge. Paragraphs retain the established reading width. This removes an override rather than introducing new component styling.
- A10: download/run commands were inline while manual setup commands had terminal blocks. Separated the download path into its own disclosure with a Terminal block. Both run paths now use pnpm exec vite; the unchanged ZIP still also supports its pnpm dev script.
- A08/A10: required files and runtime instructions were interspersed with supplementary options. Added three numbered subheadings: create the component, add the styles, run the example. Renamed disclosures with consistent action labels, kept optional project-wide JSX explicitly optional, and retained complete filename-labelled CSS/HTML/config blocks.
- A01/A08: shortened the opening callback explanation and the post-code description, separated the independent-instance explanation into its own paragraph, removed the repeated flip/count instruction, and replaced the closing scope paragraph with a direct compatibility link. Where-next descriptions now use parallel verbs.
- Checked typography and code-frame conventions across every block. All code uses the existing 14px Expressive Code font. Terminal commands retain native terminal frames; source/config files retain native filename tabs. Both conventions intentionally remain distinct and consistent with Starlight.

The runnable light-switch source, CSS, HTML, ZIP, package dependencies, root lockfile, API, effects/ownership semantics, archived source and governing files are unchanged. The shared disclosure-width correction was checked against representative reference/table, long-code and v2 routes without rewriting their content.

## Validation

- Focused red: the new expanded-frame assertion reproduced the 106.375px right-edge discrepancy on the unmodified built baseline. Focused green: all eight code blocks align with the content right edge, allowing the native left indent, at 1280, 1440, 1920, 768 and 390px in both themes.
- Browser checks pass: 50 page/theme/viewport cases, 64 contrast checks, 14 native documentation controls, live-switch pointer/keyboard behavior, version/navigation/history, local horizontal scrolling and exact TSX clipboard comparison. The added terminal block accounts for the additional copy control. Every disclosure is expanded for alignment/overflow checks.
- Reviewed expanded screenshots of the full page and the installation, demo, stylesheet, run and next-step sections in light/dark desktop/mobile layouts. The user-facing preview retains the revised page for review. Screen-reader/device limits remain as recorded in the preceding receipt.
- Build: 67 pages, ZIP and current/archive agent exports. Handbook: five route tests, canonical README equality, ZIP file equality and exported TSX/CSS equality pass. Publication: 283 tests and contract pass. Links: 2785 internal references resolve. Secondary snippets: 31 complete blocks pass, one intentional fragment. Astro: zero errors/warnings, one existing hint. Formatting, architecture and normal commit-hook lint pass.
- Reused the prior packed and published-package consumer evidence: example bytes, ZIP contents, runtime packages, declarations, exports, dependencies and lockfile are unchanged. This pass reran the actual live demo through the browser checks; it does not claim another fresh installation or unrelated full runtime suite.

## Custody and review

Node 22.16.0 and pnpm 10.33.0 remain the repository toolchain. No installs or downloads were needed. Documentation generation and browser screenshots/logs remain task-local evidence; pre-existing package/dependency output and unrelated worktrees were preserved. A docs build took about four seconds. Browser reruns established focused red/green and then captured the expanded review matrix. Chromium and Git metadata used their normal authorized execution escalation; no assertions were suppressed.

Preview: <http://127.0.0.1:4323/ignite-element/>. Full-page and section screenshots are supplied in the local handoff. The existing renderer boolean-ARIA observation remains recorded separately in the [light-switch receipt](light-switch.md); this pass does not change its disposition. Await Operator review before advancing to Sources.
