---
"ignite-element": major
---

BREAKING (beta): `igniteTools` fails closed. Commands are denied unless `canExecute` returns `true`. Ungated `read: true` tools stay available only when that command is side-effect-free; `run` still calls `core.execute`. Do not mark a command `read` if executing it changes source state. `observe` and `until` do not execute commands.

`canExecute` is `(name, input?, context?)`. Listing calls it with the name. A call passes the validated input and `{ core }`. `run` sets `context.execute` only immediately before `execute`. `resolveCall` does not set it. Return `true` only for an explicit allow. A throw, a thenable, or any other result is `Unavailable`. Ignite does not store or consume approvals.

Migration: pass `canExecute` for every command that should run. `canExecute: () => true` allows every command in that schema; that is a migration choice, not the default. For a single-use approval, compare the canonical call (the command name plus the validated input) and consume the approval id only when `context.execute` is true. A new id can approve that call again. Deny every command that is not explicitly allowed. Do not use a precomputed boolean, a 32-bit hash, or an allow-everything fallback.
