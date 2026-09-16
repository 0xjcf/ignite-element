import { useIgnite } from "ignite-element/react";
import { core } from "./counter-core";

export function Counter() {
	const ctx = useIgnite(core);
	return (
		<section aria-label="Shared counter">
			<p>
				{ctx.label}: <output aria-label="Count">{ctx.count}</output>
			</p>
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
		<>
			<Counter />
			<Counter />
		</>
	);
}
// Final application teardown: core.dispose(); source.stop();
