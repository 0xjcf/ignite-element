# Source-free core implementation — candidate review receipt

## Disposition and identity

Implementation and applicable validation are complete for independent Navigator
review. This is an unpublished candidate, not integration, release, acceptance
or lifecycle closeout. The final external receipt records the one normal-hook
commit, tree and parent without making this tracked receipt self-referential.

- Repository: 0xjcf/ignite-element; authenticated repository ID 891835422.
- Branch: task/v3-source-free-core-no-lifecycle, retained independent clone.
- Base: 0ef049dba0aecf354beba0fc39a38daa4d3098dc.
- Base tree: d7200345c47535bc410a7c78eb512c7a5308247b.
- Root AGENTS blob: b42df43220a453b6eb92bfb70f22350de7bebe72.
- Authenticated v5 SHA-256:
  3149b452d47b4aab62183b71d3e400cb260ed88b1b2939d8f5f2f16fb134649a.

Original archives and patches remain immutable. The successor contains the
full patch, changed-path hashes, exact lockfile delta, resolution evidence,
command results and preserved stop evidence. Earlier stop receipts are historical.

## Contract and declaration correction

The root source-free igniteCore accepts omitted configuration, undefined and an
empty plain object. It rejects meaningful options, symbol/non-enumerable keys,
non-plain objects, invalid shapes and extra arguments without invoking getters.
Its result is only a registrar, not a runtime with execution/state/disposal APIs.
Use named construction: const core = igniteCore(); then register a zero-argument
JSX renderer. Source-backed constructors remain at their adapter entrypoints.

Existing JSX mounts once per successful instance, retaining DOM across moves and
true disconnect/reconnect. Fragments, slots, styles and events use the existing
renderer. Failed mounts are reported and retry on later connection; duplicate
registration is a no-op and native name validation remains in effect.

igniteShell and its four shell-specific public types are removed without aliases.
No onConnect, replacement hook, dummy source, new runtime or required peer was
introduced. Shared source-backed lifecycle and renderer internals are unchanged.

The original strict peer-free packed consumer failed through the declarations
of testing.ts and types/agent.ts importing four neutral types via RenderArgs.
Baseline provenance and red evidence remain in the original stop archive:

3c9e32d00c6b49e7bd56d66983358f8af1a7402a69693b5401fe804c90a35763

Only the two type-import module specifiers now reference @ignite-element/core.
EmptyEventMap, EventMap, EventMember and FacadeCommandResult retain their names,
definitions and constraints. RenderArgs is unchanged. Emitted testing.d.ts and
types/agent.d.ts now point to core; the root declaration graph excludes adapter
and unselected ecosystem dependencies. Strict root consumers preserve event,
command, testing and agent/runtime types. Adapter consumers retain positive and
negative snapshot, states, command-input and event inference, skipLibCheck:false.

## Migration and documentation

Root/package READMEs and shell, source-free, provisioning and consistency docs
distinguish this candidate from released beta.11. They describe removal of
onConnect/returned teardown and IgniteShellConfig, IgniteShellHost,
IgniteShellRegistrar and IgniteShellTeardown. Lifecycle consumers need an
application-owned presentation boundary or existing custom element to acquire
resources, read initial state, deliver updates, release resources safely and
reconstruct on reconnect. Subscription alone is not initial rendering.
Observation cleanup is not source shutdown; effects do not own retained resources.
External adoption is unknown. The major facade changeset remains unconsumed.

The authorized three docs pages retain meaningful testing-DSL/story coverage,
real Actor-Web topology and behavior construction, and actual routing modules
and request shapes. Source -> states -> renderer view remains canonical. Original
fourteen diagnostics and three exact paths are preserved in v3/v4 evidence.
No checked marker or assertion was removed to obtain a pass.

## Documentation dependencies and enforcement

The two remaining errors were testing-dsl.mdx:126 TS2353 (event count lost to
any) and actor-web.mdx:110 TS2339 (context collapsed to object). Generated snippets
could resolve neither Toolkit nor Actor-Web. V5 actual-checker controls proved
the cause and the incompatibility of 0.2.0's factory-returning topology source
with the documented direct-source call.

Docs devDependencies now pin Toolkit 2.12.0 and Actor-Web 0.2.1. The Actor-Web
guide explicitly requires 0.2.1 for that direct topology-source example, not all
adapter compatibility. Existing adapter validation still resolves 0.2.0;
the unchanged packed adapter lanes explicitly pin 0.2.0 too.

