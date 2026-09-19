# Local documentation release-set reconciliation

Status: **IGNITE_LOCAL_DOCS_RELEASE_RECONCILIATION_READY_FOR_REVIEW**.

Recommendation: ship this documentation set with the supporting next beta after Navigator acceptance and public package verification. No unresolved documentation correctness blocker was found in the proposed set. This is an unpublished local candidate, not current public-beta documentation or completed editorial acceptance.

## Candidate and selection

- Accepted implementation: `4e1441ead1f91d4f6de60ab0f4187bcee59c9a21`, tree `be1293c5d8b248a9310d3da99ee1132cceb137da`.
- Parked refinement: `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc` on `fas/docs-page-refinement`.
- Parked source reconciliation: `d46c0cd9a514b645e72c3ba3dc65d2f9d9636ad1` on `fas/docs-getting-started-source`; the refinement commit is its ancestor.
- Existing reconciliation merge: `ae22191aa9a739a8573860b7778393d19fbd41da`, followed by page checkpoint `b6f30961f0a4176517c299d02b910ea8a84bb63f` (tree `755616e89e0cebb7eca4aec3db0b462797e6804d`).
- This isolated successor: `task/docs-release-reconciliation`, based on that exact checkpoint. Final commit/tree and content hashes are recorded outside the commit to avoid self-reference.

The earlier five prose conflicts preserved editorial structure while adopting merged lifecycle contracts. No competing parked branch remains to combine: their history is linear. Select the existing eight-page structure, shared presentation, canonical light-switch download, React demos, source examples, retained support routes and redirects. Historical review receipts remain evidence, not learner-facing instructions. No parked tracked refinement was silently discarded. Excluded from deployment are review receipts, undeployed historical design documents, generated dependencies and unimplemented editorial proposals. Frozen `2.x/**` sources remain unchanged from beta.

Package source, package manifests, native fixture and workflow files match accepted beta. Package README and example changes are documentation scope. The inherited lockfile delta is limited to documentation demo dependencies (workspace Ignite, React/React DOM and types, fflate); this correction does not alter that lockfile. Fresh consumers were installed rather than claiming dependency-graph identity with beta.

## Proposed documentation set

All eight handbook destinations are included: Getting started, Sources, Views, Events & effects, Ownership & cleanup, Testing, API reference and Examples. The built set has 69 HTML routes, including retained versioned destinations and 29 legacy mappings. Current API references, migration pages and directly linked accessibility, agent-runtime and shared-source guides are included. Canonical source modules, the downloadable light-switch ZIP, relevant root/package/example README content and generated agent exports are included.

The external receipt contains the complete path/status diff against accepted beta, correction-only diff, source inventory and static-output hash manifest. It distinguishes deployed content, supporting source/fixtures and historical review records. Those exact manifests define the proposed set rather than implying every historical file is deployable content.

## Required corrections

| Classification | Correction and evidence | Disposition |
| --- | --- | --- |
| blocking_public_contract | Removed superseded preview banner/prose and inverted narrowly coupled guards; retained beta/version assertions and manual deployment gate. | Resolved; publication tests pass. |
| blocking_public_contract | Headless reference no longer requires preparation or equates private hook state with the separate explicit headless runtime. Ownership, Sources, API and migration summaries agree. | Resolved; packed strict consumers and native tests pass. |
| blocking_public_contract | Accessibility example read nonexistent command descriptions and nullable catalogue entries; focused red produced TS18047/TS2339. Descriptions now come from the explicit application tool schema. | Resolved; exact copied modules typecheck and execute. |
| blocking_correctness | Thermostat external updates previously implied a shared view while using an independent machine. It now explicitly uses an owner-started shared actor; native source ownership remains external. | Resolved; packed test proves headless updates reach the view and view removal does not stop the actor. |
| blocking_public_contract | Agent guide had an undefined machine, incorrect INCREMENT event and nonexistent tool command. It now imports the canonical machine, uses ADD, declares event parameters and distinguishes independent headless/element state. | Resolved; strict modules and runtime assertions pass. |
| blocking_public_contract | Historical v1-to-v2 page contained v3 cleanup advice and a nonexistent configuration import. Historical cleanup semantics and the actual v2 root import are restored. | Resolved; strict isolated public 2.2.2 consumer with required v2 peers passes. |
| blocking_correctness | Headless/JSX guide prerequisites were undefined or implicitly typed; small fragments now declare prerequisites. Smart-home screencast link pointed to Views. | Resolved; strict consumers and relative link inspection pass. |

Current source construction guidance includes factories, initializers, middleware and enhancers: repeat/discard safety applies to construction, with business work through the source lifecycle or commands. Existing instances stay shared; definitions/fresh factories create independent state. No public API or runtime implementation was changed.

## Fresh validation

