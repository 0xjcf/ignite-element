import { igniteTools } from "ignite-element/tools";
import { describe, expect, it } from "vitest";
import { createCommandApprovalAuthority } from "./commandApproval";
import { createHome, homeToolSchema } from "./home";

const livingAt70 = { room: "living", temp: 70 };
const livingAt72 = { room: "living", temp: 72 };

function bind(input: unknown, id: string) {
	const home = createHome();
	const authority = createCommandApprovalAuthority("ada");
	authority.grant({
		actor: "ada",
		name: "setThermostat",
		input,
		target: home,
		id,
		expiresAt: Date.now() + 60_000,
	});
	const { run } = igniteTools({
		core: home,
		schema: homeToolSchema,
		canExecute: authority.canExecute,
	});
	return run;
}

describe("app-owned command approvals", () => {
	it("does not let an approval for input A authorize input B", async () => {
		const run = bind(livingAt70, "temp-70");
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			true,
		);
		expect((await run({ name: "setThermostat", input: livingAt72 })).ok).toBe(
			false,
		);
	});

	it("denies reuse of the same name and validated input", async () => {
		const run = bind(livingAt70, "once");
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			true,
		);
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			false,
		);
	});
});
