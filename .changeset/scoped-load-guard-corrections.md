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
