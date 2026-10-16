import { afterEach, describe, expect, it } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

afterEach(() => {
	document.body.replaceChildren();
});

function remount(
	first: Record<string, unknown>,
	second: Record<string, unknown>,
) {
	const host = document.createElement("div");
	const tree = mountIgniteJsx(host, jsx("div", first));
	const element = host.firstElementChild as HTMLDivElement;
	renderIgniteJsx(host, jsx("div", second), tree);
	return element;
}

describe("property sinks are keyed by the state they write", () => {
	it.each(["scrollTop", "scrollLeft"] as const)(
		"%s dropped for a different-case attribute spelling still resets the property",
		(key) => {
			const element = remount(
				{ [key]: 100 },
				{ [key.toUpperCase()]: "marker" },
			);
			expect(element[key]).toBe(0);
			expect(element.getAttribute(key.toLowerCase())).toBe("marker");
		},
	);

	it("indeterminate dropped for an attribute spelling resets the property", () => {
		const host = document.createElement("div");
		const tree = mountIgniteJsx(host, jsx("input", { indeterminate: true }));
		const input = host.firstElementChild as HTMLInputElement;
		expect(input.indeterminate).toBe(true);
		renderIgniteJsx(host, jsx("input", { INDETERMINATE: "x" }), tree);
		expect(input.indeterminate).toBe(false);
	});

	it("media muted dropped for an attribute spelling is restored", () => {
		const host = document.createElement("div");
		const tree = mountIgniteJsx(host, jsx("video", { muted: true }));
		const video = host.firstElementChild as HTMLVideoElement;
		expect(video.muted).toBe(true);
		renderIgniteJsx(host, jsx("video", { MUTED: "m" }), tree);
		expect(video.muted).toBe(false);
		expect(video.getAttribute("muted")).toBe("m");
	});
});

describe("a throwing custom setter does not abort the render", () => {
	let counter = 0;
	function defineThrowing() {
		const tag = `throwing-setter-${counter++}`;
		class El extends HTMLElement {
			#mode = "ok";
			get mode() {
				return this.#mode;
			}
			set mode(value: string) {
				if (value === "invalid") throw new Error("invalid mode");
				this.#mode = value;
			}
		}
		customElements.define(tag, El);
		return tag;
	}

	it("commits later props, children and refs after an update throws", () => {
		const tag = defineThrowing();
		const host = document.createElement("div");
		const tree = mountIgniteJsx(host, jsx(tag, { mode: "a" }));
		const element = host.firstElementChild as HTMLElement & { mode: string };
		let ref: Element | null = null;
		renderIgniteJsx(
			host,
			jsx(tag, {
				mode: "invalid",
				title: "later",
				ref: (node: Element | null) => {
					ref = node;
				},
				children: jsx("span", { children: "child" }),
			}),
			tree,
		);
		expect(element.mode).toBe("a");
		expect(element.title).toBe("later");
		expect(element.querySelector("span")?.textContent).toBe("child");
		expect(ref).toBe(element);
	});

	it("keeps the render alive for any mix of throwing and valid values", async () => {
		const fc = await import("fast-check");
		const tag = defineThrowing();
		fc.assert(
			fc.property(
				fc.array(fc.constantFrom("invalid", "x", "y"), {
					minLength: 1,
					maxLength: 5,
				}),
				(modes) => {
					const host = document.createElement("div");
					const tree = mountIgniteJsx(host, jsx(tag, { mode: "a" }));
					const element = host.firstElementChild as HTMLElement;
					let t = tree;
					modes.forEach((mode, i) => {
						t =
							renderIgniteJsx(host, jsx(tag, { mode, title: `t${i}` }), t) ?? t;
						expect(element.title).toBe(`t${i}`);
					});
				},
			),
			{ numRuns: 25 },
		);
	});
});
