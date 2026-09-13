import { afterEach, describe, expect, it, vi } from "vitest";
import * as publicApi from "../index";
import { Fragment, jsx, jsxs } from "../renderers/jsx/jsx-runtime";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const tag = () => `source-free-${crypto.randomUUID()}`;

describe("source-free root igniteCore", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it.each([undefined, {}])("accepts empty configuration %j", (config) => {
		const core = publicApi.igniteCore(config);
		expect(typeof core).toBe("function");
		expect(Object.keys(core)).toEqual([]);
		for (const key of [
			"execute",
			"getSnapshot",
			"getStates",
			"watchStates",
			"subscribe",
			"dispose",
		]) {
			expect(key in core).toBe(false);
		}
	});

	it("exports the new constructor and retires the shell", () => {
		expect(typeof publicApi.igniteCore).toBe("function");
		expect("igniteShell" in publicApi).toBe(false);
	});

	it.each([
		null,
		false,
		0,
		"",
		[],
		() => {},
		new Date(),
		{ onConnect() {} },
		{ onConnect: undefined },
		{ source: undefined },
		{ source: null },
		{ source: {} },
		{ source: () => ({}) },
		{ states() {} },
		{ commands() {} },
		{ events() {} },
		{ effects() {} },
		{ cleanup: false },
		{ unknown: true },
		{ [Symbol("option")]: true },
		Object.defineProperty({}, "hidden", { value: true }),
		Object.create({ onConnect() {} }),
	])("rejects invalid configuration %#", (config) => {
		expect(() =>
			Reflect.apply(publicApi.igniteCore, undefined, [config]),
		).toThrow(/source-free.*configuration/i);
	});

	it("does not invoke configuration getters", () => {
		const getter = vi.fn();
		const config = Object.defineProperty({}, "source", { get: getter });
		expect(() =>
			Reflect.apply(publicApi.igniteCore, undefined, [config]),
		).toThrow(/source-free.*configuration/i);
		expect(getter).not.toHaveBeenCalled();
	});

	it("rejects extra constructor arguments", () => {
		expect(() =>
			Reflect.apply(publicApi.igniteCore, undefined, [{}, {}]),
		).toThrow(/source-free.*configuration/i);
	});

	it("mounts fragments, styles, slots and events without fabricated arguments", () => {
		const core = publicApi.igniteCore();
		const click = vi.fn();
		const render = vi.fn(() =>
			jsxs(Fragment, {
				children: [
					jsx("style", { children: ":host{display:grid}" }),
					jsx("button", { onClick: click, children: "Run" }),
					jsx("slot", {}),
				],
			}),
		);
		const name = tag();
		expect(core(name, render)).toBeUndefined();
		const element = document.createElement(name);
		const child = document.createElement("span");
		element.append(child);
		document.body.append(element);
		expect(render.mock.calls).toEqual([[]]);
		expect(
			element.shadowRoot?.querySelector("[data-ignite-jsx-root]"),
		).toBeNull();
		expect(
			Array.from(element.shadowRoot?.children ?? [], (node) => node.tagName),
		).toEqual(["STYLE", "BUTTON", "SLOT"]);
		expect(
			element.shadowRoot?.querySelector("slot")?.assignedElements(),
		).toEqual([child]);
		element.shadowRoot?.querySelector("button")?.click();
		expect(click).toHaveBeenCalledTimes(1);
	});

	it("retains each instance's DOM through moves and true disconnect/reconnect", async () => {
		const core = publicApi.igniteCore();
		const render = vi.fn(() => jsx("input", { value: "initial" }));
		const firstName = tag();
		const secondName = tag();
		core(firstName, render);
		core(secondName, render);
		const elements = [firstName, firstName, secondName].map((name) =>
			document.createElement(name),
		);
		document.body.append(...elements);
		const inputs = elements.map((element) =>
			element.shadowRoot?.querySelector("input"),
		);
		expect(new Set(inputs).size).toBe(3);
		const first = inputs[0];
		if (!first) throw new Error("Input must mount");
		first.value = "retained";
		const parent = document.createElement("section");
		document.body.append(parent);
		parent.append(elements[0]);
		await flush();
		elements[0].remove();
		await flush();
		parent.append(elements[0]);
		expect(elements[0].shadowRoot?.querySelector("input")).toBe(first);
		expect(first.value).toBe("retained");
		expect(inputs[1]?.value).toBe("initial");
		expect(render).toHaveBeenCalledTimes(3);
	});

	it("preserves duplicate registration and native name validation", () => {
		const core = publicApi.igniteCore();
		const name = tag();
		core(name, () => jsx("p", { children: "first" }));
		const duplicate = vi.fn();
		core(name, duplicate);
		const element = document.createElement(name);
		document.body.append(element);
		expect(element.shadowRoot?.textContent).toBe("first");
		expect(duplicate).not.toHaveBeenCalled();
		expect(() => core("invalid", () => null)).toThrow();
	});

	it("reports mount failure and retries until one successful mount", async () => {
		const error = new Error("controlled render failure");
		const render = vi
			.fn()
			.mockImplementationOnce(() => {
				throw error;
			})
			.mockImplementation(() => jsx("p", { children: "recovered" }));
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const core = publicApi.igniteCore();
		const name = tag();
		core(name, render);
		const element = document.createElement(name);
		document.body.append(element);
		expect(log).toHaveBeenCalledWith(
			`[igniteCore] Initial source-free mount failed for "${name}".`,
			error,
		);
		element.remove();
		await flush();
		document.body.append(element);
		expect(element.shadowRoot?.textContent).toBe("recovered");
		element.remove();
		await flush();
		document.body.append(element);
		expect(render).toHaveBeenCalledTimes(2);
	});
});
