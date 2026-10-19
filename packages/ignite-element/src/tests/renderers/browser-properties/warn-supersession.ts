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

// Round 20: the final focus lookup of a keyed update is user code (getRootNode
// on a custom parent). Nothing after it checks ownership but the publish.
export function focusSupersedes(): string[] {
	const root = document.createElement("div");
	document.body.append(root);
	const published: string[] = [];
	let tree1: ReturnType<typeof renderIgniteJsx>;
	let armed = false;
	let lookups = 0;
	customElements.define(
		"x-r20-parent",
		class extends HTMLElement {
			getRootNode(options?: GetRootNodeOptions) {
				// The first lookup starts the keyed patch; the second is the final one.
				if (armed && ++lookups === 2) {
					renderIgniteJsx(root, list(["c"]), tree1, {
						onTreePublished: () => void published.push("newer"),
					});
				}
				return super.getRootNode(options);
			}
		},
	);
	const list = (keys: string[]) =>
		jsx("x-r20-parent", {
			children: keys.map((key) => jsx("li", {}, key)),
		});
	tree1 = renderIgniteJsx(root, list(["a", "b"]), undefined, {});
	armed = true;
	renderIgniteJsx(root, list(["b", "a"]), tree1, {
		onTreePublished: () => void published.push("older"),
	});
	return published;
}