Node 22.16.0, pnpm 10.33.0, TypeScript 5.9.3; fresh frozen workspace installation and separate consumer installations.

| Validation | Result |
| --- | --- |
| Four-package build and exports | Passed. |
| Example typechecks and runtime groups | 13 example roots typechecked; all 10 runtime groups passed. |
| Packed web consumer | Strict declarations with `skipLibCheck: false`; 11 tests across 7 files passed. Includes corrected guide modules and source isolation. |
| Packed documentation native consumer | Strict DOM-free types, dependency isolation and 5 native-host tests passed. |
| Standalone native fixture | Isolated install, frozen reinstall, dependency isolation, strict typecheck and 5 tests passed. |
| Canonical light-switch project | Exact candidate tarballs, strict typecheck and Vite build passed. |
| Published controls | Separate registry beta.14 consumer passed strict types and 1 test; historical v2.2.2 config passed strict types with its required peers. |
| Documentation snippet accounting | 50 current files scanned, 33 blocks discovered, 2 explicitly excluded, 31 eligible (30 checked plus 1 declared fragment); historical v2 is checked against v2 separately. |
| Publication/routing and handbook suites | 302 publication/routing tests and 8 handbook tests passed. |
| Astro and build | 0 errors, 0 warnings; 69 routes built. |
| Links, anchors, version routing and exports | 3,116 internal references passed; 29 legacy mappings and both version directions passed; canonical ZIP and agent export match source. No claim of live external-link crawling. |
| Browser presentation | 60 layout cases, 64 AA contrast checks and 13 native control geometry checks passed. Desktop 1440px/mobile 390px, light/dark captures visually inspected. |
| Browser interactions | Light-switch click/Space, shared counter propagation and custom-element event forwarding checked in the retained preview. Harness also checks exact clipboard, selectors, keyboard, menus and table/code scrolling. |

React DOM Activity evidence remains bounded to 19.2.7. Native checks use React 19.1.0/RN 0.81.5 and do not establish native Activity, device or simulator acceptance. Compatibility retains the insertion-effect bookkeeping dependency and native test-renderer ordering distinction. No SSR or other framework-hook guarantee is added.

The accepted 838 package/148 script tests and protected CI are previous implementation evidence, not fresh final-release checks. Final release inputs still require hosted CI and payload verification. Twelve unchanged baseline import-order errors remain disclosed; full-repository formatting is not claimed universally green. Changed files use normal formatting and normal local commit hooks.

## Candidate inputs and preview

The local tarballs still carry pre-preparation `3.0.0-beta.14` metadata, but contain accepted post-beta.14 implementation bytes. They are explicitly candidate packages, not registry beta.14 artifacts. The external provenance receipt records all four SHA-256 hashes, exact paths, isolated resolutions and consumer lockfile hashes. The published beta.14 and v2 lanes use independent installations without candidate overrides.

Preview: `http://127.0.0.1:4347/ignite-element/`. Its static build and screenshots are retained in the external `ignite-docs-release-review-20260919` packet. The old preview/evidence remains intact. Installation commands and ZIP use `@beta`; that tag still resolves beta.14 today. This set must not deploy until the supporting release is public and those commands/downloads are verified against the actual version.

## Remaining gates and editorial work

Getting started awaits re-review; Sources awaits review; Views is queued. Events, Ownership, Testing, API, Examples and supporting destinations retain their ledger statuses. Compatibility review does not accept those editorial pages.

Remaining `workflow_improvement` work includes shorter Views wrappers, clearer imperative-ref context, prose wrapping, shared divider/select polish and table spacing. Historical effects-label and undefined-prerequisite findings are corrected or explicitly isolated in historical/fragment context; the broader audit remains queued. These do not currently reproduce a release-blocking failure.

Registry preflight reports beta.14 on all four beta tags, scoped latest beta.14 and facade latest 2.2.2. No next version was guessed and no changeset consumed. Authenticated npm-stage inventory returned E401: inventory is unknown, not empty. Npm reauthentication is required before future staging; it does not block review of this documentation set. No package publication, push, integration or deployment occurred. Manual deployment protections are unchanged.

After release-set acceptance, continue the already authorized protected integration and release preparation. Stop again after verifying the four actual stages for independent exact-packet acceptance. Public package verification must precede manual documentation deployment.

## Custody and workflow cost

Original and parked checkouts remain unchanged. Only this isolated candidate is edited. Review logs preserve the focused red, intermediate fixture errors and final green results. Failed checks led to corrected declarations, accurate historical peer installation or test assertions; no runtime behavior or gate was weakened. Dependency/build output created for this checkpoint is disposable; retain only the named evidence packet, consumer inputs/tarballs and static preview at handoff. Normal hooks run before commit; no hosted CI is claimed for an unpublished branch.
