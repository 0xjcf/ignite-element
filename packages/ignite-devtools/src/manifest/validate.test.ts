import { describe, expect, it } from "vitest";
import {
	catalogComponentCount,
	catalogComponentNames,
	validDevtoolsManifest,
} from "./fixtures/valid-manifest";
import { defineDevtoolsManifest } from "./schema";
import { validateDevtoolsManifest } from "./validate";

const catalogOptions = { componentNames: catalogComponentNames };

describe("devtools manifest validator", () => {
	it("accepts the catalog fixture", () => {
		expect(catalogComponentNames).toHaveLength(50);
		expect(catalogComponentCount).toBe(50);
		expect(new Set(catalogComponentNames).size).toBe(50);
		expect(
			validDevtoolsManifest.components.map((component) => component.name),
		).toEqual(catalogComponentNames);
		expect(validDevtoolsManifest.sources[0]?.id).toBe("connection");
		expect(structuredClone(validDevtoolsManifest)).toEqual(
			validDevtoolsManifest,
		);
	});

	it("rejects a broken version, flag, command, and unknown component", () => {
		const brokenVersion = validateDevtoolsManifest(
			{ ...validDevtoolsManifest, version: 2 },
			catalogOptions,
		);
		expect(brokenVersion.ok).toBe(false);
		if (!brokenVersion.ok) {
			expect(brokenVersion.errors).toContainEqual({
				path: "version",
				message: "must be 1",
			});
		}

		const brokenFlag = validateDevtoolsManifest(
			{
				...validDevtoolsManifest,
				sources: [
					{
						...validDevtoolsManifest.sources[0],
						flags: [{ name: "enabled", kind: "can" }],
					},
				],
			},
			catalogOptions,
		);
		expect(brokenFlag.ok).toBe(false);

		const brokenCommand = validateDevtoolsManifest(
			{
				...validDevtoolsManifest,
				sources: [
					{
						...validDevtoolsManifest.sources[0],
						commands: [
							...(validDevtoolsManifest.sources[0]?.commands ?? []),
							{ name: "fly", flag: "canFly" },
						],
					},
				],
			},
			catalogOptions,
		);
		expect(brokenCommand.ok).toBe(false);
		if (!brokenCommand.ok) {
			expect(
				brokenCommand.errors.some((error) => error.message.includes("flag")),
			).toBe(true);
		}

		const unknownComponent = validateDevtoolsManifest(
			{
				...validDevtoolsManifest,
				components: [
					...validDevtoolsManifest.components,
					{ id: "NotAComponent", name: "NotAComponent" },
				],
			},
			catalogOptions,
		);
		expect(unknownComponent.ok).toBe(false);
		if (!unknownComponent.ok) {
			expect(
				unknownComponent.errors.some((error) =>
					error.message.includes("NotAComponent"),
				),
			).toBe(true);
		}
	});

	it("throws from defineDevtoolsManifest when the document is broken", () => {
		expect(() =>
			defineDevtoolsManifest(
				{
					...validDevtoolsManifest,
					app: "",
				},
				catalogOptions,
			),
		).toThrow(/Invalid devtools manifest/);
	});
});
