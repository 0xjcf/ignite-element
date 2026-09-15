/** @jsxImportSource ignite-element/jsx */
import { core } from "./event-counter";

export const CounterElement = core("app-counter", (ctx) => (
	<section>
		<p>Count: {ctx.count}</p>
		<button type="button" onClick={() => ctx.increment()}>
			Increment
		</button>
		<button type="button" onClick={() => ctx.reset()}>
			Reset
		</button>
	</section>
));
