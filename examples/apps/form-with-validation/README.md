# Form with validation (worked app)

A signup form built as a single ignite custom element — `<signup-form>` — backed
by an **XState** machine and rendered with **ignite-JSX**. It is a small but
complete worked app: field validation, a guarded submit, an async "server" call,
and success/error states, all driven by a pure core that is tested headlessly.

## Architecture

The interesting part is the split between a deterministic **functional core** and
the ignite element that renders it.

| File | Layer | Role |
| --- | --- | --- |
| `src/validation.ts` | functional core | Pure validators (`required` / email shape / min length). No I/O. |
| `src/formMachine.ts` | functional core | XState v5 machine: `editing → submitting → success`, a `canSubmit` guard, and the one async seam (`submitForm`) modelled as a `fromPromise` actor. |
| `src/form.tsx` | ignite element | `igniteCore({ source, view, commands })` + the ignite-JSX view. Registers `<signup-form>`. |
| `src/form.css` | styling | Injected into the Shadow DOM via `?raw` (document CSS can't reach shadow content). |

## What it shows

- **Validation on blur, cleared live.** Blurring a field validates it; fixing a
  flagged field clears its error on the next keystroke (a field is only validated
  once it's been touched).
- **A guarded submit.** The submit button is disabled until every field is valid.
  Submitting an invalid form anyway reveals all errors at once.
- **An async submit with an error path.** Submitting enters a `submitting` state
  (button shows "Creating account…"); the mock server rejects `taken@example.com`
  to show the error returning you to `editing` with a message.
- **Idiomatic ignite.** Commands derive from the injected `actor` and use
  source-native `actor.send`; the view is a pure projection of the snapshot
  (`{ snapshot }` — the forward-compatible context shape).

## Headless-testable

Because validation and the machine are pure, the whole form is testable without a
DOM:

- `src/validation.test.ts` — the pure validators.
- `src/formMachine.test.ts` — machine transitions, the `canSubmit` guard, the
  async submit (success + server-error) via XState's `waitFor`.
- `src/form.headless.test.ts` — the same core driven through Ignite's headless
  runtime (`execute` / `getView`).

Example tests are typecheck-gated (the package's `vitest` run set excludes
`src/examples/**`); run them directly with `vitest run` against this folder.

## Run

```bash
cd src/examples/apps/form-with-validation
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite config aliases `ignite-element` and the `@ignite-element/*` workspace
packages to local **source**, so the app always runs against current code.
`xstate` is pinned to the workspace version (`5.32.1`). ignite-JSX is transformed
from this example's `tsconfig.json` `jsxImportSource` (Vite reads it) — the same
config-free setup as the spa-router app.
