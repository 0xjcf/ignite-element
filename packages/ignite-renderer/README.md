# @ignite-element/renderer

Advanced renderer and runtime utilities for Ignite.

The v3 package is native ESM-only. Use ESM imports; it does not provide a CommonJS `main` or `require` contract.

This package contains the JSX and lit renderer layers, renderer registry, and configuration/runtime helpers used by `ignite-element`.

Use it directly only for custom renderer integration or lower-level library work.

Most application and component authors should install `ignite-element` instead.

Applications that directly import the optional lit strategy must declare the scoped renderer and its peer themselves:

```sh
pnpm add ignite-element@beta @ignite-element/renderer@beta lit-html
```

Normal `ignite-element` facade and JSX consumers do not need a direct scoped-package dependency.

## Development warnings

Duplicate-key and deprecated `innerHTML` / `textContent` warnings are compiled into the `development` export. The `production` and `default` exports omit them, and those files do not reference `process`.

Vite and webpack select `development` or `production` from the build mode. A consumer that ignores export conditions gets `default`, which is the production build.

Rollup needs the condition explicitly:

```js
import { nodeResolve } from "@rollup/plugin-node-resolve";

nodeResolve({ exportConditions: ["development"] });
```

esbuild needs it as an added condition:

```sh
esbuild app.js --bundle --conditions=development
```

Omit the condition for a production bundle.
