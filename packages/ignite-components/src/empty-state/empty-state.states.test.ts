// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { emptyStateContract } from "./empty-state.contract";
import { createEmptyStateCore } from "./empty-state.core";
import {
	type EmptyStateFixtureInput,
	emptyStateGallery,
} from "./empty-state.gallery";

async function show(input: EmptyStateFixtureInput) {
	const core = createEmptyStateCore();
	core.watch(() => {});
	await core.execute({ command: "setKind", input: input.kind });
	await core.execute({ command: "setTitle", input: input.title });
	await core.execute({ command: "setMessage", input: input.message });
	await core.execute({ command: "setActionLabel", input: input.actionLabel });
	return core;
}

describe("EmptyState states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(emptyStateContract, emptyStateGallery);
		expect(emptyStateContract.slots).toEqual([]);
		for (const app of ["DevTools", "Twilight", "Booster Budget"] as const) {
			expect(emptyStateGallery.some((fixture) => fixture.app === app)).toBe(
				true,
			);
		}
		for (const fixture of emptyStateGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.title).toBe(fixture.input.title);
				expect(states.message).toBe(fixture.input.message);
				expect(states.actionLabel).toBe(fixture.input.actionLabel);
				expect(states.showAction).toBe(fixture.input.actionLabel !== null);
				assertFlagReasons(states, emptyStateContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("records the first step without choosing what it does", async () => {
		const core = await show({
			kind: "empty",
			title: "Today is empty",
			message: "Capacity 0/3.",
			actionLabel: "Add a thought",
		});
		try {
			await core.execute({ command: "act" });
			expect(core.get("states")).toMatchObject({
				state: "empty",
				actionRequested: true,
				isActionRequested: true,
				title: "Today is empty",
			});
		} finally {
			core.dispose();
		}
	});

	it("treats a whitespace-only action label as no first step", async () => {
		const core = await show({
			kind: "empty",
			title: "Today is empty",
			message: "Capacity 0/3.",
			actionLabel: " \n ",
		});
		try {
			expect(core.get("states")).toMatchObject({
				actionLabel: null,
				showAction: false,
				canAct: false,
				canActRefusal: "There is no first step.",
			});
		} finally {
			core.dispose();
		}
	});

	it("ignores act when there is no first step", async () => {
		const core = await show({
			kind: "filtered",
			title: "Nothing matches",
			message: "Clear the filter to see the log.",
			actionLabel: null,
		});
		try {
			await core.execute({ command: "act" });
			expect(core.get("states").isActionRequested).toBe(false);
			expect(core.get("states").canActRefusal).toBe("There is no first step.");
		} finally {
			core.dispose();
		}
	});
});
