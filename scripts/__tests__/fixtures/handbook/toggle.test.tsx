/** @jsxImportSource ignite-element/jsx */
import { expect, it } from "vitest";
import { within } from "@testing-library/dom";
import { core } from "./light-switch";

it("derives each light's label and flip count from its independent source", async () => {
	const host = document.createElement("ignite-light-switch");
	const sibling = document.createElement("ignite-light-switch");
	try {
		document.body.append(host, sibling);
		const root = host.shadowRoot?.querySelector("section");
		const siblingRoot = sibling.shadowRoot?.querySelector("section");
		if (!root || !siblingRoot) throw new Error("Light switches did not render");
		const controls = within(root);
		const siblingControls = within(siblingRoot);
		const firstSwitch = controls.getByRole("switch", { name: "Light" });
		const secondSwitch = siblingControls.getByRole("switch", { name: "Light" });
		expect(firstSwitch.getAttribute("aria-checked")).toBe("false");
		expect(controls.getByText("Off")).toBeDefined();
		expect(controls.getByText("Toggled: 0")).toBeDefined();
		firstSwitch.click();
		await Promise.resolve();
		expect(firstSwitch.getAttribute("aria-checked")).toBe("true");
		expect(controls.getByText("On")).toBeDefined();
		expect(controls.getByText("Toggled: 1")).toBeDefined();
		expect(secondSwitch.getAttribute("aria-checked")).toBe("false");
		expect(siblingControls.getByText("Off")).toBeDefined();
		expect(siblingControls.getByText("Toggled: 0")).toBeDefined();
		firstSwitch.click();
		await Promise.resolve();
		expect(firstSwitch.getAttribute("aria-checked")).toBe("false");
		expect(controls.getByText("Off")).toBeDefined();
		expect(controls.getByText("Toggled: 2")).toBeDefined();
		secondSwitch.click();
		await Promise.resolve();
		expect(secondSwitch.getAttribute("aria-checked")).toBe("true");
		expect(siblingControls.getByText("On")).toBeDefined();
		expect(siblingControls.getByText("Toggled: 1")).toBeDefined();
		expect(controls.getByText("Toggled: 2")).toBeDefined();
	} finally {
		host.remove();
		sibling.remove();
		core.dispose();
	}
});
