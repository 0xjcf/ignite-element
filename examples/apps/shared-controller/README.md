# Shared display-density controller

A private teaching project, not a publishable package: one plain TypeScript
controller, structural source adapter and session owner feed headless, imperative
custom-element, React and native projections. No Actor-Web runtime is required.
All transport data is synthetic. There is no backend or application migration.

## Run from the reviewed checkout

Use Node 22.16.0 and pnpm 10.33.0. At the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter ignite-element... build
pnpm --dir examples/apps/shared-controller install --ignore-workspace --no-link-workspace-packages --frozen-lockfile
pnpm --dir examples/apps/shared-controller typecheck
pnpm --dir examples/apps/shared-controller test
pnpm --dir examples/apps/shared-controller dev
```

The `ignite-element` dependency links the checked-out package's real built
exports. Vite deduplicates React across this local link; no private source aliases
are used. Published beta.11 lacks this candidate's bindings. Changesets selected
`3.0.0-beta.12` for this local release candidate, awaiting publication verification.
Do not substitute a registry install until that exact version is verified public.

Click Load, then Return comfortable query in the demo's fake-transport controls.
Choose compact; both views show pending while the old value remains confirmed.
Advance deadline shows unknown without cancelling the request. Accept next write
shows late confirmation. Reject next write exposes Retry. Remove first view leaves
the owner alive; End session removes both views and disposes the owner.

## Canonical files

| File | Responsibility |
| --- | --- |
| `src/controller.ts` | Ports, immutable observations, guards, revisions and receipt outcomes |
| `src/states.ts` | Shared message and action-availability meaning |
| `src/source.ts` | Public structural command source; translation only |
| `src/owner.ts` | Session construction/preparation and final cleanup |
| `src/headless.ts` | Subscribe-before-read and single-input execution |
| `src/web.ts`, `src/react.tsx`, `src/native.tsx` | Borrowing platform projections |
| `src/fake-ports.ts` | Deferred transport and manual time for deterministic tests/demo |

The guide imports canonical source directly, avoiding a second drifting example.
Root source-free `igniteCore()` is not the source-backed runtime used here.

## Isolated package and native proof

After building the current packages:

```sh
node examples/apps/shared-controller/scripts/packed-consumers.mjs
```

This uses the repository's public-package fixture pattern and retains a new
external directory. Four tarballs and their hashes, exact internal dependencies,
local file overrides, strict source copies, manifests, frozen locks and command
logs make the result reproducible. No registry beta.11 fallback is allowed.
All commands and hooks retain the existing validation strength.

The web lane strictly checks/tests the complete web, React and headless code.
The native lane reuses the existing React Native fixture (React 19.1.0, RN 0.81.5),
preserves its original controls, and adds this example's real native handlers.
Its strict compiler excludes DOM. This is a mock native host, not device, Metro
or arbitrary Expo acceptance. The neutral lane cannot resolve Actor-Web, React
DOM, Lit or unrelated ecosystem peers. Safe evaluation does not mean the bundle
contains no lazy DOM-capable code.

The normal root test inventory includes this example; strict root example checking
uses `tsconfig.json`. Native is intentionally checked separately against its real
native dependency graph, rather than fabricated DOM types in the web compiler.

## Ownership and outcomes

Prepare once outside rendering. Use a new owner for each authentication epoch,
even for the same account. View unmount unsubscribes; it does not end shared work.
Never register the session core: registered core disposal is deliberately rejected.
Neither `igniteReact(core)` nor a replacement lifecycle hook is part of this API.

Commands are ordinary functions; `choose` returns `Promise<void>`, not an acceptance
receipt. Guards also apply outside the view. Observe pending/rejected/unknown and
confirmed facts instead of announcing success after `await`. `execute` returns
`{snapshot, states, events}`, not the command's value. Overlapping event windows
can share occurrences; only the application's explicit correlation/receipt policy
establishes causality. The accepted core controls cover that unchanged contract.

Dispose after borrowers unmount. The owner invalidates callbacks and shuts down
its controller; Ignite releases its observation. Transport work is not cancelled.
An unresolved `execute` eventually rejects after disposal; a direct promise already
returned by a command retains its own outcome. This is client policy, never server
authorization or cross-device synchronization.
