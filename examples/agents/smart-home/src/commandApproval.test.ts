import { igniteTools } from "ignite-element/tools";
import { describe, expect, it } from "vitest";
import {
	canonicalCall,
	createCommandApprovalAuthority,
} from "./commandApproval";
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

	it("does not let a colliding-looking thermostat pair authorize each other", async () => {
		const first = { room: "living", temp: 72.64085799455643 };
		const second = { room: "living", temp: 72.36914675682783 };
		expect(canonicalCall("setThermostat", first)).not.toBe(
			canonicalCall("setThermostat", second),
		);
		const run = bind(first, "temp-a");
		expect((await run({ name: "setThermostat", input: second })).ok).toBe(
			false,
		);
		expect((await run({ name: "setThermostat", input: first })).ok).toBe(true);
	});

	it("allows a later approval with a new id for the same call", async () => {
		const home = createHome();
		const authority = createCommandApprovalAuthority("ada");
		const grant = (id: string) =>
			authority.grant({
				actor: "ada",
				name: "setThermostat",
				input: livingAt70,
				target: home,
				id,
				expiresAt: Date.now() + 60_000,
			});
		grant("first");
		const { run } = igniteTools({
			core: home,
			schema: homeToolSchema,
			canExecute: authority.canExecute,
		});
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			true,
		);
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			false,
		);
		grant("second");
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			true,
		);
	});

	it("does not consume an approval when resolveCall validates the call", async () => {
		const home = createHome();
		const authority = createCommandApprovalAuthority("ada");
		authority.grant({
			actor: "ada",
			name: "setThermostat",
			input: livingAt70,
			target: home,
			id: "preview",
			expiresAt: Date.now() + 60_000,
		});
		const tools = igniteTools({
			core: home,
			schema: homeToolSchema,
			canExecute: authority.canExecute,
		});
		expect(tools.resolveCall("setThermostat", livingAt70).ok).toBe(true);
		expect(
			(await tools.run({ name: "setThermostat", input: livingAt70 })).ok,
		).toBe(true);
	});
});
