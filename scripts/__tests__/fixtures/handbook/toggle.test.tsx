/** @jsxImportSource ignite-element/jsx */
import { expect, it } from "vitest";
import { within } from "@testing-library/dom";
import { core, source } from "./toggle";

it("renders source-derived state and responds to a native control", async () => {
	const host = document.createElement("ignite-toggle");
	try {
		document.body.append(host);
		const root = host.shadowRoot?.querySelector("section");
		if (!root) throw new Error("Toggle did not render a shadow root");
		const controls = within(root);
		controls.getByRole("button", { name: "Off" }).click();
		await Promise.resolve();
		expect(core.get("states").isOn).toBe(true);
		expect(controls.getByRole("button", { name: "On" })).toBeDefined();
		controls.getByRole("button", { name: "On" }).click();
		await Promise.resolve();
		expect(core.get("states").isOn).toBe(false);
	} finally {
		host.remove();
		try {
			core.dispose();
		} finally {
			source.stop();
		}
	}
});
