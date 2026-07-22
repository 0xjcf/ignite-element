# Ignite Alchemy Design System Coverage

Status: narrative-ready token coverage recorded; corrected Round 3 candidates
published; Focus Runner Variant 2 is the human-preferred leading donor pending
browser validation
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Token direction

The design system direction for the corrected Round 3 pass stays anchored to
the same product contract:

- operator-shell tokens serve `ALCH-NAR-*` review flow, not a substitute
  application domain;
- preview tokens now prioritize a recognizable Voice Workbench application
  surface over metadata cards;
- receipt tokens remain absent until the narrative reaches page 7; and
- additive evidence tokens stay latent until the reviewer explicitly asks for
  them.

Shared token contract carried into both corrected candidates:

- neutral developer-tool chrome with restrained copper active/status cues;
- modest radii in the `6px` to `10px` range;
- sans typography for shell copy and monospace only for IDs and evidence;
- one dominant application surface rather than a card mosaic; and
- reduced-motion-safe CSS fallbacks.

## Foundations and disposition

| Need ID | Need | Candidate posture | Accountability | Evidence boundary |
| --- | --- | --- | --- | --- |
| `DS-001` | typography hierarchy for shell and dense fixture truth | corrected published | `ROUND-3A` revision `430502451452473344` and `ROUND-3B` revision `430502451368595456` published on 2026-07-22 | no live browser readability receipt claimed yet |
| `DS-002` | recognizable Voice Workbench preview as the primary surface | corrected published | both corrected Round 3 candidates | source-authored and published; browser hierarchy still pending validation |
| `DS-003` | restrained status/accent treatment | corrected published | both corrected Round 3 candidates | source-authored and published; human visual approval pending |
| `DS-004` | compact control rail for Step, Run, Back, Restart, Details | corrected published | both corrected Round 3 candidates | source-authored and published; keyboard/browser verification pending |
| `DS-005` | receipt exposure only at page 7 with compact summary on the main surface | corrected published | both corrected Round 3 candidates | source-authored and published |
| `DS-006` | latent failure, no-lens, and advanced-evidence details | corrected published | both corrected Round 3 candidates | source-authored and published; drawer behavior awaiting browser validation |
| `DS-007` | single-line current-step strip for one-page narrative release | corrected published | both corrected Round 3 candidates | source-authored and published |
| `DS-008` | no-lens wording confined to Machine details | corrected published | both corrected Round 3 candidates | source-authored and published |
| `DS-009` | responsive adaptation for 1440 and 1280 widths | corrected published | `ROUND-3A` at `1440x900`, `ROUND-3B` at `1280x900` authoring sizes | no live responsive receipt claimed yet |
| `DS-010` | reduced-motion contract | corrected published | both corrected Round 3 candidates | CSS media rule authored; no live reduced-motion browser receipt claimed |

## Candidate-to-experience mapping

| Experience item | `ROUND-3A` Canvas Runner | `ROUND-3B` Focus Runner | Status |
| --- | --- | --- | --- |
| `EXP-002` Story catalog / picker | compact persistent rail with ID, title, and status only | compact toolbar picker panel | corrected and awaiting browser validation |
| `EXP-003` page release surface | dominant Voice Workbench preview plus one-line current-step strip | dominant centered Voice Workbench preview plus one-line current-step strip | corrected and awaiting browser validation |
| `EXP-004` receipt / evidence workspace | no permanent receipt column; latent drawer only | no permanent receipt column; latent drawer only | corrected and awaiting browser validation |
| `EXP-006` control rail | compact toolbar action cluster | compact toolbar action cluster | corrected and awaiting browser validation |
| `EXP-008` final receipt summary | compact passed result only at page 7 | compact passed result only at page 7 | corrected and awaiting browser validation |
| `EXP-009` failure / blocked state | failed checkpoint opens drawer on Debug | failed checkpoint opens drawer on Debug | corrected and awaiting browser validation |
| `EXP-010` responsive density adaptation | authored for `1440x900` | authored for `1280x900` | corrected and exact browser receipts still pending |

Human preference note:

- root relayed human feedback that `dreamily-sand-6842` / Focus Runner
  (Variant 2) matches the corrected progressive Voice Workbench contract and is
  the preferred leading donor direction.
- that preference changes prioritization, not acceptance. Browser validation
  and final approval remain pending.

## Accessibility posture

| Concern | Requirement | Status | Evidence boundary |
| --- | --- | --- | --- |
| focus | visible focus on picker and primary controls | authored | no live keyboard receipt claimed yet |
| target size | primary controls remain usable at authored sizes | authored | no measured browser receipt claimed yet |
| non-color cues | failure and evidence posture remain legible without color alone | authored | no live browser receipt claimed yet |
| reduced motion | motion is not required to understand state | authored | CSS contract only in this turn |
| terminology | literal Story, page, receipt, and evidence labels stay readable | authored | human visual approval pending |

## Readiness summary

The design-system work for this task is published at the corrected-candidate
level, not accepted at the browser-validated level. The current gate is:

- narrative contract: passed;
- corrected source authoring and MagicPath publish: passed for `ROUND-3A` and
  `ROUND-3B`;
- preferred leading donor from human feedback: `ROUND-3B-VAR2`;
- root browser validation: pending; and
- human visual selection: pending.
