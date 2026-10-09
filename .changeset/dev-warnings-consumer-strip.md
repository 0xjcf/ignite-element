---
"ignite-element": patch
"@ignite-element/renderer": patch
---

Leave development warnings in the published renderer for the consumer's bundler to strip.

The library build no longer bakes `NODE_ENV`. Duplicate-key and deprecated `innerHTML` / `textContent` warnings stay behind a `globalThis.process` check, so a Vite production build drops them and a browser can import the bundle when `process` is missing.
