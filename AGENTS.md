# Ignite Element Repository Agreement

Ignite Element is a public OSS TypeScript package family for behavior-first Web
Components, headless projections, source adapters, and renderer integration.

Use the smallest workflow that preserves correctness, architecture, public
contracts, repository custody, and explicit authorization.

## Authority

Consult authority in this order:

1. explicit current Operator instructions;
2. accepted architecture and public contracts;
3. an authorized task brief and approval manifest;
4. current repository evidence;
5. historical roadmaps, task systems, receipts, and memory.

Explicit Operator instructions define authorization and product direction, but
they do not implicitly amend an accepted architecture or public contract.

When a current instruction appears to conflict with accepted architecture or a
public contract, the repo-agent must stop, describe the conflict, and ask
whether the Operator intends to approve an architecture or contract change.
The Operator retains final decision authority, but an amendment must be
explicit.

Lower-precedence evidence must not silently override higher-precedence
authority.

Distinguish:

- **current implementation**: present in current source, declarations, exports,
  and executable evidence;
- **accepted target**: approved architecture that may not be implemented;
- **planned work**: authorized or queued but not accepted as shipped behavior;
- **speculation**: an idea without current authority.

An accepted target must not be described as shipped until implementation and
public-contract evidence support that claim.

Project-local `.fas/**` content is historical evidence while FAS is inactive.
It is not current release, task, lifecycle, dependency, or orchestration
authority. Do not reactivate, repair, reconcile, archive, or delete it without
explicit Operator authorization.

## Roles

### Operator

The Operator owns:

- product direction;
- architecture and public-contract approval;
- task authorization;
- lifecycle decisions;
- integration;
- publication;
- acceptance;
- final tradeoffs.

### Navigator

The Navigator owns:

- pre-implementation architecture and product discussion;
- repository and roadmap reconciliation;
- bounded task design;
- independent adversarial review;
- findings classification;
- consolidated correction recommendations;
- integration and publication recommendations.

The Navigator does not mutate, integrate, publish, release, or accept repository
work without explicit authorization.

### Repo-agent

The repo-agent owns:

- authenticated repository inspection;
- authorized implementation and correction;
- test-first reproduction when applicable;
- focused and candidate validation;
- candidate commits when authorized;
- exact, proportional custody reporting;
- stopping at genuine authority, architecture, or public-contract conflicts.

The repo-agent must not decide Operator/Navigator product or architecture
questions.

## Scope and authorization

Every repo-agent implementation, correction, integration, or publication prompt
must include an approval manifest covering its expected consequential actions.

The manifest should identify, as applicable:

- repository and candidate identity;
- authorized file paths;
- branch creation or switching;
- commits, amendments, rebases, merges, or ref changes;
- tests, builds, installs, packing, and generated artifacts;
- local integration;
- remote pushes or pull requests;
- tags, releases, and package publication;
- lifecycle or acceptance changes;
- validation tier;
- stop conditions and required receipt.

Anything not authorized remains prohibited. Never automatically push, merge,
release, publish, accept a task, or change lifecycle state.

Read-only discussion and review require only an explicit read-only scope and
must not inherit implementation ceremony. A lightweight read-only scope may
identify:

- repository or review object;
- permitted inspection;
- prohibited mutation;
- required report.

## Read before write

Before consequential mutation, authenticate the evidence relevant to the
operation:

- repository identity and upstream;
- applicable instructions;
- current branch, HEAD commit, and tree;
- tracked, staged, and ordinary untracked state;
- active Git operations;
- affected linked worktrees or stashes when relevant;
- affected package and dependency boundaries;
- task scope and approval manifest.

Custody checks must be proportional to the authorized operation. Do not make
complete ref inventories, stash-content hashing, generated-output hashing, or
unrelated worktree archaeology mandatory for ordinary public OSS work.

Reuse content-identical authentication established for the same candidate. Do
not repeat it merely because work paused or a ref name changed.

Read-only orientation or review uses `discussion_read_only`. It must not require
builds, tests, branch creation, commits, generated output, or lifecycle changes.

