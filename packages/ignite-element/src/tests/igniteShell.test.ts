import { describe, expect, it, vi } from "vitest";
import { igniteShell } from "../index";
import { Fragment, jsx, jsxs } from "../renderers/jsx/jsx-runtime";

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("igniteShell", () => {
	it("renders direct shadow-root children without the ignite-jsx wrapper", () => {
		let clicks = 0;
		const register = igniteShell();
		const name = `ignite-shell-rootless-${crypto.randomUUID()}`;

		register(name, () =>
			jsxs(Fragment, {
				children: [
					jsx("style", { children: ":host{display:block}" }),
					jsx("button", {
						type: "button",
						onClick: () => {
							clicks += 1;
						},
						children: "Run",
					}),
					jsx("section", { id: "content", children: "Ready" }),
				],
			}),
		);

		const element = document.createElement(name);
		document.body.appendChild(element);

		const root = element.shadowRoot;
		expect(root?.querySelector("[data-ignite-jsx-root]")).toBeNull();
		expect(root?.children[0]?.tagName).toBe("STYLE");
		expect(root?.children[1]?.tagName).toBe("BUTTON");
		expect(root?.children[2]?.tagName).toBe("SECTION");

		root?.querySelector("button")?.dispatchEvent(new MouseEvent("click"));
		expect(clicks).toBe(1);

		element.remove();
	});

	it("runs onConnect once and defers teardown until true disconnect", async () => {
		const teardown = vi.fn();
		const onConnect = vi.fn(() => teardown);
		const register = igniteShell({ onConnect });
		const name = `ignite-shell-lifecycle-${crypto.randomUUID()}`;

		register(name, () => jsx("div", { children: "Shell" }));

		const firstParent = document.createElement("div");
		const secondParent = document.createElement("div");
		const element = document.createElement(name);
		document.body.append(firstParent, secondParent);

		firstParent.appendChild(element);
		expect(onConnect).toHaveBeenCalledTimes(1);
		expect(onConnect).toHaveBeenCalledWith({
			element,
			shadowRoot: element.shadowRoot,
		});

		secondParent.appendChild(element);
		await flushMicrotasks();

		expect(onConnect).toHaveBeenCalledTimes(1);
		expect(teardown).not.toHaveBeenCalled();

		element.remove();
		await flushMicrotasks();

		expect(teardown).toHaveBeenCalledTimes(1);
		firstParent.remove();
		secondParent.remove();
	});

	it("contains deferred teardown errors and resets lifecycle state", async () => {
		const teardownError = new Error("teardown failed");
		const teardown = vi.fn(() => {
			throw teardownError;
		});
		const onConnect = vi.fn(() => teardown);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const register = igniteShell({ onConnect });
		const name = `ignite-shell-teardown-error-${crypto.randomUUID()}`;

		register(name, () => jsx("div", { children: "Shell" }));

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(teardown).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			`[igniteShell] Deferred disconnect cleanup failed for "${name}".`,
			teardownError,
		);

		document.body.appendChild(element);
		expect(onConnect).toHaveBeenCalledTimes(2);
		element.remove();
		await flushMicrotasks();
	});

	it("contains initial render errors without marking the shell mounted", () => {
		const renderError = new Error("render failed");
		const render = vi.fn(() => {
			throw renderError;
		});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const register = igniteShell();
		const name = `ignite-shell-render-error-${crypto.randomUUID()}`;

		register(name, render);

		const element = document.createElement(name);
		document.body.appendChild(element);
		document.body.removeChild(element);
		document.body.appendChild(element);

		expect(render).toHaveBeenCalledTimes(2);
		expect(errorSpy).toHaveBeenCalledWith(
			`[igniteShell] Initial mount failed for "${name}".`,
			renderError,
		);
	});

	it("contains onConnect errors without marking the shell active", () => {
		const connectError = new Error("connect failed");
		const onConnect = vi.fn(() => {
			throw connectError;
		});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const register = igniteShell({ onConnect });
		const name = `ignite-shell-connect-error-${crypto.randomUUID()}`;

		register(name, () => jsx("div", { children: "Shell" }));

		const element = document.createElement(name);
		document.body.appendChild(element);
		document.body.removeChild(element);
		document.body.appendChild(element);

		expect(onConnect).toHaveBeenCalledTimes(2);
		expect(errorSpy).toHaveBeenCalledWith(
			`[igniteShell] onConnect failed for "${name}".`,
			connectError,
		);
	});
});
