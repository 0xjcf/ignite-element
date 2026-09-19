import { within } from "@testing-library/dom";
import { expect, it } from "vitest";
import { counter } from "./agent-counter";
import { source, thermostat } from "./thermostat";
import { thermostatToolSchema } from "./thermostat-tools";
import "./agent-counter-view";
import "./thermostat-view";

it("the thermostat's headless and rendered consumers share the supplied actor", async () => {
	const host = document.createElement("thermostat-panel");
	document.body.append(host);
	try {
		if (!host.shadowRoot) throw new Error("Thermostat did not render");
		const panel = host.shadowRoot.querySelector("form");
		if (!panel) throw new Error("Thermostat form missing");
		const ui = within(panel);
		await thermostat.execute({ command: "setTargetDraft", input: 72 });
		const slider = ui.getByRole("slider");
		if (!(slider instanceof HTMLInputElement))
			throw new Error("Thermostat slider missing");
		expect(slider.value).toBe("72");
		expect(thermostat.get("schema").commands?.saveTarget).toEqual({
			input: null,
		});
		expect(thermostatToolSchema.commands.saveTarget.description).toBe(
			"Save the target temperature.",
		);
		ui.getByRole("button", { name: "Save target" }).click();
		expect(thermostat.get("states").canSave).toBe(false);
		source.send({ type: "SAVE_SUCCESS" });
		expect(thermostat.get("states").canSave).toBe(true);
		host.remove();
		expect(source.getSnapshot().status).toBe("active");
	} finally {
		host.remove();
		try {
			thermostat.dispose();
		} finally {
			source.stop();
		}
	}
});

it("the agent guide has real command prerequisites and separate machine-backed headless state", async () => {
	const host = document.createElement("counter-panel");
	document.body.append(host);
	try {
		await counter.execute({ command: "setLimit", input: 6 });
		for (let step = 0; step < 20 && !counter.get("states").isLimited; step += 1)
			await counter.execute({ command: "increment" });
		expect(counter.get("states")).toMatchObject({
			count: 6,
			limit: 6,
			isLimited: true,
		});
		if (!host.shadowRoot) throw new Error("Counter did not render");
		const panel = host.shadowRoot.querySelector("section");
		if (!panel) throw new Error("Counter section missing");
		const ui = within(panel);
		expect(host.shadowRoot.textContent).toContain("0 / 5");
		ui.getByRole("button", { name: "Increment" }).click();
		expect(host.shadowRoot.textContent).toContain("1 / 5");
		expect(counter.get("states").count).toBe(6);
		expect(ui.getByRole("slider", { name: "Count limit" })).toBeDefined();
	} finally {
		host.remove();
		counter.dispose();
	}
});

it("the complete headless module runs and disposes without missing prerequisites", async () => {
	await import("./headless-toggle");
});
