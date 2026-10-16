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
