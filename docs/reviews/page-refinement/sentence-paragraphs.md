# Getting started — sentence paragraphs

Status: awaiting review. Date: 2026-09-17. The Operator requested that each sentence start on a new line and asked for a research-informed approach. Getting started remains the only content slice; Sources remains queued.

Starting commit: `2026983ccdf6e94de4e9a0e7dbac9f3bbbdcd61e`; tree: `3239cb867fba89b50bdba302ab3a884f58dd17d2`. Clean starting worktree on `fas/docs-page-refinement`. Candidate identity is the local commit containing this receipt and is supplied in the handoff.

## Approach

A08: separated each prose sentence into a native Markdown paragraph, including sentences inside optional disclosures. Split the states/commands explanation into separate sentences. This preserves semantic markup, responsive wrapping and Starlight paragraph spacing without CSS overrides or hard line breaks. Lists, headings, code blocks and executable example sources are unchanged. This intentionally increases vertical space and remains subject to Operator review.

[W3C cognitive accessibility guidance](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p05-succinct-text/) recommends short sentences, short single-topic paragraphs and descriptive headings. [Nielsen Norman Group's web-reading research](https://www.nngroup.com/articles/how-users-read-on-the-web/) supports concise, scannable writing and one idea per paragraph. These sources do not establish a universal benefit from putting every sentence on a separate line. The sentence-per-paragraph treatment implements the Operator's preference for this short instructional page, informed by those broader principles; no measured readability improvement is claimed for this candidate.

## Validation and custody

- Rebuilt all 67 documentation pages and regenerated agent exports and ZIP.
- Handbook route/fragment checks and exact example/download/export comparisons pass; all 2785 internal references resolve.
- Browser checks pass across 50 page/theme/viewport cases, including 390/768/1280/1440/1920px layouts, 64 contrast checks, 14 native controls, code copying, disclosure alignment, local scrolling and live-example interaction.
- Inspected the refreshed in-app preview and light desktop/dark mobile screenshots. Each prose sentence starts a new paragraph and naturally wraps within it.
- Formatting, diff whitespace and normal commit-hook checks pass. Example bytes, dependencies, runtime, CSS and governing files are unchanged; previous strict consumer evidence remains applicable. No new installation or unrelated full runtime suite was required.

Existing generated output is retained for the local preview. Logs and screenshots remain task-local evidence. The build took approximately four seconds; browser checks verified actual wrapping and interactions. No push, PR, merge, deployment or release. Preview: <http://127.0.0.1:4323/ignite-element/>. Await Operator review of Getting started.
