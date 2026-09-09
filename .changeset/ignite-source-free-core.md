---
"ignite-element": major
---

Replace root `igniteShell` with source-free `igniteCore()` and remove the four
shell-specific public types and `onConnect`/returned-teardown capability. This
is a breaking change without an alias. Declarative consumers change their import
and named construction; lifecycle consumers must supply application-owned
presentation integration or a custom-element boundary for initial state, updates,
cleanup and reconnection. Adapter-specific contracts remain unchanged, and native
source shutdown remains application-owned.

Keep root declarations independent of unselected ecosystem peers by importing
existing adapter-neutral types directly from `@ignite-element/core`. This
changeset is unconsumed and does not predict the next published version.
