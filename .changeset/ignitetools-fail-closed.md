---
"ignite-element": minor
---

BREAKING (beta): `igniteTools` fails closed. Commands are denied unless `canExecute` returns true. Ungated tools marked `read: true`, plus `observe` and `until`, stay available when the predicate is omitted. Pass an explicit predicate to keep a command callable. `canExecute: () => true` allows every command in that schema; that is a migration choice, not the default.

`consequential: true` is a schema marker, not an ungated read. The application owns any single-use approval (`{ actor, name, input, target, id, expiresAt }`) and checks it in the authority `canExecute` closes over. Ignite does not validate, store, or consume that record. `run` calls `core.execute({ command, input })`.
