import { afterEach, describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { igniteCore } from "../../xstate";

const flushDisconnect = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

afterEach(() => {
	document.body.replaceChildren();
});

describe("public igniteCore host disconnect", () => {
	it("calls a void ref with null exactly once after the host disconnects", async () => {
		const calls: Array<Element | null> = [];
		const ref = (element: Element | null) => {
			calls.push(element);
		};
		const { element, input } = mountHost(ref);

		element.remove();
		await flushDisconnect();
		await flushDisconnect();

		expect(calls).toEqual([input, null]);
	});

	it("runs a returned disposer exactly once and does not also call ref(null)", async () => {
		const calls: string[] = [];
		const ref = (element: Element | null) => {
			if (!element) {
				calls.push("null");
				return;
			}
			calls.push("element");
			return () => {
				calls.push("dispose");
			};
		};
		const { element } = mountHost(ref);

		element.remove();
		await flushDisconnect();
		await flushDisconnect();

		expect(calls).toEqual(["element", "dispose"]);
	});
});

function mountHost(ref: (element: Element | null) => unknown) {
	const core = igniteCore({ source: createMachine({}) });
	const name = `public-host-ref-${crypto.randomUUID()}`;
	core(name, () => jsx("input", { ref, "aria-label": "hosted" }));
	const element = document.createElement(name);
	document.body.append(element);
	const input = element.shadowRoot?.querySelector("input");
	if (!input) throw new Error("expected the public host to render the input");
	return { element, input };
}
