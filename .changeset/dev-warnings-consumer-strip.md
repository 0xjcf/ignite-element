---
"ignite-element": patch
"@ignite-element/renderer": patch
---

Leave development warnings in the published renderer for the consumer's bundler to strip.

The library build no longer bakes `NODE_ENV`. Duplicate-key and deprecated `innerHTML` / `textContent` warnings stay behind `typeof process !== "undefined" && process.env.NODE_ENV !== "production"`, so production bundlers drop them and a browser can import the bundle when `process` is missing.
