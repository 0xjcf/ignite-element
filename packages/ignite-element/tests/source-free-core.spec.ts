import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type * as RootApi from "../src/index";
import type * as JsxApi from "../src/jsx/index";

const fixture = fileURLToPath(new URL("./source-free.html", import.meta.url));
const rootUrl = `/@fs${fileURLToPath(new URL("../src/index.ts", import.meta.url))}`;
const jsxUrl = `/@fs${fileURLToPath(new URL("../src/jsx/index.ts", import.meta.url))}`;

test("source-free composition retains real browser DOM without lifecycle hooks", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	await page.goto(`/@fs${fixture}`);
	const result = await page.evaluate(
		async ({ rootUrl, jsxUrl }) => {
			const browserGlobals = [
				HTMLElement,
				customElements,
				document,
				window,
				EventTarget,
				Event,
				CustomEvent,
			];
			const api: typeof RootApi = await import(rootUrl);
			const jsxApi: typeof JsxApi = await import(jsxUrl);
			const { jsx, jsxs } = jsxApi;
			const flush = () =>
				new Promise<void>((resolve) => queueMicrotask(resolve));
			const core = api.igniteCore();
			let renders = 0;
			let clicks = 0;
			const render = () => {
				renders += 1;
				return jsxs(jsxApi.Fragment, {
					children: [
						jsx("style", { children: ":host{display:grid}" }),
						jsx("button", {
							type: "button",
							onClick: () => {
								clicks += 1;
							},
							children: "Run",
						}),
						jsx("input", { value: "initial" }),
						jsx("slot", {}),
					],
				});
			};
			core("browser-layout", render);
			const synchronous =
				typeof customElements.get("browser-layout") === "function";
			const firstConstructor = customElements.get("browser-layout");
			core("browser-layout", () => {
				throw new Error("duplicate registration replaced renderer");
			});
			const duplicatePreserved =
				customElements.get("browser-layout") === firstConstructor;
			core("browser-layout-two", render);
			const hosts = [
				"browser-layout",
				"browser-layout",
				"browser-layout-two",
			].map((name) => document.createElement(name));
			const child = document.createElement("span");
			hosts[0].append(child);
			document.body.append(...hosts);
			const input = hosts[0].shadowRoot?.querySelector("input");
			if (!input) throw new Error("Input did not mount");
			input.value = "retained";
			hosts[0].shadowRoot?.querySelector("button")?.click();
			const slotAssigned =
				hosts[0].shadowRoot?.querySelector("slot")?.assignedElements()[0] ===
				child;
			const rootless = hosts[0].shadowRoot?.children.length === 4;
			const parent = document.createElement("section");
			document.body.append(parent);
			parent.append(hosts[0]);
			await flush();
			hosts[0].remove();
			await flush();
			parent.append(hosts[0]);
			hosts[0].shadowRoot?.querySelector("button")?.click();
			const retained =
				hosts[0].shadowRoot?.querySelector("input") === input &&
				input.value === "retained";
			const independent =
				hosts[1].shadowRoot?.querySelector("input")?.value === "initial" &&
				hosts[2].shadowRoot?.querySelector("input") !== input;
			let attempts = 0;
			core("browser-recovery", () => {
				if (++attempts === 1) throw new Error("controlled mount failure");
				return jsx("p", { children: "recovered" });
			});
			const retry = document.createElement("browser-recovery");
			document.body.append(retry);
			retry.remove();
			await flush();
			document.body.append(retry);
			retry.remove();
			await flush();
			document.body.append(retry);
			const recovered =
				retry.shadowRoot?.textContent === "recovered" && attempts === 2;
			document.body.replaceChildren();
			return {
				synchronous,
				duplicatePreserved,
				globalsPreserved: browserGlobals.every(
					(value, index) =>
						value ===
						[
							HTMLElement,
							customElements,
							document,
							window,
							EventTarget,
							Event,
							CustomEvent,
						][index],
				),
				slotAssigned,
				rootless,
				retained,
				independent,
				recovered,
				renders,
				clicks,
				noShell: !("igniteShell" in api),
			};
		},
		{ rootUrl, jsxUrl },
	);
	expect(result).toEqual({
		synchronous: true,
		duplicatePreserved: true,
		globalsPreserved: true,
		slotAssigned: true,
		rootless: true,
		retained: true,
		independent: true,
		recovered: true,
		renders: 3,
		clicks: 2,
		noShell: true,
	});
	expect(errors).toHaveLength(1);
	expect(errors[0]).toContain("Initial source-free mount failed");
});
