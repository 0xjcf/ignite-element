---
"@ignite-element/jsx-plugin": patch
---

Preserve stable local functions named `require`, valid CommonJS wrapper returns,
and safe sequence-expression load targets while refusing real private author-mark
loads, including loads nested before a sequence's final value. Scan executable
syntax without assuming that `require` or `import` is immediately followed by `(`.
Use one lexical module-load classifier for recursive scans, compiler rejection
and resolved-package guards. Literal and template data passed to ordinary local
functions stay data; reassigned and mutable loader bindings remain guarded.

For webpack and Rspack, use the running loader's native context to identify the
actual Babel-loader selection. Path-qualified rules, includes, excludes and
`oneOf` remain owned by the bundler, and TypeScript assertion syntax stays intact.

Recognize real CommonJS `module.require` ports and local wrappers forwarding a
loader argument, while preserving locally shadowed module-shaped data. Unwrap
angle-bracket TypeScript assertions through the shared expression classifier.
Inspect the host's final module code after other transforms using the same
binding-aware loader and target checks, so generated private loads stay refused.
Original and final application code share the same fail-closed policy for
unknown loader targets; dependency scans retain their existing relaxation.

Follow lexical parameter dependencies through composed loader expressions and
rest arguments, including templates, aliases, calls and member access. Ignore
discarded sequence values and conditional tests when classifying forwarding.

Classify optional and sequence callees, lexical loader aliases and explicit
Function.call/apply load arguments through that same classifier.

Retain loads through forwarding function initializers even when a later
reassignment changes their binding; ordinary reassigned data functions stay data.

Discover possible loader-input flow through const, let and var initializers and
assignments. Keep this conservative discovery separate from the unchanged-const
requirement used to prove safe target values.

Inspect possible first-element writes to apply argument arrays. Keep opaque
argument-list uncertainty separate from scalar loader-input forwarding, so
unused argument data does not become a module specifier.
