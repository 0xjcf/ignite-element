---
"ignite-element": minor
---

BREAKING (beta): `igniteTools` fails closed. Commands are denied unless `canExecute` returns true. Ungated tools marked `read: true`, plus `observe` and `until`, stay available when the predicate is omitted. Pass an explicit predicate to keep a command callable. `canExecute: () => true` allows every command in that schema; that is a migration choice, not the default.

`consequential: true` commands also require a single-use approval on `run`, bound to the bind's `actor`, the command name, and the normalized input (`{ actor, name, input, id, expiresAt }`). A boolean `confirmed` flag is not an approval. Replay, a different input, a different user, an expired record, or an unknown command does not execute. `run` consumes a matching approval once, then calls `core.execute({ command, input })`.
