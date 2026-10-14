---
"ignite-element": patch
---

A failed first `execute` on an independent core no longer leaves its actor, invoked services, or timers running. This covers a preparation failure and an unknown command. A projection that throws a falsy value such as `undefined`, `null`, `0`, `''`, or `false` now rejects `execute` instead of letting the command run. When releasing the quiet observation lease throws, `execute` now keeps the command's own result or rejection and logs the cleanup error with `console.error` instead of rejecting with it.
