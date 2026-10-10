---
"@ignite-element/core": patch
"@ignite-element/adapters": patch
"@ignite-element/renderer": patch
"ignite-element": patch
---

Resolve published declarations under TypeScript `NodeNext` and `node16`.

Relative imports in the `.d.ts` graph now include the `.js` extension those modes require, so `igniteCore` callback parameters stay typed when `skipLibCheck` is on. Declaration maps shift with those edits, and both `build:types` and `build:js` rewrite the graph. The `types` condition stays first, and consumers that ignore custom export conditions still receive the production build.
