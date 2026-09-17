# Getting started — independent toggle machine

Status: awaiting review. Date: 2026-09-16. Getting started remains unapproved; Sources remains queued. The Operator explicitly approved keeping `core` and replacing the introductory shared actor with a separate `toggleMachine` that gives each element independent state.

Starting commit: `fa16a512c085de23963aba0c64366be949dda98b`; tree: `3e9c93fd71687275f9b7a19ae35453665c1a1395`. Clean starting worktree on `fas/docs-page-refinement`. The candidate is the local commit containing this receipt; the handoff supplies its exact commit and tree. No publication or deployment.

## Changes

- A10: the canonical checked module defines `toggleMachine` and passes it directly as `source`. It retains `core`, inline inferred states/commands, and the `ctx` view. It no longer constructs or exports a borrowed actor.
- This is an explicit example ownership choice using the existing API: each connected element gets an Ignite-created private actor. Library ownership semantics are unchanged. The page explains independent state and keeps the terminal core-disposal link; it does not teach application-owned source shutdown for a machine definition.
- Root and facade README copies and their immediately adjacent ownership text match the same canonical module. Their broader reviews remain queued. The generated current agent export contains the updated module and explanation.
- The runtime test mounts two elements, clicks both independently and checks their rendered state. It removes both views and disposes the core at test-owner teardown. A headless state read is no longer used to assert an isolated element's state.
- No runtime, public API, framework examples, theme, dependency, lockfile, governing-file or archived-source changes.

## Validation

Repository checks used Node 22.16.0 and pnpm 10.33.0. The unchanged root lockfile SHA-256 is `af89205aefb83cebc12e1c31cceeaef878b9251c27a71fe994a35942248f7455`. Package source, declarations and exports are unchanged from the starting candidate.

- Focused red: the two-element test against the previous shared-actor fixture failed because the untouched sibling was On after clicking the first element. Focused green: the same independence assertions pass with the machine source.
- Strict packed web/native consumers pass: four web tests, two native tests, public TypeScript declarations with `skipLibCheck: false`, actual MobX README and native dependency isolation. Existing unchanged package build artifacts were reused; fresh task-local consumer directories were created with cached dependencies.
- Published `ignite-element@3.0.0-beta.14`: the retained standalone consumer passes strict TypeScript and Vite production build. Two elements in the built browser demo produce Off/Off → On/Off → Off/Off → Off/On. No package install was needed in this consumer.
- The old development server served cached pre-change TSX despite the file update. This was identified by inspecting its module response. Published-package behavior was verified using the newly built output on a separate preview port, not counted from that stale server.
- Site build: 67 pages and regenerated agent exports; inspection confirms the machine source and private-actor wording. Publication checks: 283 tests and contract pass. Handbook: five tests, README equality, 67 routes and 23 mappings pass. Links: 2772 internal references pass. Secondary snippets: 31 complete blocks pass, one intentional fragment. Astro: zero errors/warnings, one existing hint.
- Browser regression checks: 50 page/theme/viewport cases, 58 contrast samples, 12 native control geometry checks, keyboard/navigation interactions and exact displayed TSX clipboard comparison pass. Desktop and mobile screenshots are retained as local review evidence. Shared theme files are unchanged.
- Formatting, architecture and normal commit-hook lint pass. Unrelated full package/example suites were not repeated; their earlier results remain historical evidence, while the changed runnable fixture was validated directly.

## Custody and review

Docs build output, packed consumers, logs and screenshots remain task-local review evidence outside tracked source. Pre-existing dependencies and package outputs were preserved. The sandbox prevented the browser regression runner from launching Chromium; the same checks passed with the authorized execution escalation. No assertions were weakened. These extra checks established the newly selected instance ownership and supported-release behavior.

Getting started preview: <http://127.0.0.1:4323/ignite-element/#build-a-component>. Published-package two-element demo: <http://127.0.0.1:4325/>. Review the same first page before advancing to Sources. Remaining page/example findings and device/screen-reader limits remain in the [ledger](ledger.md).
