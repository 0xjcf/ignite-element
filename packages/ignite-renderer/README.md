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
