/** @jsxImportSource react */
import { useIgnite } from "ignite-element/react";
import { core } from "./counter-core";
import "./counters.css";

export function Counter() {
	const ctx = useIgnite(core);
	return (
		<section className="counter-card" aria-label="Shared counter">
			<p>
				{ctx.label}: <output aria-label="Count">{ctx.count}</output>
			</p>
			<div className="counter-controls">
				<button type="button" onClick={() => ctx.decrement()}>
					Decrement
				</button>
				<button
					type="button"
					disabled={!ctx.canIncrement}
					onClick={() => ctx.increment()}
				>
					Increment
				</button>
			</div>
			<label>
				Counter label
				<input
					value={ctx.label}
					onChange={(event) => ctx.setLabel(event.target.value)}
				/>
			</label>
		</section>
	);
}
export function SharedCounters() {
	return (
		<div className="ignite-counter-demo">
			<div className="counter-grid">
				<Counter />
				<Counter />
			</div>
		</div>
	);
}
