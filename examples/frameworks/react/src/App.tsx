import { SharedCounters } from "../shared-counter";
import { WebInterop } from "./WebInterop";

export function App() {
	return (
		<main className="app">
			<h1>One source, two React views</h1>
			<p>Both counters read state and call commands through useIgnite(core).</p>
			<SharedCounters />
			<details>
				<summary>Advanced: host a real custom element in React</summary>
				<WebInterop />
			</details>
		</main>
	);
}
