# Sources: keep shared examples in the shared-source guide

The Operator requested removing full shared-source examples from Sources, with
brief alternatives or links where useful.

Starting branch: `fas/docs-getting-started-source`.
Starting commit: `4290d6143d1291238b8cb7b0c935a9d9086c29c3`.
Starting tree: `d4a872526915d48efcc262c2529b415c4d42cf76`.
The worktree was clean.

## Changes

Sources now shows one complete Redux factory module and one complete MobX factory
module. XState continues to link to the Getting started light switch. Each adapter
has a one-line sharing note linking to its section in the shared-source guide.

The shared guide now displays the existing checked `redux.ts` and `mobx.ts` files.
These canonical modules are unchanged. The Testing page links to the new location
of the Redux module imported by its core test. Existing Sources sharing anchors
remain as IDs beside their replacement links.

## Validation and custody

Formatting, documentation snippet checks, site build, agent export regeneration,
internal links and handbook checks passed. The checks cover 25 compiled blocks,
68 routes, 3,018 internal references, seven handbook tests and 29 legacy mappings.
The downloadable light switch and agent export still match the canonical files.
The preview confirms only factory modules remain on Sources, while both shared
modules render in the linked guide.

An initial markdown lint failure required changing the guide's emphasis markers
to the configured underscore style. The rendered emphasis is unchanged.

Existing packed-consumer validation still covers the unmodified canonical modules.
No runtime, dependency, code example, style, archive or workflow changes were made.
No new installs or runtime-suite repetition was needed for this page relocation.
Existing generated site output was refreshed for the local preview; logs remain
in task-local temporary storage. No remote push, release or deployment occurred.

Getting started awaits re-review. Sources awaits review. Views remains queued.
This navigation refinement does not advance any page's acceptance.
