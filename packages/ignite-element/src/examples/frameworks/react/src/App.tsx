import { useRef, useState } from "react";
import { Counter, type CounterRef } from "./counter.react";

export function App() {
	// `count` mirrors the element's outward event — App stays declarative.
	const [count, setCount] = useState(0);
	const [label, setLabel] = useState("Visitors");
	// `CounterRef` (from counter.react) is `IgniteReactRef<typeof counterElement>`
	// — the CommandHandle (increment/decrement/setLabel). No hand-written shape,
	// no drift from the element's commands.
	const counterRef = useRef<CounterRef>(null);

	return (
		<main className="app">
			<h1>ignite-element + React</h1>
			<p className="lede">
				A single <code>igniteReact(handle)</code> call generates an idiomatic,
				typed React component from the schema. Props go in, events come out,
				commands run through the ref — all without hand-written glue.
			</p>

			{/* label -> setLabel attribute/command; onCountChanged <- emitted event */}
			<Counter
				ref={counterRef}
				label={label}
				onCountChanged={(event) => setCount(event.count)}
			/>

			<p className="mirror">
				React mirror of the element's emitted count: <strong>{count}</strong>
			</p>

			<div className="controls">
				<button type="button" onClick={() => counterRef.current?.decrement()}>
					-
				</button>
				<button type="button" onClick={() => counterRef.current?.increment()}>
					+
				</button>
			</div>

			<label className="label-field">
				Element label
				<input
					value={label}
					onChange={(event) => setLabel(event.target.value)}
					placeholder="Set the element label"
				/>
			</label>
		</main>
	);
}
