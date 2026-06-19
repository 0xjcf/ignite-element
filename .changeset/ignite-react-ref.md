---
"ignite-element": minor
---

Export `IgniteReactRef<Handle>` from `ignite-element/react` — the public type for naming the imperative ref of a component built by `igniteReact`.

`IgniteReactRef<typeof Handle>` resolves to the `CommandHandle` derived from the handle's command schema, so a consumer can type a `useRef` without hand-writing the command shape (and without drift from the element's commands):

```ts
import { type IgniteReactRef, igniteReact } from "ignite-element/react";
import { Counter as CounterEl } from "./counter.ignite";

const Counter = igniteReact(CounterEl);
const ref = useRef<IgniteReactRef<typeof CounterEl>>(null); // { increment; decrement; setLabel }
```

This closes a gap in the `ignite-element/react` entrypoint: `React.ComponentRef<typeof Counter>` resolves to `never` for the synthesized `forwardRef` component, so there was no clean way to name the ref type. Type-only and additive — no runtime change.
