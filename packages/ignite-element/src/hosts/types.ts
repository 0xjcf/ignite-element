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

export type HostNamesOf<Hosts> = [Hosts] extends [undefined]
	? string
	: [undefined] extends [Hosts]
		? string
		: string extends keyof Hosts
			? string
			: keyof Hosts & string;

/** JSX props whose `use` name is one of a core's hosts. */
export type HostProps<Hosts extends Record<string, unknown>> = {
	use?: keyof Hosts & string;
};
