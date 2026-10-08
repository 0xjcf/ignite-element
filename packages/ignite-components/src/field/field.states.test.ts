// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { fieldContract } from "./field.contract";
import { createFieldCore, fieldProjection } from "./field.core";
import { type FieldFixtureInput, fieldGallery } from "./field.gallery";

async function show(input: FieldFixtureInput) {
	const core = createFieldCore();
	core.watch(() => {});
	await core.execute({ command: "setLabel", input: input.label });
	await core.execute({ command: "setValue", input: input.value });
	await core.execute({ command: "setHint", input: input.hint });
	await core.execute({ command: "setError", input: input.error });
	await core.execute({
		command: "setRequired",
		input: input.required ? "true" : "false",
	});
	await core.execute({
		command: "setMultiline",
		input: input.multiline ? "true" : "false",
	});
	if (input.touched) await core.execute({ command: "touch" });
	return core;
}

describe("Field states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(fieldContract, fieldGallery);
		expect(fieldContract.events).toEqual(["input", "touch"]);
		expect(fieldContract.slots).toEqual([]);
		for (const app of ["Twilight", "Booster Budget"] as const) {
			expect(fieldGallery.some((fixture) => fixture.app === app)).toBe(true);
		}
		for (const fixture of fieldGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.label).toBe(fixture.input.label);
				expect(states.value).toBe(fixture.input.value);
				expect(states.hint).toBe(fixture.input.hint);
				expect(states.error).toBe(fixture.input.error);
				expect(states.required).toBe(fixture.input.required);
				expect(states.multiline).toBe(fixture.input.multiline);
				expect(states.touched).toBe(fixture.input.touched);
				assertFlagReasons(states, fieldContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("keeps the exact draft and leaves the error until the host clears it", async () => {
		const core = await show({
			label: "Title",
			value: "",
			hint: "Short name.",
			error: "Title is required.",
			required: true,
			multiline: false,
			touched: true,
		});
		try {
			await core.execute({ command: "setValue", input: "  Buy milk  " });
			expect(core.get("states")).toMatchObject({
				state: "invalid",
				value: "  Buy milk  ",
				error: "Title is required.",
				showError: true,
			});
			await core.execute({ command: "setError", input: null });
			expect(core.get("states")).toMatchObject({
				state: "clean",
				value: "  Buy milk  ",
				error: null,
				showError: false,
				showErrorRefusal: "There is no error.",
			});
		} finally {
			core.dispose();
		}
	});

	it("treats a whitespace-only error as no error and keeps the draft", async () => {
		const core = await show({
			label: "Title",
			value: "  Buy milk  ",
			hint: "Short name.",
			error: "   ",
			required: true,
			multiline: false,
			touched: true,
		});
		try {
			expect(core.get("states")).toMatchObject({
				state: "clean",
				value: "  Buy milk  ",
				error: null,
				showError: false,
				showErrorRefusal: "There is no error.",
			});
			await core.execute({ command: "setError", input: "Title is required." });
			await core.execute({ command: "setError", input: " \n " });
			expect(core.get("states")).toMatchObject({
				state: "clean",
				value: "  Buy milk  ",
				error: null,
				isInvalid: false,
			});
		} finally {
			core.dispose();
		}
	});

	it("emits the exact draft once on input and the touch on blur", async () => {
		const core = createFieldCore();
		const inputs: string[] = [];
		const touches: string[] = [];
		core.on("input", (event) => {
			inputs.push(event.value);
		});
		core.on("touch", (event) => {
			touches.push(event.value);
		});
		try {
			core.watch(() => {});
			await core.execute({ command: "setError", input: "Title is required." });
			await core.execute({ command: "setValue", input: "  Buy milk  " });
			await core.execute({ command: "setValue", input: "  Buy milk  " });
			expect(core.get("states")).toMatchObject({
				state: "invalid",
				value: "  Buy milk  ",
				error: "Title is required.",
				touched: false,
			});
			expect(inputs).toEqual(["  Buy milk  "]);
			await core.execute({ command: "touch" });
			expect(touches).toEqual(["  Buy milk  "]);
			expect(core.get("states")).toMatchObject({
				touched: true,
				error: "Title is required.",
				value: "  Buy milk  ",
			});
		} finally {
			core.dispose();
		}
	});

	it("announces an error when it is set and when it is cleared", async () => {
		const core = createFieldCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "setLabel", input: "Title" });
			await core.execute({ command: "setHint", input: "   " });
			expect(core.get("states")).toMatchObject({
				hint: null,
				showHint: false,
				showHintRefusal: "There is no hint.",
			});
			await core.execute({ command: "setError", input: "Title is required." });
			expect(core.get("states")).toMatchObject({
				errorAnnouncement: "Title is required.",
				a11y: {
					cli: "error: Title is required.",
					mcp: {
						isError: true,
						errors: [
							{
								field: "Title",
								message: "Title is required.",
								hint: null,
							},
						],
					},
				},
			});
			await core.execute({ command: "setError", input: null });
			expect(core.get("states")).toMatchObject({
				state: "clean",
				error: null,
				errorAnnouncement: "Error cleared.",
				a11y: { cli: "Error cleared.", mcp: { isError: false, errors: [] } },
			});
		} finally {
			core.dispose();
		}
	});

	it("records CLI and MCP equivalents for the error region", () => {
		expect(fieldContract.a11y?.map((row) => row.mcp)).toEqual([
			"errors[{field, message, hint}].",
			"Whitespace hint stays in the schema description only when it has words.",
			"One errors entry per field.",
			"instanceId in the result.",
		]);
	});

	it("accepts the igniteCore commands facade", () => {
		const sent: unknown[] = [];
		fieldProjection
			.commands({
				source: {
					send: (event) => {
						sent.push(event);
					},
				},
			})
			.setValue("Buy milk");
		expect(sent).toEqual([{ type: "SET_VALUE", value: "Buy milk" }]);
	});
});
