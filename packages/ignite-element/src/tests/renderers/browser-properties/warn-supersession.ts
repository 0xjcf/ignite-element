import { jsx } from "../../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../../../../ignite-renderer/src/renderers/jsx/renderer";

// Round 19: console.warn is user code. An override that renders a newer value
// on the same retained control must not be followed by the retired commit.
export function warnSupersedes(): { warned: number; value: string } {
	const root = document.createElement("div");
	document.body.append(root);
	const view = (a: string, b?: string) => [
		jsx("input", { value: a }),
		jsx("input", b === undefined ? {} : { value: b }),
	];
	const tree1 = renderIgniteJsx(root, view("a1", "b1"), undefined, undefined);
	const original = console.warn;
	let warned = 0;
	console.warn = () => {
		warned++;
		if (warned > 1) return;
		renderIgniteJsx(root, view("newer", "b1"), tree1, undefined);
	};
	try {
		renderIgniteJsx(root, view("older"), tree1, undefined);
	} finally {
		console.warn = original;
	}
	return {
		warned,
		value: (root.querySelector("input") as HTMLInputElement).value,
	};
}
