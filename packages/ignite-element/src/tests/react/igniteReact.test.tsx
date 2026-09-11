/**
 * Behavioral tests for `igniteReact`. The wrapper is host-app coordination; we
 * exercise it against a real registered ignite element through jsdom.
 *
 * NOTE: this file uses `React.createElement` (no JSX) on purpose. The package's
 * test esbuild config compiles every `.tsx` with the ignite-jsx factory
 * (vitest.config.ts `jsxImportSource`), so JSX here would NOT produce React
 * elements. createElement keeps the test pragma-agnostic.
 */
import { act } from "@testing-library/react";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setup } from "xstate";
import { igniteCore } from "../../IgniteCore";
import { igniteReact } from "../../react/web";

const counterMachine = setup({
	types: {} as {
		context: { count: number; label: string };
		events:
			| { type: "INC" }
			| { type: "DEC" }
			| { type: "SET_LABEL"; label: string };
	},
}).createMachine({
	context: { count: 0, label: "" },
	on: {
		INC: { actions: () => {} },
		DEC: { actions: () => {} },
		SET_LABEL: { actions: () => {} },
	},
});

let tagSeq = 0;
const uniqueTag = () => `react-counter-${tagSeq++}`;

const containers: HTMLElement[] = [];
const roots: Root[] = [];

const mount = (element: React.ReactElement) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	containers.push(container);
	const root = createRoot(container);
	roots.push(root);
	act(() => {
		root.render(element);
	});
	return container;
};

afterEach(() => {
	for (const root of roots.splice(0)) {
		act(() => root.unmount());
	}
	for (const container of containers.splice(0)) {
		container.remove();
	}
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

describe("igniteReact behavior", () => {
	it("forwards online setters while declared outward callbacks remain listeners", async () => {
		const online = vi.fn();
		const label = vi.fn();
		const first = vi.fn();
		const second = vi.fn();
		const Counter = igniteCore({
			source: counterMachine,
			commands: () => ({
				setOnline(value: string) {
					online(value);
				},
				setLabel(value: string) {
					label(value);
				},
			}),
			events: (event) => ({ changed: event<{ value: string }>() }),
		})(uniqueTag(), () => null);
		const Wrapped = igniteReact(Counter);
		const props: React.ComponentProps<typeof Wrapped> = {
			online: "yes",
			label: "control",
			onChanged: first,
		};
		const container = mount(React.createElement(Wrapped, props));
		const element = container.querySelector(Counter.tagName);
		if (!element) throw Error("missing element");
		expect(element.getAttribute("online")).toBe("yes");
		expect(online).toHaveBeenCalledWith("yes");
		expect(label).toHaveBeenCalledWith("control");
		expect(element.hasAttribute("onChanged")).toBe(false);
		element.dispatchEvent(
			new CustomEvent("changed", { detail: { value: "one" } }),
		);
		expect(first).toHaveBeenCalledWith({ value: "one" });
		await act(async () => {
			roots[roots.length - 1].render(
				React.createElement(Wrapped, {
					online: "no",
					label: "next",
					onChanged: second,
				}),
			);
		});
		expect(online).toHaveBeenLastCalledWith("no");
		expect(label).toHaveBeenLastCalledWith("next");
		element.dispatchEvent(
			new CustomEvent("changed", { detail: { value: "two" } }),
		);
		expect(second).toHaveBeenCalledWith({ value: "two" });
		expect(first).toHaveBeenCalledOnce();
		act(() => roots[roots.length - 1].unmount());
		element.dispatchEvent(
			new CustomEvent("changed", { detail: { value: "late" } }),
		);
		expect(second).toHaveBeenCalledOnce();
	});
	it("fires on<Event> props with the flat event.detail payload", () => {
		const Counter = igniteCore({
			source: counterMachine,
			states: (snapshot) => ({
				count: snapshot.context.count,
				label: snapshot.context.label,
			}),
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
			events: (event) => ({
				countChanged: event<{ count: number }>(),
			}),
		})(uniqueTag(), ({ count }) => `${count}`);

		const ReactCounter = igniteReact(Counter);
		const onCountChanged = vi.fn();

		const container = mount(
			React.createElement(ReactCounter, { onCountChanged }),
		);
		const el = container.querySelector(Counter.tagName) as HTMLElement;
		expect(el).toBeTruthy();

		// Dispatch the same CustomEvent the host element would emit: detail is the
		// bare payload (effects emits) — NOT a { type, payload } envelope.
		act(() => {
			el.dispatchEvent(
				new CustomEvent("countChanged", { detail: { count: 7 } }),
			);
		});

		expect(onCountChanged).toHaveBeenCalledTimes(1);
		expect(onCountChanged).toHaveBeenCalledWith({ count: 7 });
	});

	it("removes its event listeners on unmount", () => {
		const Counter = igniteCore({
			source: counterMachine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
			events: (event) => ({
				countChanged: event<{ count: number }>(),
			}),
		})(uniqueTag(), ({ count }) => `${count}`);

		const ReactCounter = igniteReact(Counter);
		const onCountChanged = vi.fn();

		const container = mount(
			React.createElement(ReactCounter, { onCountChanged }),
		);
		const el = container.querySelector(Counter.tagName) as HTMLElement;
		const removeSpy = vi.spyOn(el, "removeEventListener");

		act(() => {
			roots[roots.length - 1].unmount();
		});

		expect(removeSpy).toHaveBeenCalledWith(
			"countChanged",
			expect.any(Function),
		);

		// A post-unmount dispatch must not reach the callback.
		el.dispatchEvent(new CustomEvent("countChanged", { detail: { count: 1 } }));
		expect(onCountChanged).not.toHaveBeenCalled();
	});

	it("invokes element command methods through the ref CommandHandle", () => {
		const incSpy = vi.fn();
		const Counter = igniteCore({
			source: counterMachine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ actor }) => ({
				increment: () => {
					incSpy();
					actor.send({ type: "INC" });
				},
			}),
		})(uniqueTag(), ({ count }) => `${count}`);

		const ReactCounter = igniteReact(Counter);
		const ref = React.createRef<{ increment: () => void }>();

		mount(React.createElement(ReactCounter, { ref }));

		expect(ref.current).toBeTruthy();
		act(() => {
			ref.current?.increment();
		});

		expect(incSpy).toHaveBeenCalledTimes(1);
	});

	it("maps a single-arg setX prop to the element attribute and command", () => {
		const setLabelSpy = vi.fn();
		const Counter = igniteCore({
			source: counterMachine,
			states: (snapshot) => ({ label: snapshot.context.label }),
			commands: ({ actor }) => ({
				setLabel: (label: string) => {
					setLabelSpy(label);
					actor.send({ type: "SET_LABEL", label });
				},
			}),
		})(uniqueTag(), ({ label }) => `${label}`);

		const ReactCounter = igniteReact(Counter);

		const container = mount(
			React.createElement(ReactCounter, { label: "Visitors" }),
		);
		const el = container.querySelector(Counter.tagName) as HTMLElement;

		// The de-prefixed `label` prop is set as the `label` attribute, which the
		// element's MutationObserver forwards to the setLabel command.
		expect(el.getAttribute("label")).toBe("Visitors");
		expect(setLabelSpy).toHaveBeenCalledWith("Visitors");
	});
});
