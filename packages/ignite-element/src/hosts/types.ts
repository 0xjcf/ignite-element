type HostAbortSignal = {
	readonly aborted: boolean;
	addEventListener(
		type: "abort",
		listener: () => void,
		options?: { once?: boolean },
	): void;
	removeEventListener(type: "abort", listener: () => void): void;
};

/**
 * The platform abort signal when the lib provides one. A structural signal
 * otherwise, so a pure ES2022 program does not need the DOM lib.
 */
export type HostSignal = typeof globalThis extends {
	AbortSignal: { prototype: infer Signal };
}
	? Signal
	: HostAbortSignal;

export interface HostContext<Event = unknown> {
	readonly signal: HostSignal;
	send(event: Event): void;
	readonly reducedMotion: boolean;
}

/** `El` defaults to `unknown` so a host typechecks without a DOM lib. */
export interface Host<
	El = unknown,
	Slice = unknown,
	Handle = unknown,
	Snapshot = unknown,
	Event = unknown,
> {
	mount(el: El, ctx: HostContext<Event>): Handle | Promise<Handle>;
	update?(handle: Handle, slice: Slice): void;
	dispose(handle: Handle): void;
	select?: (snapshot: Snapshot) => Slice;
	equals?(a: Slice, b: Slice): boolean;
	describe?(slice: Slice): string;
}

/**
 * A host map accepts any element, slice, and handle. `mount` stays a method so
 * its element parameter is bivariant and a canvas host still assigns. `select`
 * is a function property so its snapshot is checked against the owning core.
 */
export type IgniteHostMap<Snapshot = unknown> = {
	[name: string]: {
		mount(el: unknown, ctx: HostContext<never>): unknown;
		update?(handle: never, slice: never): void;
		dispose(handle: never): void;
		select?: (snapshot: Snapshot) => unknown;
		equals?(a: never, b: never): boolean;
		describe?(slice: never): string;
	};
};

/**
 * Opaque handle for one host on one core's map. The runtime value is the
 * host-name string. The type is an object, so a string cast does not forge it;
 * that takes `as unknown as`. Two handles match only when their maps and names
 * match, so identical host maps are interchangeable and a different map is not.
 * `__igniteHost` is the brand the JSX `use` prop recognizes.
 */
export type HostHandle<Hosts, Name extends string> = {
	readonly __igniteHost: (map: Hosts) => Name;
};

/**
 * A core with no host map. `undefined extends Hosts` is true for every type
 * when strictNullChecks is off, so only the reverse direction means "no map".
 */
type HostsUnspecified<Hosts> = [Hosts] extends [undefined]
	? true
	: true extends (
				Hosts extends unknown
					? [Hosts] extends [undefined]
						? true
						: false
					: never
			)
		? true
		: false;

export type HostHandles<Hosts> = HostsUnspecified<Hosts> extends true
	? Record<never, never>
	: string extends keyof Hosts
		? { readonly [name: string]: HostHandle<Hosts, string> }
		: {
				readonly [Name in keyof Hosts & string]: HostHandle<
					Hosts,
					Name & string
				>;
			};

/** Present on the view only when this core declared a host map. */
export type HostRenderSlot<Hosts> = HostsUnspecified<Hosts> extends true
	? Record<never, never>
	: { readonly hosts: HostHandles<Hosts> };

/** `use` requires a handle from this core. A bare string does not match. */
export type HostProps<Hosts extends Record<string, unknown>> = {
	use?: string extends keyof Hosts
		? HostHandle<Hosts, string>
		: {
				[Name in keyof Hosts & string]: HostHandle<Hosts, Name & string>;
			}[keyof Hosts & string];
};
