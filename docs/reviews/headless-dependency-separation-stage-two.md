# Headless dependency separation: stage two

## Candidate and scope

Local, uncommitted continuation of `codex/remove-projection-targets` at base
`4d191949c861ab0b72844574604906fc937c0694`, base tree
`2672968d2b1b9f37dbf9ce250060496728d85ae3`.
The Operator approved four preservation rules before implementation:
unchanged public behavior and types; source and observation ownership;
retained presentation and security guarantees; measured savings under the
existing build profile and ceilings. No commits, pushes, merges, providers,
secrets, ref changes, or new public APIs are authorized.

The 64 existing stage-one and build-correction records are the input candidate,
not changes made by this stage. Their contents must remain identical.

## Dependency change

Previously, element reconnection imported the full stylesheet driver's replay
function. Merely importing renderer configuration installed that driver into
the realm's style slot, retaining pending-root and reconnect machinery in
headless bundles.

Element reconnection now uses the lightweight style hook to signal an already
installed replay callback. Selecting global styles or calling the low-level
injector activates the existing driver. Pre-driver requests transfer before
the new style setting is assigned, preserving explicit flush timing. The
initializer publishes its installed flag before replay to support recursive
queue delivery.

Element builds queue weak references where supported, so delayed style
activation does not retain detached elements. Cancellation removes every
matching request, including the fallback without WeakRef. The host-free JSX
build retains its previous queue representation; driver installation accepts
both representations. Stylesheet path validation is unchanged.

No package export, supported import path, callable core, synchronous
registration, rendering contract, source lifecycle, renderer selection, or
tool contract changes. All 26 public declaration entry files match the
stage-two input byte for byte. Private hook declarations change. The changeset
is unconsumed; it does not establish publication or release readiness.

## Test-first evidence

Initial focused commands:

```sh
NODE_OPTIONS=--expose-gc pnpm --filter ignite-element exec vitest --config vitest.style-activation.config.ts --run
node --test scripts/__tests__/headless-style-boundary.test.mjs
```

The input candidate fails the assertion that configuration reads do not
activate stylesheet delivery, and fails the bundle reduction checkpoint.
Existing stylesheet tests and initial preservation properties pass. During
the first correction, a collection test reproduces strong retention of a
detached element in the delayed queue; the weak-reference correction makes it
pass. The initial attempt without exposed GC failed its environment check;
the recorded behavioral red uses exposed GC.

Five fast-check properties use seed `1802030`, 60 runs each. They cover
connected/disconnected requests and cancellation before driver installation;
parked reconnect and terminal detach; repeated requests and cancellation;
repeated pre-activation connection/move history with cancellation and an
unrelated root; and rejected stylesheet paths. Reconnect assertions execute synchronously
before MutationObserver delivery, so automatic replay cannot hide a missing
element signal. Examples additionally cover collection, absent WeakRef,
empty-slot cancellation, legacy driver reinstallation, and replay dispatch.

Corrected focused result: 35 tests pass, including eleven new tests and 300 generated
property runs. The built headless fixture also executes in a fresh native
Node process and confirms that it does not install the stylesheet driver.

## Bundle checkpoint C

Packed production ESM consumers; Vite 7.3.7 / esbuild; ES2020; all optional
peers external; gzip level 9 except the existing no-host level-6 budget.
Before/after use the same fixture sources and toolchain. In-memory source-map
builds match published JavaScript byte for byte before source attribution.

| Fixture | B minified | C minified | B gzip | C gzip | Gzip saved |
| --- | ---: | ---: | ---: | ---: | ---: |
| XState headless | 64,689 | 63,681 | 21,826 | 21,380 | 446 (2.0%) |
| XState element | 64,894 | 63,886 | 21,916 | 21,465 | 451 |
| XState hook | 64,986 | 63,978 | 21,955 | 21,502 | 453 |
| Neutral tools | 12,861 | 12,861 | 4,058 | 4,058 | 0 |
| No-host JSX (gzip 6) | 23,551 | 23,551 | 7,524 | 7,524 | 0 |
| Renderer consumer | 23,253 | 23,253 | 8,778 | 8,778 | 0 |

Both approved ceilings remain unchanged: 7,525 and 8,800 bytes. Stylesheet
delivery disappears from headless source attribution. Retained-host and
security code remains. The largest remaining minified contributors are JSX
rendering (14,685 bytes), element assembly (7,721), retained hosts (6,077),
XSS/CSS guards (5,968), and agent runtime (4,903).

This is a bounded reduction, not a DOM-free headless runtime. The same public
callable core still supports synchronous DOM registration and default JSX
rendering. Moving those functions between files alone cannot make that
capability unreachable. Further removal of that floor needs a separate API or
architecture decision; this candidate makes neither.

## Mutation evidence

```sh
NODE_OPTIONS=--expose-gc pnpm exec stryker run stryker.style-activation.config.json
```

Final focused Stryker run: **88.60%**, 114 mutants, 95 killed, 6 timeout,
13 survived, zero uncovered or errored mutants; 103 seconds. Scope is the
style hook, global-style setter, and driver initialization/call. No mutation
suppressions, skipped tests, incremental reuse, or changed JSX budgets.