Only the docs importer and new Actor-Web 0.2.1 package/snapshot entries changed
in the root lockfile. All old package versions, integrities, snapshots and
non-docs importers are unchanged. No additional peer-context snapshot was needed:
Toolkit reuses its existing React 19.2.7 context. Actor-Web 0.2.1 accepts and
resolves existing msgpack 3.1.3, uuid 11.1.1, ws 8.18.3 and exact XState 5.30.0.
No standalone-example transitive upgrade was copied. Its integrity matches the
authenticated example lockfile. Pinned normalization and frozen install passed,
reusing one cached package with no downloads.

The checker validates declared documentation imports before diagnostic/baseline
filtering. A declared local installation and real TypeScript package/export
resolution are required. Missing imports/types produce actionable installation
and exported-declaration diagnostics. No custom resolver or version-specific
store path was added. Existing compiler options, application-placeholder handling,
fragments, baselines and other filters remain unchanged; this is not a wholesale
checker strictness migration. Unrelated undeclared example placeholders remain
outside this correction, not newly validated ecosystem contracts.

## Validation and reuse

Pinned tools: Node 22.16.0, pnpm 10.33.0, npm 10.9.2, TypeScript 5.9.3.
Commands use the isolated task environment, task caches, empty npm user/global
config and isolated Git fixture routing.

- Permanent focused red: three type controls passed; both missing-dependency
  assertions failed because the old checker incorrectly returned success.
- Focused green: valid Redux/Actor-Web examples pass; invalid event count and
  context access fail; missing dependencies fail visibly.
- Final script suite: 140 passed, including seven checker regressions covering
  exports and preserved relative application placeholders; no failures/skips.
- Full check:docs: 29 pages, 74 blocks, 66 checked, eight existing fragments,
  zero diagnostics and zero baseline entries.
- Nine strict extracted doc consumers: passed with strict:true,
  skipLibCheck:false, supported built Ignite imports and final workspace
  Toolkit/Actor-Web dependencies. Standalone probes remain diagnostic history.
- Biome: 474 files, no errors, 56 existing warnings and three infos.
- Markdown: 119 files, no errors. Docs build: 46 pages; existing Astro
  deprecation warnings retained.
- Frozen install, lockfile-delta review and installed resolution audit: passed.

Reused after identity verification: production build/declarations/export graph;
four strict packed lanes including peer-free root/JSX; package and browser-fixture
types; 683 package and 420 example tests; two Chromium cases (source-free and
XState); architecture check. Production/public-consumer fixtures and 275 non-lock
validation inputs are unchanged. Root lockfile equality is not claimed:
the exact docs-only delta and unchanged production graph justify scoped reuse.
The current script-suite result supersedes its earlier 133-test evidence.

No required gate is waived. Final Markdown/diff checks and normal pre-commit
lint/commit-msg results are attached to the external candidate identity.

## Findings, custody and workflow friction

No known blocking candidate correctness, architecture, public-contract, security
or release finding remains after authorized corrections. Existing warnings,
Astro deprecations and the previously observed inline type-import snippet-parser
limitation remain non_blocking_hardening outside this correction. Future JSX
ref/commit/keyed identity remains accepted but unimplemented work.

Historical primary-ref custody is explicitly unresolved, not an accepted
exception. The primary checkout is not a mutation target. Before/after HEAD,
tree, status, config, index, refs, stashes and worktrees are reported separately
with timestamps. No metadata restoration or initiating-process attribution is
claimed. The independent clone owns the candidate and task environment.

Original archives are preserved. Generated reports, dependencies and caches are
excluded from review archives. Final task-output disposition is recorded in the
external closeout. No integration, push, PR, publication, versioning or FAS
lifecycle transition occurred.

Workflow improvements: early strict consumers exposed the declaration edge;
actual-checker controls distinguished missing visibility from API drift; explicit
package/snapshot authority resolved the final graph boundary. Content-identical
full production profiles were not rerun. Focused scripts/docs checks and a cached
frozen install added relevant assurance. Exact durations, archive size and prior
interruptions remain in command/stop evidence. The implementation-guide and
final-check skills guided pattern reuse, negative coverage and final review
without activating generic FAS/publication work.
