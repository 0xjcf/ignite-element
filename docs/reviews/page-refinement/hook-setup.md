# Shared and isolated hook setup

## Scope and identity

Clarify the Operator-identified preparation ambiguity without changing runtime,
API, source examples or page acceptance.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `0b00c947f2445a8521c7c8dec69316b7114af3b1`.
- Starting tree: `762cded9d9b3f4bf5bcbbf98fd6de70d667b22cc`.
- Starting state: clean.

## Contradiction and correction

Ownership ended its general setup section with a preparation-read instruction
that could be read as applying to every core. The implementation explicitly
prepares shared-source cores during construction in
`createIgniteComponentFactory.ts`; `useIgnite` only borrows a prepared binding.
The hook tests verify rejection of an unprepared isolated core and multiple hooks
sharing a prepared isolated core.

Ownership now says that an existing actor, store or observable needs no preparation
read before `useIgnite(core)`. A separate isolated-headless subsection explains
lazy acquisition outside framework rendering, the preparation read, and the one
headless runtime shared by hooks using that core. It distinguishes this from
per-element isolated sources.

Views, Headless runtime and Compatibility link to the precise exception and scope
preparation language to the relevant input. The ordinary shared React example
remains unchanged and has no preparation read. No new source-construction helper,
cleanup effect, renderer lifecycle or API was introduced.

## Validation and custody

- Nine hook lifecycle tests passed.
- Documentation checks typechecked 27 blocks; one existing fragment and seven
  explicit exclusions remain unchanged.
- All 299 publication-policy tests and eight handbook tests passed.
- The 68-page build and current agent export passed.
- All 3,070 internal references resolved, including the new subsection links.
- Browser inspection confirmed the new section in the local preview.
- Formatting and normal local commit checks passed.

Existing ignored documentation output was refreshed for preview. No installs,
runtime edits, package operations, remote pushes or deployment were performed.
Packed consumer and responsive suites were not repeated for this prose-only change.
Focused tests and builds took seconds; a browser reload was needed to replace the
previous page loaded before the build. No approval interruption was required.

The older parked documentation branch remains unchanged. Getting started awaits
re-review; Sources awaits review; Views remains queued for page acceptance.
