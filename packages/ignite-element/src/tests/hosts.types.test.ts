import { describe, expectTypeOf, it } from "vitest";
import { createMachine } from "xstate";
import type { Host, HostHandles, HostProps } from "../hosts/types";
import { igniteCore } from "../xstate";

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

describe("hook marker", () => {
	it("does not advertise host handles the hook never creates", () => {
		const machine = createMachine({
			types: { context: {} as { angle: number } },
			context: { angle: 0 },
		});
		const core = igniteCore({
			source: machine,
			hosts: {
				scene: {
					mount() {},
					dispose() {},
				},
			},
		});
		type Marker = NonNullable<(typeof core)["__igniteRenderArgs"]>;
		type AdvertisesHosts = "hosts" extends keyof Marker ? true : false;
		expectTypeOf<AdvertisesHosts>().toEqualTypeOf<false>();
	});
});

describe("dynamic host maps", () => {
	it("brands an index-signature handle without making it a bare string", () => {
		type Dynamic = Record<string, Host>;
		type Handle = HostHandles<Dynamic>[string];
		expectTypeOf<Handle>().not.toMatchTypeOf<string>();
		expectTypeOf<string>().not.toMatchTypeOf<Handle>();
		type StaticUse = NonNullable<HostProps<SceneHosts>["use"]>;
		expectTypeOf<string>().not.toMatchTypeOf<StaticUse>();
	});
});
