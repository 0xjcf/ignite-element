# React and React Native bindings

Current beta.14 usage is maintained in the [Views handbook](site/src/content/docs/handbook/views.mdx)
and [API reference](site/src/content/docs/handbook/api.mdx).

Use `const ctx = useIgnite(core)` from `ignite-element/react` for React-owned and
React Native views. Shared cores are ready at construction; isolated runtime
acquisition remains explicit outside rendering. Commands retain their ordinary
return values and promises. The hook releases its own subscription on unmount.

Use `igniteReact(handle)` from `ignite-element/react/web` only when hosting a real
custom element. Its typed ref controls that element, and declared callbacks
receive flat detail. Source and owner lifetime remain separate from view lifetime.

[Events and effects](site/src/content/docs/handbook/events.mdx) define activation,
source-scoped evaluation, synchronous-void callbacks, queued timing and errors.
There is no renderer/framework commit guarantee. Presentation resources belong
to framework lifecycle facilities. SSR, hydration, and Vue/Solid bindings are
not implemented; native Jest/type coverage does not establish device acceptance.
