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
