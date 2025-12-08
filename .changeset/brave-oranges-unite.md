---
"ignite-element": patch
---

- Fix ignite config Vite loader (root-relative imports) and restore webpack plugin export surface.
- Add JSX runtime entrypoints + DOM polyfill wiring; tighten igniteCore/Facade typings and command actor wrapper.
- Emit declarations to dist/types (excluding tests) and align package exports for config/vite, config/webpack, and JSX runtimes.
