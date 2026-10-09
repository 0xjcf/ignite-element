/**
 * Imperative host runtime. Mount is client-only. `describe` is pure and is
 * also the accessible description on an element.
 */

export type IgniteHostContext = {
	readonly signal: AbortSignal;
	send(event: unknown): void;
	readonly reducedMotion: boolean;
};

export type IgniteHostDefinition = {
	mount(el: Element, ctx: IgniteHostContext): unknown;
	update?(handle: unknown, slice: unknown): void;
	dispose(handle: unknown): void;
	select?(snapshot: unknown): unknown;
	equals?(a: unknown, b: unknown): boolean;
	describe?(slice: unknown): string;
};

export type IgniteHostRuntime = {
	server?: boolean;
	snapshot: unknown;
	send: (event: unknown) => void;
	reducedMotion: () => boolean;
	hosts: Record<string, IgniteHostDefinition>;
};

type HostRecord = {
	name: string;
	definition: IgniteHostDefinition;
	controller: AbortController;
	handle: unknown;
	settled: boolean;
	slice: unknown;
	hasSlice: boolean;
	delivered: boolean;
	deliveredSlice: unknown;
	stopMotion: () => void;
};

const hostRecords = new WeakMap<Element, HostRecord>();
const unknownHostWarnings = new WeakMap<Element, Set<string>>();
let activeRuntime: IgniteHostRuntime | undefined;
let claimSubtree: (element: Element) => void = () => undefined;
let onUnmount: (node: Node, hook: () => void) => void = () => undefined;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function configureHostOwnership(tools: {
	claimSubtree: (element: Element) => void;
	onUnmount: (node: Node, hook: () => void) => void;
}): void {
	claimSubtree = tools.claimSubtree;
	onUnmount = tools.onUnmount;
}

export function withIgniteHostRuntime<T>(
	runtime: IgniteHostRuntime | undefined,
	run: () => T,
): T {
	if (!runtime) return run();
	const previous = activeRuntime;
	activeRuntime = runtime;
	try {
		return run();
	} finally {
		activeRuntime = previous;
	}
}

const hostRuntimes = new WeakMap<EventTarget, IgniteHostRuntime>();

export function bindIgniteHostRuntime(
	owner: EventTarget,
	runtime: IgniteHostRuntime | undefined,
): void {
	if (runtime) hostRuntimes.set(owner, runtime);
	else hostRuntimes.delete(owner);
}

export function readIgniteHostRuntime(
	owner: EventTarget | null | undefined,
): IgniteHostRuntime | undefined {
	if (!owner) return undefined;
	return hostRuntimes.get(owner);
}

export function describeIgniteHosts(
	hosts: Record<string, IgniteHostDefinition>,
	snapshot: unknown,
): Record<string, string> {
	const text: Record<string, string> = {};
	for (const [name, host] of Object.entries(hosts)) {
		if (!host.describe) continue;
		const slice = host.select ? host.select(snapshot) : snapshot;
		const description = host.describe(slice);
		if (typeof description === "string") text[name] = description;
	}
	return text;
}

function isDevelopment(): boolean {
	return process.env.NODE_ENV !== "production";
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		"then" in value &&
		typeof (value as { then?: unknown }).then === "function"
	);
}

function reportHostError(message: string, error: unknown): void {
	console.error(message, error);
}

function slicesEqual(
	definition: IgniteHostDefinition,
	previous: unknown,
	next: unknown,
): boolean {
	if (definition.equals) return definition.equals(previous, next);
	return Object.is(previous, next);
}

function watchReducedMotion(onChange: () => void): () => void {
	if (typeof matchMedia !== "function") return () => undefined;
	let query: MediaQueryList;
	try {
		query = matchMedia(REDUCED_MOTION);
	} catch {
		return () => undefined;
	}
	const listener = () => onChange();
	query.addEventListener("change", listener);
	return () => query.removeEventListener("change", listener);
}

function deliver(record: HostRecord, force: boolean): void {
	if (!record.settled || !record.definition.update || !record.hasSlice) return;
	if (
		!force &&
		record.delivered &&
		slicesEqual(record.definition, record.deliveredSlice, record.slice)
	) {
		return;
	}
	try {
		record.definition.update(record.handle, record.slice);
		record.delivered = true;
		record.deliveredSlice = record.slice;
	} catch (error) {
		reportHostError("[ignite-jsx] Host update failed.", error);
	}
}

