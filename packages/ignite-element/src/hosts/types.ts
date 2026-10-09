export interface HostContext<Event = unknown> {
	readonly signal: AbortSignal;
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
	select?(snapshot: Snapshot): Slice;
	equals?(a: Slice, b: Slice): boolean;
	describe?(slice: Slice): string;
}

/**
 * A host map accepts any element, slice, and handle. Method parameters are
 * bivariant, so a canvas host still assigns.
 */
export interface IgniteHostLike {
	mount(el: unknown, ctx: HostContext<never>): unknown;
	update?(handle: never, slice: never): void;
	dispose(handle: never): void;
	select?(snapshot: never): unknown;
	equals?(a: never, b: never): boolean;
	describe?(slice: never): string;
}

export type IgniteHostMap = Record<string, IgniteHostLike>;

/** JSX props whose `use` name is one of a core's hosts. */
export type HostProps<Hosts extends Record<string, unknown>> = {
	use?: keyof Hosts & string;
};
