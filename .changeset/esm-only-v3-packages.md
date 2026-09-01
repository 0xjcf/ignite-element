---
"@ignite-element/core": major
"@ignite-element/adapters": major
"@ignite-element/renderer": major
"ignite-element": major
---

Make the v3 package family native ESM-only.

Remove the CommonJS `main` and `require` contracts and stop publishing CommonJS
or default UMD build artifacts. Consumers must use ESM imports. Existing public
ESM entrypoints and their TypeScript declarations remain supported.
