---
"@ignite-element/jsx-plugin": minor
---

A `.cjs` `require(helper)` that can load the author-style mark is a build error under Vite, esbuild, webpack, and Rspack. The plugin trusts only realpaths inside the resolved Ignite package roots. There is no public mark API.

A file with more than one `@jsxImportSource` comment fails the build, so the plugin and the bundler cannot disagree. One Ignite pragma still marks static `<style>` text. A React file is not marked.

Supported bundlers are Vite, esbuild, Rollup, Rolldown, webpack, and Rspack. JSX in `.js`, `.mjs`, or `.cjs` is parsed when that extension's loader is JSX: Vite and esbuild `jsx` or `tsx`, or a webpack or Rspack `babel-loader` rule. `.ts`, `.mts`, and `.cts` stay TypeScript, so angle-bracket assertions still parse.
