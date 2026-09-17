/** @jsxImportSource ignite-element/jsx */
import { expect, it } from "vitest";
import { within } from "@testing-library/dom";
import { core } from "./toggle";

it("keeps each element independent while commands update its own view", async () => {
	const host = document.createElement("ignite-toggle");
	const sibling = document.createElement("ignite-toggle");
	try {
		document.body.append(host, sibling);
		const root = host.shadowRoot?.querySelector("section");
		if (!root) throw new Error("Toggle did not render a shadow root");
		const siblingRoot = sibling.shadowRoot?.querySelector("section");
		if (!siblingRoot) throw new Error("Sibling toggle did not render");
		const controls = within(root);
		const siblingControls = within(siblingRoot);
		controls.getByRole("button", { name: "Off" }).click();
		await Promise.resolve();
		expect(siblingControls.getByRole("button", { name: "Off" })).toBeDefined();
		expect(controls.getByRole("button", { name: "On" })).toBeDefined();
		controls.getByRole("button", { name: "On" }).click();
		await Promise.resolve();
		expect(controls.getByRole("button", { name: "Off" })).toBeDefined();
		siblingControls.getByRole("button", { name: "Off" }).click();
		await Promise.resolve();
		expect(siblingControls.getByRole("button", { name: "On" })).toBeDefined();
		expect(controls.getByRole("button", { name: "Off" })).toBeDefined();
	} finally {
		host.remove();
		sibling.remove();
		core.dispose();
	}
});
