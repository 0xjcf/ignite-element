/**
 * Imperative host runtime. Mount is client-only. `describe` is the accessible
 * text and the snapshot text used by non-DOM projections.
 */

import {
	claimHostSubtree,
	hostLive,
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
	// Bumped when a newer slice is accepted into a retained record.
	gen: number;
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
const pendingDeliver: Array<{
	record: HostRecord;
	afterDeliver: () => void;
}> = [];
let flushScheduled = false;

function scheduleDeferredSends(): void {
	if (flushScheduled || deferredSends.length === 0) return;
	flushScheduled = true;
	queueMicrotask(() => {
		flushScheduled = false;
		const batch = deferredSends.splice(0, deferredSends.length);
		const waiting = pendingDeliver.splice(0, pendingDeliver.length);
		for (const send of batch) send();
		for (const pending of waiting) {
			if (!pending.record.settled) continue;
			deliver(pending.record, false);
			if (!pending.record.settled) continue;
			guard(pending.afterDeliver);
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
			const slice = host.select ? host.select(snapshot) : snapshot; // callback: describeIgniteHosts is render-time, outside commits
			const description = host.describe(slice); // callback: ditto
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

// Two reads, two touches: a Proxy `has` trap and a `then` getter are separate user code.
function hasThen(value: unknown): boolean {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		"then" in value // native: only called inside touch()
	);
}

function thenIsFunction(value: unknown): boolean {
	return typeof (value as { then?: unknown }).then === "function"; // native: ditto
}

// The one choke point for host-side user code: a getter, an overridable
// element method, a thenable, an abort listener. Ownership is rechecked after the
// call (every step before it ended with the same check), in a commit (hostLive) and outside one (the record). Outside a
// commit a stale call throws `halt`, which the entry points swallow.
const halt = {};
// What a piece of host work was started for: the record, and optionally the
// delivery generation. A newer slice accepted into a retained record bumps the
// generation, so identity alone does not make old work current.
type Stamp = { record: HostRecord; gen?: number };
function touch<T>(element: Element, stamp: Stamp | undefined, run: () => T): T {
	let result: T;
	try {
		result = run();
	} catch (error) {
		// A call that superseded and then threw is stale work, not an error.
		hostLive();
		if (stamp && superseded(element, stamp)) throw halt;
		throw error;
	}
	hostLive();
	if (stamp && superseded(element, stamp)) throw halt;
	return result;
}

// native: the one raw assimilation. It must run even when touch() would stop.
function settleSuperseded(
	result: unknown,
	fulfilled: (handle: unknown) => void,
	rejected: (error: unknown) => void,
): void {
	Promise.resolve(result).then(fulfilled, rejected); // native: see above
}

function guard(run: () => void): void {
	try {
		run();
	} catch (error) {
		if (error !== halt) throw error;
	}
}

function reportHostError(message: string, error: unknown): void {
	try {
		console.error(message, error); // reported: rechecked below
	} catch {
		// A logger that throws is not the host's failure; the check still runs.
	}
	hostLive();
}

function slicesEqual(
	definition: IgniteHostDefinition,
	previous: unknown,
	next: unknown,
): boolean {
	if (!definition.equals) return Object.is(previous, next);
	try {
		return definition.equals(previous, next); // callback: contained, rechecked by deliver
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
			if (!deliverForce && record.delivered) {
				const same = slicesEqual(
					record.definition,
					record.deliveredSlice,
					record.slice,
				);
				// A superseding equals must not be followed by update. Outside a
				// commit there is no frame, so the record itself is the check.
				hostLive();
				if (!record.settled) break;
				if (same) {
					deliverForce = false;
					continue;
				}
			}
			const slice = record.slice;
			try {
				record.definition.update(record.handle, slice); // callback: contained, rechecked by deliver
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
	for (const child of touch(element, undefined, () =>
		Array.from(element.childNodes),
	)) {
		unmountOwnedSubtree(child);
	}
}

function disposeSettled(record: HostRecord): void {
	if (!record.settled) return;
	record.settled = false;
	try {
		record.definition.dispose(record.handle); // callback: contained, always runs
	} catch (error) {
		reportHostError("[ignite-jsx] Host dispose failed.", error);
	}
}

function dropRecord(element: Element, record: HostRecord): void {
	if (hostRecords.get(element) === record) hostRecords.delete(element);
	// Cleanup runs even when an abort listener superseded the commit.
	try {
		touch(element, undefined, () => record.controller.abort());
	} finally {
		record.stopMotion();
	}
}

function retireHost(element: Element): void {
	const record = hostRecords.get(element);
	if (!record) return;
	hostRecords.delete(element);
	// A listener that supersedes the commit stops it after the abort, but the
	// retired handle is still released: nothing else can dispose it.
	try {
		touch(element, undefined, () => record.controller.abort());
	} finally {
		record.stopMotion();
		disposeSettled(record);
	}
}

function descriptionIdTaken(
	element: Element,
	id: string,
	stamp?: Stamp,
): boolean {
	const root = touch(element, stamp, () => element.getRootNode());
	if (root instanceof Document || root instanceof ShadowRoot) {
		return touch(element, stamp, () => root.getElementById(id)) !== null;
	}
	const doc = touch(element, stamp, () => element.ownerDocument);
	return touch(element, stamp, () => doc.getElementById(id)) !== null;
}

function forgetDescriptionId(
	element: Element,
	id: string,
	stamp?: Stamp,
): void {
	descriptionIds.delete(element);
	editDescribedBy(element, id, stamp);
}

// Drops one id from aria-describedby. The read is user code: a newer view it
// renders owns the attribute, so nothing is edited after it.
function editDescribedBy(element: Element, id: string, stamp?: Stamp): void {
	const current = touch(element, stamp, () =>
		element.getAttribute("aria-describedby"),
	);
	if (!current) return;
	const next = current.split(/\s+/).filter((token) => token && token !== id);
	if (next.length === 0) {
		touch(element, stamp, () => element.removeAttribute("aria-describedby"));
	} else {
		touch(element, stamp, () =>
			element.setAttribute("aria-describedby", next.join(" ")),
		);
	}
}

function descriptionId(element: Element, stamp?: Stamp): string {
	const existing = descriptionIds.get(element);
	if (existing) {
		const node = descriptionNode(element, stamp);
		if (
			node?.id === existing ||
			!descriptionIdTaken(element, existing, stamp)
		) {
			return existing;
		}
		forgetDescriptionId(element, existing, stamp);
	}
	let id = "";
	do {
		descriptionSerial += 1;
		id = `ignite-host-desc-${descriptionSerial}`;
	} while (descriptionIdTaken(element, id, stamp));
	descriptionIds.set(element, id);
	return id;
}

function descriptionNode(element: Element, stamp?: Stamp): HTMLElement | null {
	const kids = touch(element, stamp, () => Array.from(element.children));
	for (const child of kids) {
		if (
			child instanceof HTMLElement &&
			touch(element, stamp, () => child.hasAttribute(DESCRIPTION_ATTR))
		) {
			return child;
		}
	}
	return null;
}

function clearDescription(element: Element, stamp?: Stamp): void {
	const id = descriptionIds.get(element);
	const node = descriptionNode(element, stamp);
	if (node) touch(element, stamp, () => node.remove());
	if (!id) return;
	editDescribedBy(element, id, stamp);
}

// An async settle runs outside any commit, so currency is the record itself.
function superseded(element: Element, stamp: Stamp): boolean {
	// Retiring or dropping a record deletes it, so it is also aborted.
	return (
		hostRecords.get(element) !== stamp.record ||
		(stamp.gen !== undefined && stamp.record.gen !== stamp.gen)
	);
}

function applyDescription(
	element: Element,
	definition: IgniteHostDefinition,
	slice: unknown,
	record?: HostRecord,
): void {
	// The generation is taken before describe runs: a describe that renders a
	// newer slice into this retained record makes everything below stale.
	const stamp = record && { record, gen: record.gen };
	if (!definition.describe) {
		clearDescription(element, stamp);
		return;
	}
	let text: unknown;
	let failed = false;
	try {
		text = definition.describe(slice); // callback: contained, rechecked below
	} catch (error) {
		reportHostError("[ignite-jsx] Host describe failed.", error);
		failed = true;
	}
	// No DOM write and no further callback follows a superseded describe.
	touch(element, stamp, () => undefined);
	if (failed) {
		clearDescription(element, stamp);
		return;
	}
	if (typeof text !== "string") return;
	const id = descriptionId(element, stamp);
	let node = descriptionNode(element, stamp);
	if (!node) {
		const doc = touch(element, stamp, () => element.ownerDocument);
		const fresh = touch(element, stamp, () => doc.createElement("span"));
		touch(element, stamp, () => {
			fresh.id = id;
		});
		touch(element, stamp, () => fresh.setAttribute(DESCRIPTION_ATTR, ""));
		const style = touch(element, stamp, () => fresh.style);
		touch(element, stamp, () => {
			style.cssText = VISUALLY_HIDDEN;
		});
		touch(element, stamp, () => element.append(fresh));
		node = fresh;
	}
	const target = node;
	if (touch(element, stamp, () => target.textContent) !== text) {
		touch(element, stamp, () => {
			target.textContent = text;
		});
	}
	const described = touch(element, stamp, () =>
		element.getAttribute("aria-describedby"),
	);
	const tokens = (described ?? "").split(/\s+/).filter(Boolean);
	if (!tokens.includes(id)) {
		tokens.push(id);
		touch(element, stamp, () =>
			element.setAttribute("aria-describedby", tokens.join(" ")),
		);
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
	// console.warn is user code: nothing after it acts on a superseded commit.
	touch(element, undefined, () =>
		console.warn(
			`[ignite-jsx] Unknown host "${name}". Declare it on the core's hosts map.`,
		),
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
			definition.dispose(handle); // callback: contained, always runs
		} catch (error) {
			reportHostError("[ignite-jsx] Host dispose failed.", error);
		}
		return;
	}
	record.handle = handle;
	record.settled = true;
	const afterDeliver = () =>
		applyDescription(element, definition, record.slice, record);
	if (deferDeliver) {
		pendingDeliver.push({ record, afterDeliver });
		return;
	}
	deliver(record, false);
	hostLive();
	if (superseded(element, { record })) return;
	afterDeliver();
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
		try {
			touch(element, undefined, () => current.controller.abort());
		} finally {
			current.stopMotion();
			disposeSettled(current);
		}
	});
}

function startHost(
	element: Element,
	name: string,
	definition: IgniteHostDefinition,
	runtime: IgniteHostRuntime,
	slice: unknown,
): void {
	// A descendant's dispose is user code: stop before this host registers.
	retireDescendantHosts(element);
	hostLive();
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
		gen: 0,
	};
	record.stopMotion = watchReducedMotion(() => {
		if (controller.signal.aborted) return;
		deliver(record, true);
	});
	hostRecords.set(element, record);
	ensureHostUnmount(element);
	const queuedBefore = deferredSends.length;
	let result: unknown;
	let failed = false;
	try {
		result = definition.mount(element, ctx); // callback: contained, rechecked below
	} catch (error) {
		failed = true;
		// Retire before the report (user code) so a render it makes mounts afresh.
		if (hostRecords.get(element) === record) {
			dropRecord(element, record);
			releaseHostSubtree(element);
		}
		reportHostError("[ignite-jsx] Host mount failed.", error);
	}
	// A send made by mount is delivered before the first update, however the
	// mount settles. Once the flush has run there is nothing left to wait for.
	const deferDeliver = deferredSends.length > queuedBefore;
	const fulfilled = (handle: unknown) => {
		guard(() =>
			acceptHandle(
				element,
				record,
				definition,
				handle,
				deferDeliver && flushScheduled,
			),
		);
	};
	const rejected = (error: unknown) => {
		// Retire first: the report is user code, and off a commit nothing stops
		// a render it makes from adopting this failed record as current.
		// An aborted record has already left hostRecords (both retire paths
		// delete before they abort), so identity alone decides.
		if (hostRecords.get(element) === record) {
			dropRecord(element, record);
			releaseHostSubtree(element);
		}
		reportHostError("[ignite-jsx] Host mount failed.", error);
	};
	// A mount that superseded this commit is settled like any async mount:
	// a late handle is disposed and a late rejection is reported.
	const own = { record };
	let thenable = false;
	try {
		if (failed) hostLive();
		else {
			thenable =
				touch(element, own, () => hasThen(result)) &&
				touch(element, own, () => thenIsFunction(result));
		}
	} catch (error) {
		// A superseded mount is still settled, so the late handle is disposed.
		if (!failed) settleSuperseded(result, fulfilled, rejected);
		throw error;
	}
	if (failed) return;
	if (thenable) {
		touch(element, own, () =>
			Promise.resolve(result).then(fulfilled, rejected),
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
			slice: definition.select ? definition.select(snapshot) : snapshot, // callback: contained, rechecked by sync
		};
	} catch (error) {
		reportHostError("[ignite-jsx] Host select failed.", error);
		return { ok: false };
	}
}

// Retire a host: dispose is user code, so nothing follows a superseded commit.
function dropHost(element: Element): void {
	retireHost(element);
	hostLive();
	releaseHostSubtree(element);
	clearDescription(element);
}

export function syncHostElement(element: Element, useName: unknown): void {
	const runtime = activeRuntime;
	if (!runtime) return;
	if (typeof useName !== "string" || useName.length === 0) {
		dropHost(element);
		return;
	}
	if (!ownName(runtime.hosts, useName)) {
		if (__IGNITE_DEV_WARNINGS__) warnUnknownHost(element, useName);
		dropHost(element);
		return;
	}
	const definition = runtime.hosts[useName];
	if (!definition) {
		if (__IGNITE_DEV_WARNINGS__) warnUnknownHost(element, useName);
		dropHost(element);
		return;
	}
	claimHostSubtree(element);
	const selected = readSlice(definition, runtime.snapshot);
	// Host callbacks are user code: a superseded commit stops after each one.
	hostLive();
	if (!selected.ok) {
		dropHost(element);
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
		if (existing) {
			retireHost(element);
			hostLive();
		}
		startHost(element, useName, definition, runtime, slice);
		applyDescription(element, definition, slice);
		return;
	}
	existing.slice = slice;
	existing.gen += 1;
	existing.hasSlice = true;
	deliver(existing, false);
	hostLive();
	applyDescription(element, definition, slice);
}

installHostSync(syncHostElement);
installHostRuntime(withIgniteHostRuntime);
