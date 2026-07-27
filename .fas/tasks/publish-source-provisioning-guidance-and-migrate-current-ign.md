# Publish source-provisioning guidance and migrate current Ignite documentation

## Source

Created with `fas create-task` on 2026-07-24.

## Problem
Publish the final source-only idiom after callback, routing, cross-adapter, exact-source conformance, and retained ref and commit evidence exists. Make the normative source-provisioning document discoverable; update current v3 architecture, mental-model, igniteCore API, headless, routing, Redux and MobX, Actor-Web, testing, and migration pages; replace examples that teach host access or environmental work in effects; teach capability ports bound through each source library native construction and lifecycle, then pass the exact resulting source directly to igniteCore. Distinguish source-owned environmental I/O and cleanup from renderer-retained presentation, semantic projections, outward facts, and igniteShell lifecycle. Do not modify the frozen 2.x archive or duplicate the separate complex-interface guide.


## Acceptance criteria
- Current v3 docs teach one flow: define deterministic behavior and capability ports, select adapters, bind them through native source composition, obtain the exact native source, pass it directly to igniteCore, project views, and send intent through commands.
- Routing, Redux, MobX, Actor-Web, Node or headless, and deterministic fake examples use verified native source construction and lifecycle syntax without createFeature, Feature, feature.source, or a generic disposal abstraction.
- Every example names the source owner, environmental lifecycle owner, Ignite observation owner, and any application shutdown responsibility without forcing false uniformity across ecosystems.
- All current guidance showing host in commands, host mutation in effects, History writes in effects, or environment injection through Ignite is removed or migrated.
- The guide links retained ref and commit authoring without duplicating the complex-interface guide or claiming Ignite owns drawing, layout, scheduling, transport, domain truth, or source disposal.
- ref guidance owns node-bound resource acquisition and cleanup; commit guidance synchronizes current projection data; both remain independent from exact source creation and lifetime.
- igniteShell remains a narrow sourceless lifecycle helper and is not presented as source provisioning or environment injection.
- Migration guidance covers callback cutover, exact native sources, shared versus isolated ownership, and the rejected createFeature proposal where historical clarification is useful.
- Docs build, markdown lint, code-example checks, example lanes, exports, architecture checks, links, and navigation pass while frozen 2.x docs remain untouched.
- TDD and DDD guardrails remain satisfied and the task remains tracked in the live queue.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Make `docs/source-native-provisioning.md` the single normative explanation of
  capability ports, source-library-native binding, exact source identity,
  native lifecycle ownership, and Ignite projection; link to it from the
  current v3 mental model, `igniteCore`, headless, routing, Redux, MobX,
  Actor-Web, testing, migration, and package README surfaces.
- Use only shipped, typechecked examples from the completed callback, routing,
  cross-adapter, conformance, and retained `ref` or `commit` tasks. Each example
  names the source owner, environment owner, Ignite observation owner, native
  shutdown owner, and retained presentation owner where applicable.
- Teach Canvas and Cytoscape through the retained presentation seam and link to the dedicated complex-interface guide; keep source environment I/O, semantic projection, drawing, layout, and scheduling as distinct responsibilities.
- Add a beta migration table for commands, effects, shared sources, isolated
  sources, exact source-native provisioning, the rejected wrapper proposal, and
  retained resources, then verify current docs navigation and internal links
  without editing the frozen 2.x tree.

## Alternatives considered

- Repeat the complete architecture decision on every API and guide page: rejected because duplicated normative prose will drift; secondary pages should summarize their local role and link to the canonical decision.
- Update frozen 2.x pages for consistency: rejected because they document a historical contract and are explicitly outside the v3 migration scope.
- Publish ref, commit, callback, or lifecycle syntax before its implementation dependency lands: rejected because documentation must describe verified shipped surfaces, not accepted proposals.
- Fold retained-interface authoring into this guide: rejected because the dedicated complex-interface task owns detailed Canvas and Cytoscape lifecycle guidance.

## Affected files

- docs/source-native-provisioning.md
- docs/ignite-shell.md
- README.md
- packages/ignite-element/README.md
- packages/ignite-core/README.md
- packages/ignite-adapters/README.md
- docs/site/src/content/docs/concepts/the-ignite-model.mdx
- docs/site/src/content/docs/api/ignite-core.mdx
- docs/site/src/content/docs/api/headless-runtime.mdx
- docs/site/src/content/docs/guides/routing.mdx
- docs/site/src/content/docs/guides/redux-and-mobx.mdx
- docs/site/src/content/docs/guides/testing.mdx
- docs/site/src/content/docs/migration/v3.mdx

## Scope Amendments

- Added `docs/ignite-shell.md` after architecture and SRE review confirmed that
  its pre-implementation status header is stale relative to the shipped export.
  The downstream docs sweep owns this maturity correction so the accepted
  four-file architecture decision remains scope-clean.

## Implementation plan
- Audit current v3 pages, package READMEs, examples, and navigation for callback escape hatches, History-in-effect, wrapper-first language, createFeature, feature.source, generic disposal, source ownership, headless, retained-resource, and igniteShell drift.
- Make docs/source-native-provisioning.md the normative exact-source explanation and migrate each current page to concise ecosystem-native provisioning and lifecycle guidance using shipped examples.
- Add the migration and source-versus-retained-presentation matrix, cross-link the dedicated complex-interface guide, verify navigation and internal links, and leave the frozen 2.x archive untouched.

## Verification plan
- Run markdown lint, docs code-example checks, docs build, link checks, and current docs navigation validation.
- Run affected examples, builds, package exports, architecture checks, and retained-interface contract checks so every documented API and ownership claim is shipped.
- Run fas validate-task and full verification, then independently review source identity, lifecycle ownership, current-versus-target language, and cross-epic consistency.

## Risks
- Documentation could race ahead of ref or commit implementation or the callback cutover.
- Examples could erase important native lifecycle differences in pursuit of one visual shape.
- Duplicating the complex-interface guide would create two authorities for Canvas and Cytoscape lifecycle.
- The broad docs sweep could accidentally modify frozen 2.x content.

## Dependencies
- Depends on task-1784909335843 exact-source conformance and task-1783719649309 retained ref and commit implementation.
- Blocks stable-main merge task-1781292613064.
- Does not replace retained-interface documentation task-1783719740973; it links to that owner and documents only the source-versus-presentation boundary.
- Cancelled task-1784914562979 is historical and no longer blocks publication.

## Open questions
- None. Unresolved ecosystem lifecycle or retained syntax facts must return to their implementation or conformance owner rather than being invented in prose.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