Survivor disposition:

- IDs 14, 16, 17, 19 alter the compile-time host flag. They are equivalent in
  the focused host-enabled test profile; this is not mutation coverage of the
  host-disabled build. Its unchanged production budget is verified separately.
- IDs 23, 25, 26, 31 relax defensive checks for queue values outside the
  generated same-realm root/reference domain. Those guards remain in the
  implementation; malformed private slots and foreign roots lack focused
  mutation coverage.
- ID 42 reassigns an already identical queue object; 55 selects the general
  cancellation loop for strong roots; 58, 87, and 103 add harmless iterations past
  the end. These do not change delivery for valid queue entries.
- Timeout IDs 62, 74, 75, 89, 104, 105 create nonterminating queue loops.

Earlier in-process Vitest-runner results varied and reported some survivors
that direct fresh-process controls killed. The final profile therefore uses
Stryker's command runner: a fresh Vitest process per mutant, with the active
mutant selected before module initialization. The reported 88.60% is the raw
final score; no manual control is added to it.

`workflow_improvement`: the command-runner CLI stayed idle after reporting
completion, with no descendants. Three completed task-owned Stryker processes
were identified and terminated after their reports were recorded. The final
report is complete; CLI shutdown was forced, so an ordinary successful exit is
not claimed. This limitation does not change the mutation counts and has not
been hidden by a forced-exit wrapper or a suppressed assertion.

## Corrected candidate validation

- Full library and JSX-plugin production/development builds and declarations.
- Package typechecks, Node16/NodeNext declarations, and strict packed consumers
  with optional-peer isolation and source ownership probes.
- Element suite: 1,509 pass, two existing todos; compiler suite: 167 pass.
- Script suite: 171 pass; Chromium suite: 38 pass.
- Runtime tests for ten examples: 506 pass; typechecks for thirteen examples.
- Architecture check, scoped Biome check, Markdown lint, and diff whitespace.

An initial packed run lacked built JSX-plugin artifacts; building that
package resolved it. Two declaration checks used the default npm cache and
failed the environment's pack step; the task-local cache passed. Neither
required an implementation workaround or weaker contract assertions.

## Review and custody

The independent read-only Codex review authenticated the base and the
75-record candidate fingerprint
`76676cfe53001df07a4897839952a3d46c5b0063ab41690dd8698c2e61c4e33d`.
It returned one `blocking_correctness` finding: a root queued while
disconnected can connect and disconnect before driver activation, but the
lightweight replay signal does not record that connection in the queue.
Styles then inject while detached and can remain stuck on an outdated setting.

A new seeded property reproduced the finding with one move cycle: seed
`1802030`, initial path `0:0`, counterexample `[1]`. The Operator then approved
this bounded correction and rule: once connected, a root must stay parked
while detached, reconnect must apply the latest configured stylesheet, and
cancellation must never revive it. The expanded property also reproduced red
at path `0:0:0`, counterexample `[1, "none"]`.

The correction records connection history for matching queued roots before
activation. It preserves terminal cancellation before and after activation and
does not mark unrelated roots as connected. All 35 focused tests now pass.
The final independent review disposition and final custody are recorded at
closeout. The earlier review fingerprint is superseded by the corrected source
fingerprint, which excludes this receipt.

Root lock remains
`26985c470bc1ad785101fa98064194e4fe10c8f3e8ed72123a65f08ab695edc2`.
Toolchain: Node 22.23.3, pnpm 10.33.0, TypeScript 5.9.3, Vitest 4.0.16,
Vite 7.3.7, Stryker 10.0.0.
Corrected source fingerprint (75 records, excluding this receipt):
`8f1a9a285b3e57c103c9ca4fa8506f4597860c253514c8066f099ab955100611`.
The fingerprint hashes compact UTF-8 JSON `[{path,sha256}]`, sorted by path,
with `deleted` for removed files. All 64 input records remain byte-identical.

Validation costs were bounded to the changed renderer seam and the applicable
candidate profile. Several short mutation runs refined the tests and exposed
runner inconsistency; the final isolated run increased assurance at a cost of
103 seconds for the corrected candidate. Twenty direct survivor controls took roughly twenty seconds.
Two approval interruptions (rules and the review correction) were required by
AGENTS.md. No review bundle or
Git history copy was created.

### Final disposition

The final independent read-only Codex review authenticated the corrected
identity and fingerprint and returned **no actionable introduced findings**.
It confirmed queued connection history, cancellation, and latest-style replay.
Its limits: static review only, no rerunning tests/builds, and completed
mutation reports do not establish a normal Stryker CLI exit. The earlier
`blocking_correctness` finding is corrected and regression-tested; the runner
shutdown issue remains a `workflow_improvement`.

Final custody: all 64 initial records preserved byte for byte; 75 changed/new/
deleted records plus this receipt; no staged content. Branch and HEAD remain
unchanged. The 28 task-generated ignored entries and task-local audit copies,
raw logs, reports, and fixtures are removed after recording their results here.
No commits, pushes, merges, provider calls, secrets, or lifecycle operations.
