import { type IgniteReactRef, igniteReact } from "ignite-element/react";
import { counterElement } from "./counter.ignite";

// The React binding for the framework-neutral `counterElement` (counter.ignite).
// One line turns the ignite element into a typed React component — no
// hand-written element interface, no JSX module augmentation, no scattered
// refs/listeners in app code. The element itself stays neutral: a Vue app would
// call `igniteVue(counterElement)` on the same handle. No JSX is authored here,
// so this is a plain `.ts` module on the React side of the boundary.
export const Counter = igniteReact(counterElement);

// The imperative ref type, co-located with the component. `IgniteReactRef<typeof
// counterElement>` resolves to the CommandHandle (increment/decrement/setLabel),
// so a consumer types a `useRef<CounterRef>` — no hand-written shape, no drift.
export type CounterRef = IgniteReactRef<typeof counterElement>;
