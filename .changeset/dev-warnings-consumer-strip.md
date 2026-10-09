---
"ignite-element": patch
"@ignite-element/renderer": patch
---

Leave development warnings in the published renderer for the consumer's bundler to strip.

The library build no longer bakes `NODE_ENV`. Duplicate-key and deprecated `innerHTML` / `textContent` warnings, and the internal `IGNITE_DIFF_ENABLED` read, stay behind `typeof process !== "undefined" && process.env.NODE_ENV !== "production"`. Production bundlers drop those branches, including `process`. A browser can import the bundle when `process` is missing. In a production bundle the diff flag is ignored and diffing stays on.
