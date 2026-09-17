# Code-block consistency

## Scope and identity

The Operator requested reviewing current code blocks for unnecessary complexity
and matching the simpler Getting started style.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `514e6571f1acb1cffcd298a3db6eb39a392ba298`.
- Starting tree: `118e3b999b79ef5c87748d1bd6f2bad076cd7da2`.
- Starting state: clean.

## Corrections

The React module embedded in Views now defines `counterMachine` before starting
its actor on a separate line. Its `LABEL` handler directly reads `event.value`;
TypeScript already narrows that transition's event. The event union still checks
payload types. Count, label, commands, shared ownership and exports are preserved.

The source test embedded in Testing and the shared-source shutdown example now
also name the machine separately from actor creation. Existing cleanup remains
intact. No helper abstraction or new API was introduced.

The audit covered 48 current MDX pages and their 18 imported raw code files.
No nested `createActor(createMachine(...))` remains in that set. Other displayed
examples already name their machines or pass definitions/factories directly to
Ignite for per-element state. Advanced shared-session guards narrow events in
reusable actions and protect request correlation; they remain necessary.
Historical v2 content, the historical beta.14 fixture and the unused old toggle
fixture are outside the displayed current-example correction.

## Validation

- Strict packed web compilation and all seven behavior tests passed, including
  count changes, label edits, remounts and source cleanup through the actual React
  module. The modified source test passed in the same lane.
- Strict React Native consumer compilation and both existing native tests passed.
- The canonical standalone light-switch project compiled and built successfully.
- The separate historical beta.14 consumer passed unchanged.
- Documentation snippets: 25 typechecked blocks passed; existing fragment and
  explicit exclusions are unchanged.
- Documentation build and agent export: passed for 68 pages. The current export
  contains the named counter machine and no redundant label fallback.
- Internal links: 3,025 references passed. Handbook: seven tests and all legacy
  mappings passed. Publication policy: 299 tests and contract checks passed.
- Formatting, Markdown and whitespace checks passed.

## Custody and limits

Package runtime, dependencies, lockfiles, workflows and archive content are
unchanged. Existing package builds were packed into temporary consumers; fresh
consumer dependencies and provenance remain in task-local temporary storage.
Documentation build output was refreshed for preview. Consumer checks completed
in under a minute; no new browser or responsive-layout acceptance is claimed.

No push, package release or documentation deployment occurred. The parked
editorial branch remains untouched. Getting started awaits re-review, Sources
awaits review, and Views remains queued.
