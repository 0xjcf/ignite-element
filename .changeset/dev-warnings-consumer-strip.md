---
"ignite-element": patch
"@ignite-element/renderer": patch
---

Ship development warnings through the `development` export condition.

The `development` build keeps duplicate-key and deprecated `innerHTML` / `textContent` warnings, plus the renderer's internal diff flag and `ignite-element` event-origin diagnostics. It does not check `process`. The `production` and `default` builds compile those warnings out, so a consumer that ignores export conditions gets a bundle with no warning strings and no `process` reference.

Vite and webpack select the condition from the build mode. `vite build --mode development` still selects the production file, because Vite's build sets `NODE_ENV=production`. Only the dev server, or an explicit `NODE_ENV=development`, picks the development build. Rollup needs `exportConditions: ["development"]` on `@rollup/plugin-node-resolve`. esbuild needs `--conditions=development`.
