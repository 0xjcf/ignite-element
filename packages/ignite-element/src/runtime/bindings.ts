import type { FacadeCommandFunction } from "@ignite-element/core";
import type { Lifetime } from "./lifetime";

export type BindingStore = {
	/** Headless/shared bootstrap; independent bindings are constructed inertly. */
	prepare(): void;
	/** Component retention, recorded without source activation during insertion. */
	attach?(): () => void;
	/** Visible view lease acquired during the committed layout phase. */
	commit?(): () => void;
	read(): Readonly<Record<string, unknown>>;
	subscribe(listener: () => void): () => void;
};
// One private shared module in the multi-entry package build. No global registry.
const stores = new WeakMap<
	object,
	{
		store: BindingStore;
		lifetime: Lifetime;
		independent?: (owner: Lifetime) => BindingStore;
	}
>();
const elementCommands = new WeakMap<object, readonly string[]>();
export function registerElementCommands(
	element: object,
	commands: object,
): void {
	elementCommands.set(
		element,
		Object.keys(commands).filter(
			(key) =>
				typeof Object.getOwnPropertyDescriptor(commands, key)?.value ===
				"function",
		),
	);
}
export function readElementCommandNames(element: object): readonly string[] {
	return elementCommands.get(element) ?? [];
}
const commandOwners = new WeakMap<object, { assertActive: () => void }>();
export function setCommandOwner(
	commands: object,
	assertActive: () => void,
): void {
	const owner = commandOwners.get(commands);
	if (owner) owner.assertActive = assertActive;
}
export function createCommandOwner(commands: object): {
	assertActive: () => void;
} {
	const owner = { assertActive: () => {} };
	commandOwners.set(commands, owner);
	return owner;
}
export const registerBindingStore = (
	core: object,
	store: BindingStore,
	lifetime: Lifetime,
): void => {
	stores.set(core, { store, lifetime });
};
export const requireBindingStore = (core: object): BindingStore => {
	const store = stores.get(core);
	if (!store)
		throw new Error("[useIgnite] Expected a source-backed Ignite core.");
	return store.store;
};

export function registerIndependentBinding(
	core: object,
	create: (owner: Lifetime) => BindingStore,
): void {
	const record = stores.get(core);
	if (!record) throw new Error("[useIgnite] Missing core binding.");
	record.independent = create;
}
export function acquireBindingStore(core: object): BindingStore {
	const record = stores.get(core);
	if (!record) return requireBindingStore(core);
	record.lifetime.assertActive();
	return record.independent?.(record.lifetime) ?? record.store;
}

export function guardCommand<Command extends FacadeCommandFunction>(
	command: Command,
	assertActive: () => void,
): Command {
	// Proxy apply preserves name, length, receiver, argument tuple and promise identity.
	return new Proxy(command, {
		apply(target, receiver, args) {
			assertActive();
			return Reflect.apply(target, receiver, args);
		},
	});
}

export function assertNoCollisions(states: object, commands: object): void {
	for (const key of Object.keys(states)) {
		if (Object.getOwnPropertyDescriptor(commands, key) !== undefined)
			throw new Error(`[igniteCore] State/command name collision: "${key}".`);
	}
}

/** Detach immutable projection data, never freeze a caller's source graph. */
export function immutableProjection(
	value: unknown,
	seen = new Map<object, unknown>(),
): unknown {
	if (value === null || typeof value !== "object") return value;
	if (seen.has(value)) return seen.get(value);
	const prototype = Object.getPrototypeOf(value);
	if (
		!Array.isArray(value) &&
		prototype !== Object.prototype &&
		prototype !== null
	) {
		throw new Error(
			"[useIgnite] Project immutable plain records/arrays, primitives or functions; do not expose mutable class instances.",
		);
	}
	const copy: Record<string, unknown> | unknown[] = Array.isArray(value)
		? new Array(value.length)
		: Object.create(null);
	seen.set(value, copy);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor?.enumerable) continue;
		if (!("value" in descriptor))
			throw new Error(
				"[useIgnite] Projection values must not contain accessors.",
			);
		Object.defineProperty(copy, key, {
			enumerable: true,
			configurable: true,
			writable: true,
			value: immutableProjection(descriptor.value, seen),
		});
	}
	return Object.freeze(copy);
}
