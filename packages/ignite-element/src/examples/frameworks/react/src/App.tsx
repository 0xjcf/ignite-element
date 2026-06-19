import { igniteReact } from "ignite-element/react";
import { useRef, useState } from "react";
import { Counter as CounterEl } from "./counter.ignite";

// The entire wrapper: one line turns the ignite element into a typed React
// component. No hand-written element interface, no JSX module augmentation, no
// scattered refs/listeners in app code.
const Counter = igniteReact(CounterEl);

export function App() {
	// `count` mirrors the element's outward event — App stays declarative.
	const [count, setCount] = useState(0);
	const [label, setLabel] = useState("Visitors");
	// The ref is the typed CommandHandle: increment/decrement/setLabel.
	const counterRef = useRef<{
		increment: () => void;
		decrement: () => void;
		setLabel: (label: string) => void;
	}>(null);

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
