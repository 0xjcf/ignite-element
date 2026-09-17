/** @jsxImportSource react */
import { useState } from "react";
import { Counter } from "./counter.react";
import "../counters.css";

export function WebInterop() {
	const [count, setCount] = useState<number | null>(null);
	const parity = count === null ? undefined : count % 2 === 0 ? "even" : "odd";

	return (
		<section
			className="ignite-counter-demo"
			aria-label="Custom-element interoperability"
		>
			<div className="counter-grid">
				<Counter onCountChanged={({ count }) => setCount(count)} />
				<output
					className="event-status"
					aria-label="React event status"
					data-parity={parity}
				>
					{count === null
						? "Waiting for an event."
						: `React received: ${count} — ${parity === "even" ? "Even" : "Odd"}`}
				</output>
			</div>
		</section>
	);
}
