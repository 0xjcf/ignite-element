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

	it("does not let an approval for zero authorize signed zero", async () => {
		const home = createHome();
		const authority = createCommandApprovalAuthority("ada");
		const closed = { room: "living", percent: 0 };
		const signed = { room: "living", percent: -0 };
		expect(canonicalCall("setBlinds", closed)).not.toBe(
			canonicalCall("setBlinds", signed),
		);
		authority.grant({
			actor: "ada",
			name: "setBlinds",
			input: closed,
			target: home,
			id: "blinds-zero",
			expiresAt: Date.now() + 60_000,
		});
		const { run } = igniteTools({
			core: home,
			schema: homeToolSchema,
			canExecute: authority.canExecute,
		});
		expect((await run({ name: "setBlinds", input: signed })).ok).toBe(false);
		expect((await run({ name: "setBlinds", input: closed })).ok).toBe(true);
	});

	it("tags numbers with Object.is so signed zero and non-finite values stay distinct", () => {
		expect(canonicalCall("n", 0)).not.toBe(canonicalCall("n", -0));
		expect(canonicalCall("n", Number.POSITIVE_INFINITY)).not.toBe(
			canonicalCall("n", Number.NEGATIVE_INFINITY),
		);
		expect(canonicalCall("n", [1, undefined, 2])).not.toBe(
			canonicalCall("n", [1, null, 2]),
		);
		expect(canonicalCall("n", { a: 1, b: undefined })).not.toBe(
			canonicalCall("n", { a: 1 }),
		);
	});

	it("prunes expired approvals, spent ids, and empty target buckets", async () => {
		let clock = 1_000;
		const home = createHome();
		const authority = createCommandApprovalAuthority("ada", () => clock);
		authority.grant({
			actor: "ada",
			name: "setThermostat",
			input: livingAt70,
			target: home,
			id: "short",
			expiresAt: 1_500,
		});
		const { run } = igniteTools({
			core: home,
			schema: homeToolSchema,
			canExecute: authority.canExecute,
		});
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			true,
		);
		expect(authority.ledger()).toEqual({ targets: 0, pending: 0, spent: 1 });
		clock = 1_500;
		expect(authority.ledger()).toEqual({ targets: 0, pending: 0, spent: 0 });
		authority.grant({
			actor: "ada",
			name: "setThermostat",
			input: livingAt70,
			target: home,
			id: "short",
			expiresAt: 2_000,
		});
		expect((await run({ name: "setThermostat", input: livingAt70 })).ok).toBe(
			true,
		);
	});

	it("drops an expired pending approval and its empty target bucket", () => {
		let clock = 1_000;
		const home = createHome();
		const authority = createCommandApprovalAuthority("ada", () => clock);
		authority.grant({
			actor: "ada",
			name: "setThermostat",
			input: livingAt70,
			target: home,
			id: "expire",
			expiresAt: 1_200,
		});
		expect(authority.ledger()).toEqual({ targets: 1, pending: 1, spent: 0 });
		clock = 1_200;
		expect(authority.ledger()).toEqual({ targets: 0, pending: 0, spent: 0 });
		expect(authority.canExecute("setThermostat")).toBe(false);
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
