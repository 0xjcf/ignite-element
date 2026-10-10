/**
 * Imperative host runtime. Mount is client-only. `describe` is the accessible
 * text and the snapshot text used by non-DOM projections.
 */

import {
	claimHostSubtree,
	type IgniteHostContext,
	type IgniteHostDefinition,
	type IgniteHostRuntime,
	installHostRuntime,
	installHostSync,
	onHostUnmount,
	releaseHostSubtree,
	unmountOwnedSubtree,
} from "./hostBridge";

export type {
	IgniteHostContext,
	IgniteHostDefinition,
	IgniteHostRuntime,
} from "./hostBridge";
export { HOST_RUNTIME_FIELD } from "./hostBridge";

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
	delivering: boolean;
	redeliver: boolean;
	stopMotion: () => void;
};

const hostRecords = new WeakMap<Element, HostRecord>();
const hostUnmountBound = new WeakSet<Element>();
let hostUnmountBindings = 0;

/** @internal Counts unmount hooks registered for host elements. */
export function hostUnmountBindingsForTests(): number {
	return hostUnmountBindings;
}
const unknownHostWarnings = new WeakMap<Element, Set<string>>();
const descriptionIds = new WeakMap<Element, string>();
let descriptionSerial = 0;
let activeRuntime: IgniteHostRuntime | undefined;
let renderDepth = 0;
const deferredSends: Array<() => void> = [];
const pendingDeliver: HostRecord[] = [];
let flushScheduled = false;

