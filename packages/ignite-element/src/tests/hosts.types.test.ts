import { describe, expectTypeOf, it } from "vitest";
import type { Host, HostProps } from "../hosts/types";

type SceneHosts = {
	scene: Host<HTMLCanvasElement, number>;
};

describe("Host", () => {
	it("defaults the mount target without a DOM element type", () => {
		expectTypeOf<Host>().toEqualTypeOf<
			Host<unknown, unknown, unknown, unknown, unknown>
		>();
	});
});

describe("HostProps", () => {
	it("requires a handle from this core", () => {
		type Use = NonNullable<HostProps<SceneHosts>["use"]>;
		expectTypeOf<Use>().not.toMatchTypeOf<string>();
		expectTypeOf<string>().not.toMatchTypeOf<Use>();

		const handle = null as unknown as Use;
		const named: HostProps<SceneHosts> = { use: handle };
		expectTypeOf(named.use).toEqualTypeOf<Use | undefined>();

		// @ts-expect-error a string cast cannot forge this core's handle
		const cast = "scene" as Use;
		expectTypeOf(cast).toEqualTypeOf<Use>();

		// @ts-expect-error a bare string is not this core's handle
		const literal: HostProps<SceneHosts> = { use: "scene" };
		expectTypeOf(literal).toEqualTypeOf<HostProps<SceneHosts>>();

		// @ts-expect-error use must name a host on this core
		const missing: HostProps<SceneHosts> = { use: "missing" };
		expectTypeOf(missing).toEqualTypeOf<HostProps<SceneHosts>>();
	});
});