## Working-tree and branch custody

Preserve user-authored and unrelated changes.

- Do not apply, pop, create, drop, or rewrite a stash without authorization.
- Do not use destructive recovery commands to obtain a clean tree.
- Do not switch or create branches without authorization.
- Do not clean up, reformat, or refactor unrelated files.
- Record before/after identity and custody evidence appropriate to the
  authorized operation.
- Classify a dirty worktree before writing. Proceed only if existing changes
  cannot overlap, obscure, or be included in the authorized work and the
  custody boundary is explicit. Otherwise stop.
- Inspect relevant linked worktrees before changing a branch or ref. Do not
  remove, move, unlock, or prune them merely to simplify the task.
- Prefer an atomic ref-only transition when the authorized result is already the
  exact intended commit.

## Validation tiers

A tier defines the expected assurance. It does not itself authorize commands or
mutation.

### `discussion_read_only`

Repository orientation, architecture discussion, reconciliation, governance
drafting, or read-only review. Inspect evidence only.

### `focused_red`

For a behavioral defect or public-contract failure, reproduce the smallest
relevant failure against the authenticated baseline and preserve the command,
identity, and failure evidence.

Documentation and governance work does not require an artificial failing test.
Use bounded contradiction evidence.

### `focused_green`

Run the smallest deterministic validation that proves the focused correction.

### `candidate_full`

Run the complete applicable candidate profile after focused green. Include only
the architecture, formatting, lint, type, package, test, example, and other
gates required by the affected scope.

### `independent_review`

Review the exact candidate and its evidence adversarially. Review does not
authorize correction, integration, publication, or acceptance.

### `integration_bounded`

Perform only the explicitly authorized local integration or ref operation.
Recheck the resulting identity and relevant custody. Do not publish.

### `publication_bounded`

Perform only the authorized push, pull request, tag, release, or package
publication actions, with appropriate release-boundary evidence.

### `acceptance_closeout`

Record Operator-authorized acceptance and completion after the required
implementation, review, integration, publication, architecture disposition, and
residual-finding decisions.

Publication alone is not architecture acceptance or task completion.

A ref-only transition should not rerun the complete suite when the commit, tree,
lockfile, toolchain, dependency graph, validation profile, declarations,
exports, and relevant environment inputs are unchanged.

## Test-first evidence

For behavioral fixes and public-contract failures:

1. reproduce the failure;
2. preserve focused-red evidence;
3. implement the smallest complete root-cause correction;
4. prove focused green;
5. run the applicable candidate tier.

For documentation and governance changes, establish the contradiction first and
run only authorized, proportionate checks.

For public API, package-export, or declaration changes, validate early in this
order:

1. build;
2. declaration and strict type-consumer tests;
3. packed and downstream consumer tests;
4. complete applicable suite.

Do not defer declaration or packed-consumer failures until the end of a long
suite.

## Content-addressed validation reuse

A reusable validation receipt should identify all inputs relevant to the result:

- commit and tree;
- lockfile;
- toolchain;
- dependency graph;
- validation profile;
- generated declarations;
- package exports;
- environment-sensitive inputs.

Reuse is valid only when the relevant identities match. A ref-name change alone
does not invalidate evidence. Do not claim reuse after a relevant
implementation, dependency, declaration, export, configuration, toolchain, or
environment change.

The depth of identity reporting should match the affected risk. Ordinary public
OSS review does not require exhaustive ref or object inventories when an exact
commit/tree and appropriate receipt establish the candidate.

## Finding classification

Use exactly:

- `blocking_correctness`
- `blocking_architecture`
- `blocking_public_contract`
- `blocking_security`
- `blocking_release`
- `non_blocking_hardening`
- `workflow_improvement`

Only a reproducible current-candidate correctness, architecture,
public-contract, security, or release failure blocks the candidate.

Optional hardening, future prerequisites, and work belonging to another task do
not block the current candidate. Record them without silently expanding scope.