function disposeSettled(record: HostRecord): void {
	if (!record.settled) return;
	record.settled = false;
	try {
		record.definition.dispose(record.handle);
	} catch (error) {
		reportHostError("[ignite-jsx] Host dispose failed.", error);
	}
}

function retireHost(element: Element): void {
	const record = hostRecords.get(element);
	if (!record) return;
	hostRecords.delete(element);
	record.controller.abort();
	record.stopMotion();
	disposeSettled(record);
}

function applyDescription(
	element: Element,
	definition: IgniteHostDefinition,
	slice: unknown,
): void {
	if (!definition.describe) return;
	let text: string;
	try {
		text = definition.describe(slice);
	} catch (error) {
		reportHostError("[ignite-jsx] Host describe failed.", error);
		return;
	}
	if (typeof text !== "string") return;
	if (element.getAttribute("aria-description") !== text) {
		element.setAttribute("aria-description", text);
	}
}

function warnUnknownHost(element: Element, name: string): void {
	if (!isDevelopment()) return;
	let seen = unknownHostWarnings.get(element);
	if (!seen) {
		seen = new Set();
		unknownHostWarnings.set(element, seen);
	}
	if (seen.has(name)) return;
	seen.add(name);
	console.warn(
		`[ignite-jsx] Unknown host "${name}". Declare it on the core's hosts map.`,
	);
}

function startHost(
	element: Element,
	name: string,
	definition: IgniteHostDefinition,
	runtime: IgniteHostRuntime,
	slice: unknown,
): void {
	const controller = new AbortController();
	const ctx: IgniteHostContext = {
		signal: controller.signal,
		send: (event) => runtime.send(event),
		get reducedMotion() {
			return runtime.reducedMotion();
		},
	};
	const record: HostRecord = {
		name,
		definition,
		controller,
		handle: undefined,
		settled: false,
		slice,
		hasSlice: true,
		delivered: false,
		deliveredSlice: undefined,
		stopMotion: () => undefined,
	};
	record.stopMotion = watchReducedMotion(() => {
		if (controller.signal.aborted) return;
		deliver(record, true);
	});
	hostRecords.set(element, record);
	onUnmount(element, () => {
		const current = hostRecords.get(element);
		if (current !== record) return;
		hostRecords.delete(element);
		controller.abort();
		record.stopMotion();
		disposeSettled(record);
	});
	let result: unknown;
	try {
		result = definition.mount(element, ctx);
	} catch (error) {
		hostRecords.delete(element);
		controller.abort();
		record.stopMotion();
		reportHostError("[ignite-jsx] Host mount failed.", error);
		return;
	}
	if (isPromiseLike(result)) {
		Promise.resolve(result).then(
			(handle) => {
				if (controller.signal.aborted || hostRecords.get(element) !== record) {
					try {
						definition.dispose(handle);
					} catch (error) {
						reportHostError("[ignite-jsx] Host dispose failed.", error);
					}
					return;
				}
				record.handle = handle;
				record.settled = true;
				deliver(record, false);
			},
			(error: unknown) => {
				reportHostError("[ignite-jsx] Host mount failed.", error);
			},
		);
		return;
	}
	record.handle = result;
	record.settled = true;
	deliver(record, false);
}

export function syncHostElement(element: Element, useName: unknown): void {
	const runtime = activeRuntime;
	if (!runtime) return;
	if (typeof useName !== "string" || useName.length === 0) {
		retireHost(element);
		return;
	}
	const definition = runtime.hosts[useName];
	if (!definition) {
		warnUnknownHost(element, useName);
		retireHost(element);
		return;
	}
	claimSubtree(element);
	const slice = definition.select
		? definition.select(runtime.snapshot)
		: runtime.snapshot;
	applyDescription(element, definition, slice);
	if (runtime.server) return;
	const existing = hostRecords.get(element);
	if (
		!existing ||
		existing.name !== useName ||
		existing.definition !== definition
	) {
		if (existing) retireHost(element);
		startHost(element, useName, definition, runtime, slice);
		return;
	}
	existing.slice = slice;
	existing.hasSlice = true;
	deliver(existing, false);
}
