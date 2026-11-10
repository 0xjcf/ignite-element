---
"@ignite-element/jsx-plugin": patch
---

Declare the renderer as a workspace development dependency of the JSX plugin so
native Node and source-aliased example builds resolve the renderer from its owner.
The published runtime dependencies, exports, and author-style provenance guards
remain unchanged. Add native-process and seeded provenance regressions that do not
inherit pnpm's hoisted NODE_PATH fallback.
