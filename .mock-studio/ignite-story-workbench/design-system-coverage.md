# Ignite Alchemy Design System Coverage

Status: narrative-ready token coverage recorded; Round 3 candidates published
and awaiting root browser validation
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Token direction

The design system direction for Round 3 stays anchored to the corrected product
contract:

- operator-shell tokens serve `ALCH-NAR-*` review flow, not a substitute
  application domain;
- preview and receipt tokens preserve literal `STORY-*` fixture truth; and
- additive evidence tokens stay latent until the reviewer explicitly asks for
  them.

Shared token contract carried into both published candidates:

- neutral developer-tool chrome with restrained copper active/status cues;
- compact radii in the `8px` to `14px` range;
- sans typography for shell copy and monospace only for IDs and evidence;
- dominant preview surfaces with compact supporting cards; and
- reduced-motion-safe CSS fallbacks.

## Foundations and disposition

| Need ID | Need | Candidate posture | Accountability | Evidence boundary |
| --- | --- | --- | --- | --- |
| `DS-001` | typography hierarchy for shell and dense fixture truth | published | `ROUND-3A` and `ROUND-3B` revisions published on 2026-07-22 | no live browser readability receipt claimed yet |
| `DS-002` | tokenized surfaces for primary preview and secondary receipt | published | both Round 3 candidates | source-authored and published; browser hierarchy still pending validation |
| `DS-003` | restrained status/accent treatment | published | both Round 3 candidates | source-authored and published; human visual approval pending |
| `DS-004` | compact control rail for Step, Run, Back, Restart, Details | published | both Round 3 candidates | source-authored and published; keyboard/browser verification pending |
| `DS-005` | ordinary receipt-first completion summary | published | both Round 3 candidates | source-authored and published |
| `DS-006` | latent failure, no-lens, and advanced-evidence details | published | both Round 3 candidates | source-authored and published; drawer behavior awaiting browser validation |
| `DS-007` | current-step strip for one-page narrative release | published | both Round 3 candidates | source-authored and published |
| `DS-008` | no-lens wording confined to Machine details | published | both Round 3 candidates | source-authored and published |
| `DS-009` | responsive adaptation for 1440 and 1280 widths | published | `ROUND-3A` at `1440x900`, `ROUND-3B` at `1280x900` authoring sizes | no live responsive receipt claimed yet |
| `DS-010` | reduced-motion contract | published | both Round 3 candidates | CSS media rule authored; no live reduced-motion browser receipt claimed |

## Candidate-to-experience mapping

| Experience item | `ROUND-3A` Canvas Runner | `ROUND-3B` Focus Runner | Status |
| --- | --- | --- | --- |
| `EXP-002` Story catalog / picker | compact persistent rail | toolbar picker panel | published; awaiting browser validation |
| `EXP-003` page release surface | dominant preview plus current-step strip | dominant preview plus current-step strip | published; awaiting browser validation |
| `EXP-004` receipt / evidence workspace | compact receipt panel plus latent drawer | compact receipt strip plus latent drawer | published; awaiting browser validation |
| `EXP-006` control rail | toolbar action cluster | toolbar action cluster | published; awaiting browser validation |
| `EXP-008` final receipt summary | one-line result footer plus receipt panel | one-line result footer plus receipt strip | published; awaiting browser validation |
| `EXP-009` failure / blocked state | failed checkpoint opens drawer on Debug | failed checkpoint opens drawer on Debug | published; awaiting browser validation |
| `EXP-010` responsive density adaptation | authored for `1440x900` | authored for `1280x900` | published; exact browser receipts pending |

## Accessibility posture

| Concern | Requirement | Status | Evidence boundary |
| --- | --- | --- | --- |
| focus | visible focus on picker and primary controls | authored | no live keyboard receipt claimed yet |
| target size | primary controls remain usable at authored sizes | authored | no measured browser receipt claimed yet |
| non-color cues | failure and evidence posture remain legible without color alone | authored | no live browser receipt claimed yet |
| reduced motion | motion is not required to understand state | authored | CSS contract only in this turn |
| terminology | literal Story, page, receipt, and evidence labels stay readable | authored | human visual approval pending |

## Readiness summary

The design-system work for this task is published at the candidate level, not
accepted at the browser-validated level. The current gate is:

- narrative contract: passed;
- source authoring and MagicPath publish: passed for `ROUND-3A` and
  `ROUND-3B`;
- root browser validation: pending; and
- human visual selection: pending.