## Consolidated adversarial review

Inspect all directly related seams before returning a correction disposition:

- authority and ownership;
- source and built consumers;
- lifecycle reconstruction;
- subscriptions and resource cleanup;
- package exports and declarations;
- deterministic retry or replay when relevant;
- generated-output custody;
- documentation claims.

Batch related findings into one correction round whenever reasonably possible.
Do not widen a bounded review into unrelated subsystem, consumer, roadmap,
Actor-Web, or historical `.fas` archaeology.

## Ignite architecture

The canonical flow is:

`source → source-native snapshot → derived states → renderer view`

- `states` is the canonical optional projection callback in
  `igniteCore(...)`.
- The renderer’s return value is the view.
- Do not teach or restore obsolete `view:` configuration.
- XState machine states are source behavior and are distinct from Ignite’s
  derived `states`.
- One source/runtime contract feeds one core.
- One core may register multiple custom-element names and serve DOM or headless
  surfaces when they intentionally share that contract.
- The application and source ecosystem own source construction, environmental
  capabilities, persistence, cancellation, sharing, and native shutdown.
- Ignite owns observation, derived projections, commands, outward events,
  rendering coordination, and cleanup of its own observation handles.
- Ignite observation cleanup does not imply caller-owned source shutdown.
- Commands express source-directed semantic intent.
- Routing remains separate from source behavior and projection.
- Environmental I/O belongs in application/source ports, native actions,
  services, middleware, transports, or adapters.
- Core contracts remain framework-independent.
- Renderers own presentation.
- Retained Canvas, WebGL, editor, graph, map, video, observer, and similar
  resources remain presentation-owned.

Effects run from a queued post-render microtask after the corresponding renderer
update. An effect callback itself is synchronous, must return `void`, and may
emit outward facts. It does not own environmental I/O, retained resources,
source commands, or source shutdown.

Actor-Web is a separate project. It owns its runtime authority, including
admission, authentication and authorization, execution receipts, checkpoints,
replay, reconciliation, and transport lifecycle. Ignite may adapt and project
Actor-Web facts but must not duplicate or claim that authority.

The accepted JSX `ref`, `commit`, and keyed-identity design is pre-stable
architecture, not shipped implementation. Current documentation must not teach
it as implemented. Its inclusion in v3 remains an explicit Operator decision.

Do not add product-specific consumers or speculative abstractions to this
repository agreement.

## Package and dependency boundaries

- `@ignite-element/core` contains framework-independent contracts and
  adapter-neutral helpers.
- `@ignite-element/adapters` contains runtime-specific normalization for XState,
  Redux, MobX, and Actor-Web.
- `@ignite-element/renderer` contains presentation strategy and JSX/Lit
  rendering.
- `ignite-element` owns assembly, Web Component lifecycle, headless runtime,
  and supported public adapter and renderer entrypoints.
- Examples must teach the same architecture and supported public paths as the
  packages.
- Do not introduce a new package without independent ownership and a justified
  public boundary.
- Do not move application policy, routing, environmental I/O, Actor-Web
  authority, or source-native lifecycle into core or renderer packages.

## Public API, declarations, and release boundaries

The v3 package family is native ESM-only.

Public package work must preserve:

- valid `exports` conditions and resolvable targets;
- declaration graphs containing only supported public dependencies;
- strict downstream consumers with `skipLibCheck: false`;
- source and packed-consumer verification;
- optional peer isolation;
- no required `lit-html` installation for consumers that do not select Lit;
- supported adapter and renderer entrypoints;
- changesets for publishable contract changes.

Do not add undocumented aliases, CommonJS compatibility, export shims, broad
casts, or private implementation paths to disguise a broken public contract
without explicit authorization.

Prerelease reporting must distinguish changesets already consumed into the
current prerelease cycle from unconsumed changesets expected to contribute to a
later prerelease. Unconsumed changesets do not prove readiness or publication.

## Generated-output custody

Generated-output handling must be proportional to the authorized operation.

Before an authorized operation likely to write output:

