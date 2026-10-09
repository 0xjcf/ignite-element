import { describe, expectTypeOf, it } from "vitest";
import type { Host, HostProps } from "../hosts/types";

type SceneHosts = {
	scene: Host<HTMLCanvasElement, number>;
};

describe("HostProps", () => {
	it("limits use to the names declared on a core", () => {
		expectTypeOf<HostProps<SceneHosts>["use"]>().toEqualTypeOf<
			"scene" | undefined
		>();

		const named: HostProps<SceneHosts> = { use: "scene" };
		expectTypeOf(named.use).toEqualTypeOf<"scene" | undefined>();

		// @ts-expect-error use must name a host on this core
		const missing: HostProps<SceneHosts> = { use: "missing" };
		expectTypeOf(missing).toEqualTypeOf<HostProps<SceneHosts>>();
	});
});
