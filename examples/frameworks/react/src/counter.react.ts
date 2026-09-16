import { type IgniteReactRef, igniteReact } from "ignite-element/react/web";
import { counterElement } from "./counter.ignite";

// Web-only interoperability: this wrapper controls the real custom element.
export const Counter = igniteReact(counterElement);

// The imperative ref type, co-located with the component. `IgniteReactRef<typeof
// counterElement>` resolves to the CommandHandle (increment/decrement/setLabel),
// so a consumer types a `useRef<CounterRef>` — no hand-written shape, no drift.
export type CounterRef = IgniteReactRef<typeof counterElement>;
