# Command-source implementation validation

## Scope and identity

- Repository: `0xjcf/ignite-element`.
- Authenticated remote beta/start: `cd40ce117cf5a2a3be92415ba7e02bd99e45d969`.
- Starting tree: `632410b8b74284cd8588fbaca58d001c96d13014`.
- Local review branch: `fas/command-source-context`, isolated from the parked documentation candidate.
- The older local `beta` checkout at `c9d7d74b97ccd7bc83c5d54e493ff7cd8583acd7` is preserved. This work has not been integrated into it.
- Candidate identity: the commit containing this receipt. The final handoff records its exact commit/tree; this receipt does not attempt a self-referential commit hash.
- Lockfile SHA-256: `af89205aefb83cebc12e1c31cceeaef878b9251c27a71fe994a35942248f7455` (unchanged).
- Node 22.16.0; pnpm 10.33.0; TypeScript 5.9.3; frozen workspace install.
- Published facade baseline queried during the task: stable 2.2.2, beta 3.0.0-beta.14. No version or registry mutation occurred.

## Runtime and declarations

`CommandContext` exposes `source` instead of `actor`. The shared projection factory passes `resolveActor(adapter)` under that key. It does not pass the raw configuration source or acquire another instance.

These are the only runtime/type behavior changes. Existing adapter resolution, lifecycle, ownership, capabilities, effects, states, events and bindings are preserved. Runtime bytes intentionally change; byte-identical runtime output is not claimed.

Public helper names such as `XStateCommandActor`, `ActorWebCommandActor`, existing generic `Actor` parameters and adapter `resolveCommandActor` methods remain. They were not renamed for cosmetic consistency.

The changeset records removal as a breaking beta change. No compatibility property is retained. Fixed package-group release planning remains for the separately authorized release step.

## Focused red and green

Before implementation, all nine source-form runtime cases and the headless case failed against the old command context; commands attempted to use an undefined `source`. Strict types rejected the missing property. Initial test-authoring diagnostics were corrected without changing the contract (Redux factories require `adapter: "redux"`; Redux's existing declared dispatch return is `void`).

The final focused suite has 11 passing runtime tests plus strict type guards:

- XState machine and shared actor.
- Redux slice, store factory and shared store.
- MobX observable factory and shared observable.
- Actor-Web neutral factory and shared source.
- Correct view updates, shared/isolated state boundaries, factory counts and single Actor-Web dispatch.
- Borrowed lifetime, headless execution, outward effect delivery and only `source` in the callback object.
- Native MobX action return preserved through inferred JSX commands.
- Local aliases, command inputs, catalogue names, hook results, removed `actor`, invalid source methods and no command target in effects.

Existing migrated suites cover registered web interfaces, React web, host-dependent Actor-Web factories, command results/errors and ownership cleanup. Packed headless probes run live/factory forms with browser-global traps.

## Candidate profile

- Package build and export verification: passed.
- Package tests: 70 files, 778 tests passed.
- Script tests: 148 passed.
- Example runtime suite: all 10 declared covered roots passed.
- Package and example typechecks: passed; 13 example roots checked.
- Node/script-hardening profile: passed, including 9 script-hardening tests.
- Packed exports: ESM inventory, tarball provenance, runtime imports, strict declarations and optional-peer/DOM isolation passed.
- Strict packed handbook consumers: web (4 runtime tests), native (2 tests plus isolation) passed with `skipLibCheck: false`.
- Published beta.14 quickstart: exact README/Getting started source passed strict compilation and its rendered toggle test against registry packages, without candidate overrides.
- Chromium package browser suite: 7 passed.
- Documentation build/export: 68 routes; agent index 87 words; separate current/v2 exports.
- Documentation snippets: 31 typechecked; one existing incomplete fragment and seven existing explicit historical/illustrative exclusions. No new exclusions or baseline failures.
- Astro: zero errors/warnings, one existing unused-variable hint.
- Handbook routing: five behavioral tests, 23 legacy mappings and fragments passed.
- Publication guardrails: 283 tests and the publication-contract check passed.
- Built links: 3,070 internal references passed.
- Theme check: 52 contrast checks and 10 control geometry checks passed.
- Architecture, formatting, lint and normal commit hooks: required; final results recorded in the local handoff. Lint retains existing advisory warnings.

## Validation environment and friction

The fresh worktree required a frozen install and generated package/docs output. Packed and published-consumer checks used disposable projects; no package was published. Focused runtime checks took under a second; package tests about three seconds, browser checks two seconds, the full profile tens of seconds plus installs and builds.

Browser launch needed macOS access outside the sandbox. The first usable browser run exposed the example's missing generated CSS; running its existing `build:css` prerequisite fixed it. No browser test or application code was weakened.

The existing npm-isolation test assumes its `npm` executable is a JavaScript CLI and compares canonical temporary paths. Volta's executable/shell launchers and macOS `/var` alias caused control failures. Run the profile with the installed pnpm and Node binary directories ahead of Volta and `TMPDIR` set to a canonical private temporary directory. The release script and its assertions are unchanged. These tests inspect synthetic npm configuration; they do not authenticate or publish.

A new raw beta.14 fixture initially sat under Astro source and was incorrectly checked as site implementation. It now lives with checked consumer fixtures and is strictly checked against its actual published dependency. The install-selector fixture was updated to mutate the pinned selector, preserving its positive and negative coverage.

The final handoff retains text evidence and a review diff outside the repository. Task-created dependencies, build output, caches and browser reports are removed from the implementation worktree after commit hooks. No pre-existing output in the parked or original worktrees is modified.

## Review and release boundary

No push, PR, merge, release preparation, staging, npm publication, tag change or documentation deployment is authorized by this candidate. Review this commit, integrate through the protected workflow, then separately authorize, publish and verify a supporting beta. Determine the actual version during release preparation. Reconcile and review the parked documentation candidate before deploying matching installation instructions.

Historical custody uncertainty is not resolved by this task. See the accompanying migration ledger for the preserved page checkpoint and downstream instructions.