1. identify relevant conventional output locations;
2. distinguish tracked, pre-existing ignored, and task-generated content;
3. inventory pre-existing ignored output when necessary to detect a meaningful
   custody delta;
4. compare relevant custody after the operation.

Pre-existing matching ignored output is external worktree custody. Preserve it;
its mere existence is not a blocker.

Task-generated output must be removed before final custody unless the approval
manifest authorizes retention. Do not delete or rewrite pre-existing output
while cleaning task-created artifacts.

Do not accidentally leave bundles, packed consumers, dependencies, caches,
coverage, documentation output, or test reports. An unexplained relevant
creation, deletion, or modification is blocking until classified.

Do not require hashing every ignored directory for work that cannot affect
generated output.

## Commits, review, integration, and publication

Authorized implementation should use focused, reviewable commits aligned to the
task. A commit must not include unrelated cleanup.

- Do not amend, rebase, force-update, or rewrite history without authorization.
- Report the exact candidate commit and tree.
- Obtain independent review before integration when the task requires it.
- Treat correction, integration, publication, architecture acceptance, and task
  closeout as separate decisions.
- A reviewer finding does not authorize its correction.

Prefer review evidence in this order:

1. authenticated GitHub commit or branch diff;
2. exact commit/tree plus a content-addressed validation receipt;
3. an incremental bundle only when offline or private review materially
   requires it.

Do not duplicate full Git history merely to prove a fast-forward. Do not create
a bundle when the public authenticated diff is sufficient.

Review artifacts must exclude credentials, caches, generated reports,
AppleDouble files, extended attributes, absolute workstation paths, and
unrelated personal files.

## Stop conditions

Stop and report a structured conflict for:

- repository, branch, candidate, or applicable-instruction mismatch;
- unexpected relevant worktree, index, stash, worktree-registration, or
  generated-output changes;
- missing authority for a consequential action;
- an apparent conflict between a task instruction and accepted architecture or
  a public contract;
- dependency, declaration, export, or public-contract failure;
- destructive recovery requirements;
- secret or credential exposure;
- inability to produce required deterministic evidence.

Do not stop merely for:

- optional hardening;
- inactive or stale `.fas` state;
- content-identical evidence already proven;
- approved pre-existing ignored output;
- absence of implementation tests or commits during read-only work;
- lack of publication evidence;
- unfinished retained-interface implementation;
- a future task waiting on its own prerequisite.

A structured conflict should identify the conflict, options, recommendation,
risk, and whether progress is blocked.

## Deterministic fixes

Correct root causes. Do not rely on:

- suppressions;
- broad type casts;
- skipped tests;
- weakened assertions;
- aliases masking broken exports;
- environment-specific patches;
- retries hiding nondeterminism;
- documentation claiming behavior absent from implementation.

Any exception requires explicit Operator approval and documented risk.

When verification fails: reproduce, classify, localize, reduce, fix, guard, and
verify.

## Recovery

- Preserve and inventory relevant dirty or user-authored changes. Never discard
  them merely to recover a task.
- Preserve existing stashes unless an exact stash operation is authorized.
- Inspect relevant linked worktrees before changing refs. Do not automatically
  prune stale registrations.
- If a Git operation is interrupted, identify its exact state before
  continuing, aborting, or completing it.
- If the expected branch or candidate differs, do not silently switch, reset,
  merge, or rebase.
- After interruption, reauthenticate only mutable or uncertain surfaces and
  reuse content-identical evidence.
- If partial authorized edits exist, report touched paths, verification
  attempted, failures, and the next safe resume point before replacement or
  takeover.

## Workflow-friction accounting

Candidate and stop receipts should briefly report, when applicable:

- focused and complete validation time;
- isolated runs;
- installs or downloads;
- review artifact sizes;
- approval interruptions;
- repeated content-identical checks;
- generated-output handling;
- whether each cost increased assurance.

Workflow friction is advisory unless it exposes a correctness, architecture,
public-contract, security, release, custody, or authorization failure.