function scheduleDeferredSends(): void {
	if (flushScheduled || deferredSends.length === 0) return;
	flushScheduled = true;
	queueMicrotask(() => {
		flushScheduled = false;
		const batch = deferredSends.splice(0, deferredSends.length);
		const waiting = pendingDeliver.splice(0, pendingDeliver.length);
		for (const send of batch) send();
		for (const record of waiting) {
			if (!record.settled) continue;
			deliver(record, false);
		}
		if (deferredSends.length > 0) scheduleDeferredSends();
	});
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DESCRIPTION_ATTR = "data-ignite-host-description";
const VISUALLY_HIDDEN =
	"position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

export function withIgniteHostRuntime<T>(
	runtime: IgniteHostRuntime | undefined,
	run: () => T,
): T {
	if (!runtime) return run();
	const previous = activeRuntime;
	activeRuntime = runtime;
	renderDepth += 1;
	try {
		return run();
	} finally {
		renderDepth -= 1;
		activeRuntime = previous;
		if (renderDepth === 0) scheduleDeferredSends();
	}
}

export function describeIgniteHosts(
	hosts: Record<string, IgniteHostDefinition>,
	snapshot: unknown,
): Record<string, string> {
	const text = Object.create(null) as Record<string, string>;
	for (const name of Object.keys(hosts)) {
		const host = hosts[name];
		if (!host?.describe) continue;
		try {
			const slice = host.select ? host.select(snapshot) : snapshot;
			const description = host.describe(slice);
			if (typeof description !== "string") continue;
			Object.defineProperty(text, name, {
				value: description,
				enumerable: true,
				configurable: true,
				writable: true,
			});
		} catch (error) {
			reportHostError("[ignite-jsx] Host describe failed.", error);
		}
	}
	return text;
}

declare const __IGNITE_DEV_WARNINGS__: boolean;

function isClient(): boolean {
	return typeof globalThis.window !== "undefined";
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
	if (!definition.equals) return Object.is(previous, next);
	try {
		return definition.equals(previous, next);
	} catch (error) {
		reportHostError("[ignite-jsx] Host equals failed.", error);
		return false;
	}
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
	if (record.delivering) {
		record.redeliver = true;
		return;
	}
	record.delivering = true;
	try {
		let deliverForce = force;
		do {
			record.redeliver = false;
			if (
				!deliverForce &&
				record.delivered &&
				slicesEqual(record.definition, record.deliveredSlice, record.slice)
			) {
				deliverForce = false;
				continue;
			}
			const slice = record.slice;
			try {
				record.definition.update(record.handle, slice);
				record.delivered = true;
				record.deliveredSlice = slice;
			} catch (error) {
				reportHostError("[ignite-jsx] Host update failed.", error);
			}
			deliverForce = false;
		} while (record.redeliver && record.settled && record.hasSlice);
	} finally {
		record.delivering = false;
	}
}

function retireDescendantHosts(element: Element): void {
	for (const child of Array.from(element.childNodes)) {
		unmountOwnedSubtree(child);
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

function dropRecord(element: Element, record: HostRecord): void {
	if (hostRecords.get(element) === record) hostRecords.delete(element);
	record.controller.abort();
	record.stopMotion();
}

function retireHost(element: Element): void {
	const record = hostRecords.get(element);
	if (!record) return;
	hostRecords.delete(element);
	record.controller.abort();
	record.stopMotion();
	disposeSettled(record);
}

function descriptionIdTaken(element: Element, id: string): boolean {
	const root = element.getRootNode();
	if (root instanceof Document || root instanceof ShadowRoot) {
		return root.getElementById(id) !== null;
	}
	return element.ownerDocument.getElementById(id) !== null;
}

function descriptionId(element: Element): string {
	const existing = descriptionIds.get(element);
	if (existing) return existing;
	let id = "";
	do {
		descriptionSerial += 1;
		id = `ignite-host-desc-${descriptionSerial}`;
	} while (descriptionIdTaken(element, id));
	descriptionIds.set(element, id);
	return id;
}

function descriptionNode(element: Element): HTMLElement | null {
	for (const child of element.children) {
		if (child instanceof HTMLElement && child.hasAttribute(DESCRIPTION_ATTR)) {
			return child;
		}
	}
	return null;
}

function clearDescription(element: Element): void {
	const id = descriptionIds.get(element);
	descriptionNode(element)?.remove();
	if (!id) return;
	const current = element.getAttribute("aria-describedby");
	if (!current) return;
	const next = current.split(/\s+/).filter((token) => token && token !== id);
	if (next.length === 0) element.removeAttribute("aria-describedby");
	else element.setAttribute("aria-describedby", next.join(" "));
}

function applyDescription(
	element: Element,
	definition: IgniteHostDefinition,
	slice: unknown,
): void {
	if (!definition.describe) {
		clearDescription(element);
		return;
	}
	let text: string;
	try {
		text = definition.describe(slice);
	} catch (error) {
		reportHostError("[ignite-jsx] Host describe failed.", error);
		clearDescription(element);
		return;
	}
	if (typeof text !== "string") return;
	const id = descriptionId(element);
	let node = descriptionNode(element);
	if (!node) {
		node = element.ownerDocument.createElement("span");
		node.id = id;
		node.setAttribute(DESCRIPTION_ATTR, "");
		node.style.cssText = VISUALLY_HIDDEN;
		element.append(node);
	}
	if (node.textContent !== text) node.textContent = text;
	const tokens = (element.getAttribute("aria-describedby") ?? "")
		.split(/\s+/)
		.filter(Boolean);
	if (!tokens.includes(id)) {
		tokens.push(id);
		element.setAttribute("aria-describedby", tokens.join(" "));
	}
}

function ownName(value: object, key: string): boolean {
	return (
		Object as typeof Object & {
			hasOwn(target: object, property: PropertyKey): boolean;
		}
	).hasOwn(value, key);
}

function warnUnknownHost(element: Element, name: string): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
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

function acceptHandle(
	element: Element,
	record: HostRecord,
	definition: IgniteHostDefinition,
	handle: unknown,
	deferDeliver = false,
): void {
	if (record.controller.signal.aborted || hostRecords.get(element) !== record) {
		try {
			definition.dispose(handle);
		} catch (error) {
			reportHostError("[ignite-jsx] Host dispose failed.", error);
		}
		return;
	}
	record.handle = handle;
	record.settled = true;
	applyDescription(element, definition, record.slice);
	if (deferDeliver) {
		pendingDeliver.push(record);
		return;
	}
	deliver(record, false);
}

function ensureHostUnmount(element: Element): void {
	if (hostUnmountBound.has(element)) return;
	hostUnmountBound.add(element);
	hostUnmountBindings += 1;
	onHostUnmount(element, () => {
		hostUnmountBound.delete(element);
		const current = hostRecords.get(element);
		if (!current) return;
		retireDescendantHosts(element);
		hostRecords.delete(element);
		current.controller.abort();
		current.stopMotion();
		disposeSettled(current);
	});
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
		send: (event) => {
			const deliverSend = () => runtime.send(event);
			if (renderDepth > 0) {
				deferredSends.push(deliverSend);
				return;
			}
			deliverSend();
		},
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
		delivering: false,
		redeliver: false,
		stopMotion: () => undefined,
	};
	record.stopMotion = watchReducedMotion(() => {
		if (controller.signal.aborted) return;
		deliver(record, true);
	});
	hostRecords.set(element, record);
	ensureHostUnmount(element);
	retireDescendantHosts(element);
	const queuedBefore = deferredSends.length;
	let result: unknown;
	try {
		result = definition.mount(element, ctx);
	} catch (error) {
		reportHostError("[ignite-jsx] Host mount failed.", error);
		if (hostRecords.get(element) === record) {
			dropRecord(element, record);
			releaseHostSubtree(element);
		}
		return;
	}
	const deferDeliver = deferredSends.length > queuedBefore;
	if (isPromiseLike(result)) {
		Promise.resolve(result).then(
			(handle) => {
				acceptHandle(element, record, definition, handle);
			},
			(error: unknown) => {
				reportHostError("[ignite-jsx] Host mount failed.", error);
				if (
					record.controller.signal.aborted ||
					hostRecords.get(element) !== record
				) {
					return;
				}
				dropRecord(element, record);
				releaseHostSubtree(element);
			},
		);
		return;
	}
	acceptHandle(element, record, definition, result, deferDeliver);
}

function readSlice(
	definition: IgniteHostDefinition,
	snapshot: unknown,
): { ok: true; slice: unknown } | { ok: false } {
	try {
		return {
			ok: true,
			slice: definition.select ? definition.select(snapshot) : snapshot,
		};
	} catch (error) {
		reportHostError("[ignite-jsx] Host select failed.", error);
		return { ok: false };
	}
}

export function syncHostElement(element: Element, useName: unknown): void {
	const runtime = activeRuntime;
	if (!runtime) return;
	if (typeof useName !== "string" || useName.length === 0) {
		retireHost(element);
		releaseHostSubtree(element);
		clearDescription(element);
		return;
	}
	if (!ownName(runtime.hosts, useName)) {
		if (__IGNITE_DEV_WARNINGS__) warnUnknownHost(element, useName);
		retireHost(element);
		releaseHostSubtree(element);
		clearDescription(element);
		return;
	}
	const definition = runtime.hosts[useName];
	if (!definition) {
		if (__IGNITE_DEV_WARNINGS__) warnUnknownHost(element, useName);
		retireHost(element);
		releaseHostSubtree(element);
		clearDescription(element);
		return;
	}
	claimHostSubtree(element);
	const selected = readSlice(definition, runtime.snapshot);
	if (!selected.ok) {
		retireHost(element);
		releaseHostSubtree(element);
		clearDescription(element);
		return;
	}
	const slice = selected.slice;
	if (!isClient()) {
		applyDescription(element, definition, slice);
		return;
	}
	const existing = hostRecords.get(element);
	if (
		!existing ||
		existing.name !== useName ||
		existing.definition !== definition
	) {
		if (existing) retireHost(element);
		startHost(element, useName, definition, runtime, slice);
		applyDescription(element, definition, slice);
		return;
	}
	existing.slice = slice;
	existing.hasSlice = true;
	deliver(existing, false);
	applyDescription(element, definition, slice);
}

installHostSync(syncHostElement);
installHostRuntime(withIgniteHostRuntime);
