// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import * as actorWeb from "../actor-web";
import * as root from "../index";
import * as mobx from "../mobx";
import * as redux from "../redux";
import * as xstate from "../xstate";

describe("retired projection target public contract", () => {
	for (const [name, entry] of Object.entries({
		root,
		xstate,
		redux,
		mobx,
		actorWeb,
	})) {
		it(`does not export target constructors from ${name}`, () => {
			expect(entry).not.toHaveProperty("createProjectionDocumentTarget");
			expect(entry).not.toHaveProperty("createProjectionSpeechTarget");
		});
	}

	it("rejects one-argument registration without inspecting application data", () => {
		const core = xstate.igniteCore({ source: createMachine({}) });
		let reads = 0;
		const data = Object.defineProperty({}, "kind", {
			get() {
				reads++;
				return "document";
			},
		});
		try {
			expect(() => Reflect.apply(core, undefined, [data])).toThrow(
				"DOM registration requires an element name and renderer",
			);
			expect(reads).toBe(0);
			expect(core.get("states")).toEqual({});
		} finally {
			core.dispose();
		}
	});
});
