import { uriBearingKeyPattern, uriSpacePattern } from "./executableUri";
import {
	configureHostOwnership,
	type HostOwnershipTools,
	type IgniteHostRuntime,
	syncHostElement,
	useHostOwnership,
	withIgniteHostRuntime,
} from "./hostBridge";
import { isNoDiffDenylistedTag } from "./noDiffDenylist";
import {
	Fragment,
	type IgniteJsxChild,
	type IgniteJsxProps,
	isIgniteJsxElement,
	normalizeChildren,
} from "./types";
import {
	cssTextWithoutUrls,
	cssValueForStyle,
	decorativeUrlBlocked,
	isExtraUrlName,
	isForbiddenProp,
	isHandlerKey,
	isStylesheetLink,
	isUrlPartKey,
	linkReflectsStylesheet,
	readTrustedStyle,
	scriptElementOmitted,
	styleSheetFromChildren,
	urlValueBlocked,
} from "./xssGuard";

declare const __IGNITE_DEV_WARNINGS__: boolean;
declare const __IGNITE_HOST_RUNTIME__: boolean | undefined;

// Stryker disable all

// Example browser configs leave this unset. Library builds replace it.
const hostRuntimeEnabled =
	typeof __IGNITE_HOST_RUNTIME__ !== "undefined" && __IGNITE_HOST_RUNTIME__;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
// Spec nodeType values. Disconnect cleanup runs in example tests that have
// elements but no DOM `Node` constructor.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const DOCUMENT_FRAGMENT_NODE = 11;
const CAMEL_CASE_SVG_ATTRS = new Set([
	"viewBox",
	"preserveAspectRatio",
	"clipPathUnits",
	"gradientUnits",
	"patternUnits",
	"spreadMethod",
	"startOffset",
	"textLength",
	"lengthAdjust",
	"attributeName",
]);

type NormalizedNode =
	| {
			kind: "element";
			tag: string;
			props: IgniteJsxProps;
			children: NormalizedNode[];
			namespace?: string;
			key?: string | number | null;
	  }
	| { kind: "text"; value: string; trusted?: boolean }
	| { kind: "comment"; comment?: string };

export function createDomNode(
	node: IgniteJsxChild,
	namespace?: string,
): Node | DocumentFragment {
	return commitRender(() => {
		const normalized = normalizeChild(node, namespace);
		if (normalized.length === 1) {
			return createDomFromNormalized(normalized[0]);
		}
		const fragment = document.createDocumentFragment();
		claim(fragment);
		for (const child of normalized) {
			act(fragment, "appendChild", createDomFromNormalized(child));
		}
		return fragment;
	});
}

export function mountIgniteJsx(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
	options: RenderOptions = {},
): NormalizedNode[] {
	return renderIgniteJsx(host, view, undefined, options);
}

type RenderOptions = {
	mode?: "diff" | "replace";
	onFallbackReplace?: (reason: string) => void;
	hosts?: IgniteHostRuntime;
	/** Called once the DOM matches the tree, before refs and controlled writes. */
	onTreePublished?: (tree: NormalizedNode[]) => void;
};

export function renderIgniteJsx(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
	previous?: NormalizedNode[],
	options: RenderOptions = {},
): NormalizedNode[] {
	if (hostRuntimeEnabled) {
		return withIgniteHostRuntime(options.hosts, () =>
			renderIgniteJsxNow(host, view, previous, options),
		);
	}
	return renderIgniteJsxNow(host, view, previous, options);
}

function renderIgniteJsxNow(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
	previous: NormalizedNode[] | undefined,
	options: RenderOptions,
): NormalizedNode[] {
	const epoch = (host as Owned)[owner];
	// A root being detached takes no new commit: the detach pass could not
	// release what it acquired.
	if (epoch === detaching) return [];
	return commitRender(() => {
		const frame = commitQueue as unknown as Frame;
		frame.h = host;
		frame.e = epoch;
		frame.r = !previous;
		const next = normalizeRoot(view);

		if (
			options.mode === "replace" ||
			!previous ||
			host.childNodes.length === 0
		) {
			replaceAll(host, next);
		} else if (
			!patchChildren(host, previous, next, options.onFallbackReplace)
		) {
			replaceAll(host, next);
		}
		// The last read before this (a focus lookup, a node-type read) may have
		// been user code that rendered a newer view: nothing publishes over it.
		live();
		// act() unwound any render a detach or newer commit revoked: this publishes.
		(host as Owned)[owner] = commitQueue as unknown as Token;
		options.onTreePublished?.(next);
		return next;
	}, host);
}

function normalizeRoot(view: IgniteJsxChild): NormalizedNode[] {
	const nodes = normalizeChild(view, undefined);
	warnInvalidKeys(nodes);
	return nodes;
}

function normalizeChild(
	node: IgniteJsxChild,
	namespace?: string,
): NormalizedNode[] {
	if (Array.isArray(node)) {
		return node.flatMap((child) => normalizeChild(child, namespace));
	}

	if (node === null || node === undefined || node === false || node === true) {
		return [{ kind: "comment" }];
	}

	if (typeof node === "string" || typeof node === "number") {
		return [{ kind: "text", value: String(node) }];
	}

	if (!isIgniteJsxElement(node)) {
		const trusted = readTrustedStyle(node);
		if (trusted !== undefined) {
			return [{ kind: "text", value: trusted, trusted: true }];
		}
		return [
			{ kind: "comment", comment: "ignite-unknown" } as {
				kind: "comment";
				comment: "ignite-unknown";
			},
		];
	}

	if (node.type === Fragment) {
		return applySlotKey(
			node.key,
			normalizeChildren(node.props.children).flatMap((child) =>
				normalizeChild(child, namespace),
			),
		);
	}

	if (typeof node.type === "function") {
		const result = act<IgniteJsxChild>(node, "type", node.props);
		return applySlotKey(node.key, normalizeChild(result, namespace));
	}

	const tagName = String(node.type);
	const isSlot = tagName === "slot";
	const isSvgRoot = tagName === "svg";
	const useSvgNamespace = isSvgRoot || namespace === SVG_NAMESPACE;
	const childNamespace =
		isSvgRoot || (useSvgNamespace && tagName !== "foreignObject")
			? SVG_NAMESPACE
			: undefined;

	const normalizedChildren = isSlot
		? []
		: normalizeChildren(node.props.children).flatMap((child) =>
				normalizeChild(child, childNamespace),
			);
	warnInvalidKeys(normalizedChildren);

	const lowerTag = localTag(tagName);
	if (lowerTag === "style") {
		const sheet = styleSheetFromChildren(normalizedChildren);
		if (__IGNITE_DEV_WARNINGS__ && sheet.droppedUrl) {
			warn(
				"[ignite-jsx] `style` text dropped a url(). Pass trustedStyle() to keep it.",
			);
		}
		let wroteText = false;
		const nextChildren: NormalizedNode[] = [];
		for (const child of normalizedChildren) {
			if (child.kind !== "text") {
				nextChildren.push(child);
				continue;
			}
			if (wroteText) continue;
			wroteText = true;
			nextChildren.push({
				kind: "text",
				value: sheet.css,
				trusted: true,
			});
		}
		normalizedChildren.length = 0;
		normalizedChildren.push(...nextChildren);
	}
	// Stryker restore all
	if (
		(lowerTag === "script" &&
			scriptElementOmitted(normalizedChildren, node.props)) ||
		(lowerTag === "link" && isStylesheetLink(node.props))
	) {
		// Stryker disable all
		if (__IGNITE_DEV_WARNINGS__) {
			warn(`[ignite-jsx] \`${lowerTag}\` was not created.`);
		}
		return [];
	}

	return [
		{
			kind: "element",
			tag: tagName,
			props: node.props,
			namespace: useSvgNamespace ? SVG_NAMESPACE : undefined,
			children: normalizedChildren,
			key: node.key ?? null,
		},
	];
}

type RefDisposer = () => void | PromiseLike<void>;

type RefCallback = (
	element: Element | null,
) => void | RefDisposer | PromiseLike<void>;

interface ElementMount {
	pending?: () => void;
	binding?: () => void;
	ref: RefCallback | null;
	/** Disposer returned by the current ref. Absent when the ref returns nothing. */
	cleanup: RefDisposer | null;
	hooks: Array<() => void>;
	unmounted: boolean;
	/** True after a true-disconnect release that kept the callback for reacquire. */
	released: boolean;
}

const elementMounts = new WeakMap<Node, ElementMount>();
const subtreeOwners = new WeakSet<Element>();
const deprecatedContentWarnings = new WeakMap<Element, Set<string>>();

function nodeKey(node: NormalizedNode): string | number | undefined {
	if (node.kind !== "element" || node.key == null) return undefined;
	return node.key;
}

type KeyShape = "none" | "keyed" | "duplicate" | "mixed";

function isMaterialSibling(node: NormalizedNode): boolean {
	return node.kind !== "comment";
}

function classifyKeys(children: NormalizedNode[]): KeyShape {
	const seen = new Set<string | number>();
	let keyed = 0;
	let material = 0;
	for (const child of children) {
		if (!isMaterialSibling(child)) continue;
		material += 1;
		const key = nodeKey(child);
		if (key === undefined) continue;
		if (seen.has(key)) return "duplicate";
		seen.add(key);
		keyed += 1;
	}
	if (keyed === 0) return "none";
	if (keyed !== material) return "mixed";
	return "keyed";
}

function duplicateKey(children: NormalizedNode[]): string | number | undefined {
	const seen = new Set<string | number>();
	for (const child of children) {
		const key = nodeKey(child);
		if (key === undefined) continue;
		if (seen.has(key)) return key;
		seen.add(key);
	}
	return undefined;
}

// console.warn is user code (an app can replace it), so every dev warning
// goes through here and ownership is rechecked before the commit goes on.
function warn(message: string): void {
	console.warn(message);
	live();
}

function warnInvalidKeys(children: NormalizedNode[]): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	const shape = classifyKeys(children);
	if (shape === "duplicate") {
		const key = duplicateKey(children);
		warn(
			`[ignite-jsx] Duplicate key "${String(key)}" among siblings. Keys must be unique.`,
		);
		return;
	}
	if (shape === "mixed") {
		warn(
			"[ignite-jsx] Mixed keyed and unkeyed siblings. The list will match by position.",
		);
	}
}

function applySlotKey(
	key: string | number | null | undefined,
	nodes: NormalizedNode[],
): NormalizedNode[] {
	if (key == null) return nodes;
	const material = nodes.filter(isMaterialSibling);
	if (material.length === 1 && material[0]?.kind === "element") {
		material[0].key = key;
		return nodes;
	}
	if (__IGNITE_DEV_WARNINGS__) {
		warn(
			`[ignite-jsx] Key "${String(key)}" requires a single element, but the component returned ${material.length} nodes.`,
		);
	}
	return nodes;
}

function warnIgnoredProp(element: Element, key: string, message: string): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	let seen = deprecatedContentWarnings.get(element);
	if (!seen) {
		seen = new Set();
		deprecatedContentWarnings.set(element, seen);
	}
	if (seen.has(key)) return;
	seen.add(key);
	warn(message);
}

function warnBlockedMarkupProp(element: Element, key: string): void {
	warnIgnoredProp(
		element,
		key,
		`[ignite-jsx] \`${key}\` is ignored and not applied. Use JSX children for text, and hosts for trusted rich content.`,
	);
}

function warnBlockedUrl(element: Element, key: string): void {
	warnIgnoredProp(
		element,
		`url:${key}`,
		`[ignite-jsx] \`${key}\` was not applied because its URL scheme is not allowed.`,
	);
}

function warnDroppedControl(element: Element, key: string): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	warnIgnoredProp(
		element,
		`drop:${key}`,
		`[ignite-jsx] \`${key}\` dropped on a controlled ${element.localName}; pass it every render or use a catalog form component`,
	);
}

function warnDuplicateProps(
	element: Element,
	props: IgniteJsxProps,
	isSvg: boolean,
): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	const seen: Record<string, string> = {};
	for (const key of Object.keys(props)) {
		if (key === "children" || key === "ref" || isForbiddenProp(key)) continue;
		const id = sinkKey(element, key, isSvg);
		const prev = seen[id];
		if (prev) {
			warnIgnoredProp(
				element,
				`dup:${id}`,
				`[ignite-jsx] \`${prev}\` and \`${key}\` are two spellings of one prop. Pass one. Production behavior is unspecified.`,
			);
			continue;
		}
		seen[id] = key;
	}
}

function localTag(tagName: string): string {
	const lower = tagName.toLowerCase();
	const colon = lower.lastIndexOf(":");
	return colon < 0 ? lower : lower.slice(colon + 1);
}

function isBlockedMarkupProp(element: Element, key: string): boolean {
	const normalized = key.toLowerCase();
	if (normalized === "text" && localTag(element.localName) === "script") {
		return true;
	}
	return (
		normalized === "dangerouslysetinnerhtml" ||
		normalized === "innerhtml" ||
		normalized === "outerhtml" ||
		normalized === "innertext" ||
		normalized === "outertext" ||
		normalized === "textcontent" ||
		normalized === "srcdoc" ||
		normalized === "length" ||
		normalized === "options" ||
		normalized === "selectedoptions"
	);
}

function isEventHandlerKey(key: string): boolean {
	return isHandlerKey(key);
}

function isIgnoredHandlerAttribute(key: string): boolean {
	const name = key.toLowerCase();
	return isEventHandlerKey(name) || name.startsWith("xlink:on");
}

function strippedUri(value: string): string {
	uriSpacePattern.lastIndex = 0;
	return value.replace(uriSpacePattern, "").toLowerCase();
}

// Meta refresh keys use the same normalization as a SMIL attributeName:
// lowercase, strip ASCII space and controls, then the local part after the
// last ":" or "}". The DOM name is http-equiv, so setAttribute never sees
// the space or NUL that would throw InvalidCharacterError.
function metaRefreshKey(element: Element, key: string): boolean {
	if (element.localName.toLowerCase() !== "meta") return false;
	const name = strippedUri(key).split(/[:}]/).pop();
	return name === "http-equiv" || name === "httpequiv";
}

function smilHrefTarget(value: unknown): boolean {
	// A non-string name is treated as href so from/to/by/values cannot stay
	// on a bare animate. Absent and null names are not href targets.
	return typeof value === "string"
		? strippedUri(value).split(/[:}]/).pop() === "href"
		: value != null;
}

const smilKeys = /^(attributeName|from|to|by|values)$/i;

function isSmil(element: Element): boolean {
	const tag = element.localName.toLowerCase();
	return tag === "animate" || tag === "set" || tag === "animatemotion";
}

// A SMIL value is only safe or unsafe relative to the attribute it animates,
// so the DOM must never hold a value next to a target that makes it
// executable. The guard reads the next props, so it describes the DOM only
// once the target is committed. Retract first instead: every SMIL prop that is
// dropped, changed, or blocked for the next props is removed before the main
// loop writes anything. The DOM then holds only values that are unchanged and
// safe under any target, and the rewrite of a changed attributeName or value
// never sits next to a stale partner, whatever the key order.
function settleSmil(
	element: Element,
	oldProps: IgniteJsxProps,
	newProps: IgniteJsxProps,
): void {
	if (!isSmil(element)) return;
	for (const key of Object.keys(oldProps)) {
		if (!smilKeys.test(key)) continue;
		const kept = sinkMatch(newProps, element, key, true);
		if (!kept || newProps[kept] !== oldProps[key]) {
			removeProp(element, key, true);
		}
	}
}

// Stryker disable all
function isBlockedUrlValue(
	element: Element,
	key: string,
	value: unknown,
	props?: IgniteJsxProps,
): boolean {
	if (value == null || value === false) return false;
	const name =
		key.toLowerCase() === "xlinkhref" ? "xlink:href" : key.toLowerCase();
	const tag = element.localName.toLowerCase();
	// <base href> retargets relative URLs, so it is never written.
	if (tag === "base" && name === "href") return true;
	// A string attributeName is lowercased, whitespace and ASCII controls
	// are removed, then any Clark or namespace prefix is removed. href,
	// and any non-string attributeName, drops from, to, by, and values.
	if (
		isSmil(element) &&
		(name === "from" || name === "to" || name === "by" || name === "values") &&
		smilHrefTarget(props?.attributeName)
	) {
		return true;
	}
	// Stryker restore all
	if (decorativeUrlBlocked(tag, name, value)) return true;
	// Stryker disable all
	const metaEquiv = metaRefreshKey(element, key);
	const guarded =
		name === "attributename" ||
		name === "codebase" ||
		metaEquiv ||
		uriBearingKeyPattern.test(name) ||
		(name === "data" && tag === "object") ||
		isExtraUrlName(name);
	if (!guarded) return false;
	// Reject a non-string before any check. The string that is checked is
	// the same string that is written.
	if (typeof value !== "string") return true;
	if (metaEquiv) {
		return strippedUri(value) === "refresh";
	}
	if (name === "attributename") return false;
	// Stryker restore all
	return urlValueBlocked(name, value, tag);
}

// Stryker disable all
function ensureMount(node: Node): ElementMount {
	let mount = elementMounts.get(node);
	if (!mount) {
		mount = {
			ref: null,
			cleanup: null,
			hooks: [],
			unmounted: false,
			released: false,
		};
		elementMounts.set(node, mount);
	}
	return mount;
}

/** Hosts claim an element so the differ never touches its subtree. */
export function claimSubtree(element: Element): void {
	subtreeOwners.add(element);
}

export function releaseSubtree(element: Element): void {
	subtreeOwners.delete(element);
}

const hostTools: HostOwnershipTools | undefined = hostRuntimeEnabled
	? {
			claimSubtree,
			releaseSubtree,
			onUnmount: onIgniteUnmount,
			// Host callbacks also run after the write phase, with no frame.
			live: () => commitQueue && live(),
			unmountSubtree: unmountIgniteSubtree,
		}
	: undefined;
if (hostTools) configureHostOwnership(hostTools);

const freshNodes = new WeakSet<ChildNode>();

function commitFresh(node: ChildNode, normalized: NormalizedNode): void {
	if (!freshNodes.has(node)) return;
	freshNodes.delete(node);
	if (node.nodeType !== ELEMENT_NODE || normalized.kind !== "element") {
		return;
	}
	const element = node as Element;
	// A failed host mount retires descendant refs before commitFresh reaches
	// them. Rebind here; an already-bound fresh node returns immediately.
	if (hostRuntimeEnabled) assignRef(element, normalized.props.ref);
	syncHostElement(element, normalized.props.use);
	live();
	if (hostRuntimeEnabled && subtreeOwners.has(element)) return;
	const children = Array.from(element.childNodes);
	for (let index = 0; index < normalized.children.length; index++) {
		const child = children[index];
		const spec = normalized.children[index];
		if (child && spec) commitFresh(child, spec);
	}
}

/**
 * Register a hook on the shared unmount path. It runs before the node is
 * detached, exactly once.
 */
export function onIgniteUnmount(node: Node, hook: () => void): void {
	const mount = ensureMount(node);
	if (mount.unmounted) return;
	mount.hooks.push(hook);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		"then" in value &&
		typeof (value as { then?: unknown }).then === "function"
	);
}

// A logger or error handler is user code: nothing it throws escapes the
// reporter (the callers of invokeContained have no abort catch to receive it).
function reportRendererError(node: Node, error: unknown): void {
	const log = (message: string, reason: unknown) => {
		try {
			console.error(message, reason);
		} catch {
			// Nothing to report a failing logger to.
		}
	};
	try {
		const root = node.getRootNode();
		const host = root instanceof ShadowRoot ? root.host : null;
		const candidate = host as {
			handleError?: (error: unknown) => void;
			onError?: (error: unknown) => void;
		} | null;
		const handler = candidate?.handleError ?? candidate?.onError;
		if (typeof handler === "function") {
			handler.call(host, error);
			return;
		}
	} catch (handlerError) {
		log("[ignite-jsx] Error handler failed.", handlerError);
	}
	log("[ignite-jsx] Callback failed.", error);
}

function observeRejection(node: Node, result: unknown): void {
	if (!isPromiseLike(result)) return;
	Promise.resolve(result).then(undefined, (error: unknown) => {
		reportRendererError(node, error);
	});
}

function invokeContained(node: Node, callback: () => unknown): void {
	try {
		observeRejection(node, callback());
	} catch (error) {
		reportRendererError(node, error);
	}
}

function releaseRefBinding(
	node: Node,
	ref: RefCallback,
	cleanup: RefDisposer | null,
): void {
	if (cleanup) invokeContained(node, cleanup);
	else invokeContained(node, () => ref(null));
}

function releaseStoredRef(node: Node, mount: ElementMount): void {
	const ref = mount.ref;
	const cleanup = mount.cleanup;
	mount.ref = null;
	mount.cleanup = null;
	if (!ref) return;
	releaseRefBinding(node, ref, cleanup);
}

/** Shared unmount path. Runs before detach, exactly once per mount. */
export function unmountIgniteSubtree(node: Node): void {
	composing.set(node, false);
	if (
		node.nodeType === ELEMENT_NODE ||
		node.nodeType === DOCUMENT_FRAGMENT_NODE
	) {
		for (const child of Array.from(node.childNodes)) {
			unmountIgniteSubtree(child);
		}
	}
	const mount = elementMounts.get(node);
	if (!mount || mount.unmounted) return;
	mount.unmounted = true;
	const hooks = mount.hooks.splice(0, mount.hooks.length);
	for (const hook of hooks) invokeContained(node, hook);
	releaseStoredRef(node, mount);
	elementMounts.delete(node);
}

// Each commit has two ordered phases: controlled writes, then ref acquisition.
// Queue writers are private; all create/render/reacquire paths establish a frame.
let commitQueue: [(() => void)[], (() => void)[]];
function assignRef(element: Element, ref: unknown): void {
	const mount = ensureMount(element);
	const acquire = () => {
		if (mount.unmounted || mount.pending !== acquire) return;
		const next = typeof ref === "function" ? (ref as RefCallback) : null;
		if (mount.ref === next && !mount.released) return;
		if (mount.ref && !mount.released) {
			releaseStoredRef(element, mount);
			if (mount.unmounted || mount.pending !== acquire) return;
		}
		mount.ref = next;
		mount.released = false;
		mount.binding = acquire;
		if (!next) return;
		invokeContained(element, () => {
			let result: ReturnType<RefCallback> | undefined;
			// This call's own marker: a teardown that arrives while it runs is
			// owed to this callback alone, whatever nested refs do meanwhile.
			let late = false;
			const hold = () => {
				late = true;
			};
			mount.cleanup = hold;
			try {
				result = next(element);
			} finally {
				if (mount.cleanup === hold) mount.cleanup = null;
				if (late && typeof result !== "function") {
					invokeContained(element, () => next(null));
				}
			}
			if (typeof result === "function") {
				if (!late && !mount.released && mount.binding === acquire)
					mount.cleanup = result;
				else invokeContained(element, result);
				return;
			}
			return result;
		});
	};
	mount.pending = acquire;
	commitQueue[1].push(acquire);
}

function releaseNodeRefs(node: Node): void {
	if (
		node.nodeType === ELEMENT_NODE ||
		node.nodeType === DOCUMENT_FRAGMENT_NODE
	) {
		for (const child of Array.from(node.childNodes)) {
			releaseNodeRefs(child);
		}
	}
	const mount = elementMounts.get(node);
	if (!mount || mount.unmounted || mount.released || !mount.ref) return;
	const ref = mount.ref;
	const cleanup = mount.cleanup;
	mount.cleanup = null;
	mount.released = true;
	releaseRefBinding(node, ref, cleanup);
}

function reacquireNodeRefs(node: Node): void {
	if (node instanceof Element) {
		const mount = elementMounts.get(node);
		if (mount && !mount.unmounted && mount.released && mount.ref) {
			assignRef(node, mount.ref);
		}
	}
	if (
		node.nodeType === ELEMENT_NODE ||
		node.nodeType === DOCUMENT_FRAGMENT_NODE
	) {
		for (const child of Array.from(node.childNodes)) {
			reacquireNodeRefs(child);
		}
	}
}

/** Release one-shot refs after a true disconnect without removing DOM. */
export function releaseMountedView(root: ParentNode): void {
	for (const child of Array.from(root.childNodes)) {
		releaseNodeRefs(child);
	}
}

/** Acquire one-shot refs again after a later reconnect. */
export function reacquireMountedView(root: ParentNode): void {
	commitRender(() => {
		for (const child of Array.from(root.childNodes)) {
			reacquireNodeRefs(child);
		}
	});
}

function detachChild(parent: ParentNode, child: ChildNode): void {
	unmountIgniteSubtree(child);
	act(parent, "removeChild", child);
}

function patchChildren(
	parent: ParentNode,
	oldChildren: NormalizedNode[],
	newChildren: NormalizedNode[],
	onFallbackReplace?: (reason: string) => void,
): boolean {
	const nextShape = classifyKeys(newChildren);
	const previousShape = classifyKeys(oldChildren);
	if (nextShape === "keyed" && !keyShapeIsInvalid(previousShape)) {
		return patchKeyedChildren(
			parent,
			oldChildren,
			newChildren,
			onFallbackReplace,
		);
	}
	// Positional patching keeps existing elements when siblings change kind. An
	// append-only update leaves extra DOM nodes alone and needs every old one.
	const compat = isAppendOnlyCompatible(oldChildren, newChildren);
	const maxLen = compat
		? newChildren.length
		: Math.max(oldChildren.length, newChildren.length);
	for (let i = 0; i < maxLen; i++) {
		const domChild = parent.childNodes[i];
		if (i >= oldChildren.length) {
			act(parent, "appendChild", createDomFromNormalized(newChildren[i]));
			if (hostRuntimeEnabled) {
				const created = newChildren[i];
				const placed = parent.lastChild;
				if (created && placed) commitFresh(placed, created);
			}
		} else if (!domChild) {
			if (compat) return false;
		} else if (i >= newChildren.length) {
			detachChild(parent, domChild);
		} else {
			const patched = patchNode(
				domChild,
				oldChildren[i],
				newChildren[i],
				onFallbackReplace,
			);
			if (patched !== domChild) {
				act(parent, "replaceChild", patched, domChild);
				if (hostRuntimeEnabled) {
					const spec = newChildren[i];
					if (spec) commitFresh(patched, spec);
				}
			}
		}
	}
	while (
		!compat &&
		parent.childNodes.length > newChildren.length &&
		parent.lastChild
	) {
		detachChild(parent, parent.lastChild);
	}
	return true;
}

function patchKeyedChildren(
	parent: ParentNode,
	oldChildren: NormalizedNode[],
	newChildren: NormalizedNode[],
	onFallbackReplace?: (reason: string) => void,
): boolean {
	const domNodes = Array.from(parent.childNodes);
	if (domNodes.length < oldChildren.length) return false;
	const focused = focusedWithin(parent);

	const oldDom = domNodes.slice(0, oldChildren.length);
	const byKey = new Map<
		string | number,
		{ index: number; node: NormalizedNode; dom: ChildNode }
	>();
	const unkeyedOld: number[] = [];
	for (let index = 0; index < oldChildren.length; index++) {
		const key = nodeKey(oldChildren[index]);
		if (key === undefined) {
			unkeyedOld.push(index);
			continue;
		}
		if (!byKey.has(key)) {
			byKey.set(key, { index, node: oldChildren[index], dom: oldDom[index] });
		}
	}

	const used = new Set<number>();
	const nextDom: ChildNode[] = [];
	let unkeyedCursor = 0;
	for (const child of newChildren) {
		const key = nodeKey(child);
		if (key !== undefined) {
			const match = byKey.get(key);
			if (match && !used.has(match.index)) {
				used.add(match.index);
				const patched = patchNode(
					match.dom,
					match.node,
					child,
					onFallbackReplace,
				);
				if (patched !== match.dom && match.dom.parentNode) {
					act(match.dom.parentNode, "removeChild", match.dom);
				}
				nextDom.push(patched);
				continue;
			}
			nextDom.push(createDomFromNormalized(child));
			continue;
		}

		const oldIndex = unkeyedOld[unkeyedCursor++];
		if (oldIndex !== undefined && !used.has(oldIndex)) {
			used.add(oldIndex);
			const dom = oldDom[oldIndex];
			const patched = patchNode(
				dom,
				oldChildren[oldIndex],
				child,
				onFallbackReplace,
			);
			if (patched !== dom && dom.parentNode)
				act(dom.parentNode, "removeChild", dom);
			nextDom.push(patched);
			continue;
		}
		nextDom.push(createDomFromNormalized(child));
	}

	for (let index = 0; index < oldChildren.length; index++) {
		if (!used.has(index)) detachChild(parent, oldDom[index]);
	}

	let cursor: ChildNode | null = parent.firstChild;
	for (let index = 0; index < nextDom.length; index++) {
		const node = nextDom[index];
		if (!node) continue;
		if (node === cursor) {
			cursor = node.nextSibling;
		} else {
			act(parent, "insertBefore", node, cursor);
		}
		if (hostRuntimeEnabled) {
			const spec = newChildren[index];
			if (spec) commitFresh(node, spec);
		}
	}
	// Moving a node drops focus in some DOM implementations. Restore the
	// element that was focused inside this parent, including inside a shadow root.
	const current = focusedWithin(parent);
	if (focused?.isConnected && current !== focused) {
		act(focused, "focus");
	}
	return true;
}

function focusedWithin(parent: ParentNode): HTMLElement | null {
	const root = parent.getRootNode();
	const active =
		root instanceof Document || root instanceof ShadowRoot
			? root.activeElement
			: null;
	if (!(active instanceof HTMLElement)) return null;
	const doc = parent.ownerDocument ?? document;
	if (active === doc.body || active === parent) return null;
	if (!parent.contains(active)) return null;
	return active;
}

function keyShapeIsInvalid(shape: KeyShape): boolean {
	return shape === "duplicate" || shape === "mixed";
}

function replaceMounted(
	domNode: ChildNode,
	newNode: NormalizedNode,
): ChildNode {
	unmountIgniteSubtree(domNode);
	return createDomFromNormalized(newNode);
}

function patchNode(
	domNode: ChildNode,
	oldNode: NormalizedNode,
	newNode: NormalizedNode,
	onFallbackReplace?: (reason: string) => void,
): ChildNode {
	if (oldNode.kind !== newNode.kind) {
		return replaceMounted(domNode, newNode);
	}

	if (newNode.kind === "text") {
		if (domNode.nodeType !== TEXT_NODE) {
			return replaceMounted(domNode, newNode);
		}
		if (domNode.textContent !== newNode.value) {
			setContained(domNode, "textContent", newNode.value);
		}
		return domNode;
	}

	if (newNode.kind === "comment") {
		if (domNode.nodeType !== COMMENT_NODE) {
			return replaceMounted(domNode, newNode);
		}
		return domNode;
	}

	// element
	if (newNode.kind !== "element" || oldNode.kind !== "element") {
		return createDomFromNormalized(newNode);
	}

	if (isNoDiffDenylistedTag(newNode.tag)) {
		if (__IGNITE_DEV_WARNINGS__) {
			onFallbackReplace?.(`denylist:${newNode.tag.toLowerCase()}`);
		}
		return replaceMounted(domNode, newNode);
	}

	if (
		domNode.nodeType !== ELEMENT_NODE ||
		(domNode as Element).namespaceURI !==
			(newNode.namespace ?? (domNode as Element).namespaceURI) ||
		(domNode as Element).tagName.toLowerCase() !== newNode.tag.toLowerCase()
	) {
		return replaceMounted(domNode, newNode);
	}

	const elementNode = domNode as Element & ParentNode;
	const nextUse = newNode.props.use;

	patchProps(elementNode, oldNode.props, newNode.props);
	// Content props are never applied, so they do not own the subtree. A host
	// claim still does. Read it before sync, which may release the claim.
	const previouslyOwned = hostRuntimeEnabled && subtreeOwners.has(elementNode);
	if (hostRuntimeEnabled) {
		syncHostElement(elementNode, nextUse);
		live();
	}
	// A host claim is opaque. Skip child diffing so the positional patch does
	// not desync against untracked DOM nodes (issue #57).
	if (hostRuntimeEnabled && subtreeOwners.has(elementNode)) {
		flushSelectValue(elementNode, newNode.props);
		assignRef(elementNode, newNode.props.ref);
		return domNode;
	}
	// The previous render owned the subtree. Clear it before reconciling JSX
	// children, including when a host released its claim on this render.
	if (previouslyOwned) {
		while (elementNode.firstChild) {
			detachChild(elementNode, elementNode.firstChild);
		}
	}

	const childNamespace =
		newNode.namespace === SVG_NAMESPACE && newNode.tag !== "foreignObject"
			? SVG_NAMESPACE
			: undefined;

	const mappedChildren = newNode.children.map((child) =>
		child.kind === "element" && child.namespace === undefined
			? { ...child, namespace: childNamespace }
			: child,
	);

	if (
		!patchChildren(
			elementNode,
			oldNode.children,
			mappedChildren,
			onFallbackReplace,
		)
	) {
		// fallback replace
		while (elementNode.firstChild) {
			detachChild(elementNode, elementNode.firstChild);
		}
		for (const child of mappedChildren) {
			act(elementNode, "appendChild", createDomFromNormalized(child));
			if (hostRuntimeEnabled) {
				const placed = elementNode.lastChild;
				if (placed) commitFresh(placed, child);
			}
		}
	}

	flushSelectValue(elementNode, newNode.props);
	assignRef(elementNode, newNode.props.ref);
	return domNode;
}

function createDomFromNormalized(node: NormalizedNode): ChildNode {
	switch (node.kind) {
		case "text":
			return document.createTextNode(node.value);
		case "comment":
			return document.createComment(
				"comment" in node && typeof node.comment === "string"
					? node.comment
					: "ignite-empty",
			);
		case "element": {
			const element = node.namespace
				? act<Element>(document, "createElementNS", node.namespace, node.tag)
				: act<Element>(document, "createElement", node.tag);
			claim(element);
			patchProps(element, {}, node.props);
			for (const child of node.children) {
				act(element, "appendChild", createDomFromNormalized(child));
			}
			flushSelectValue(element, node.props);
			assignRef(element, node.props.ref);
			if (hostRuntimeEnabled) freshNodes.add(element);
			return element;
		}
	}
}

function isAppendOnlyCompatible(
	oldChildren: NormalizedNode[],
	newChildren: NormalizedNode[],
): boolean {
	if (newChildren.length < oldChildren.length) {
		return false;
	}

	for (let i = 0; i < oldChildren.length; i++) {
		if (!isSameKind(oldChildren[i], newChildren[i])) {
			return false;
		}
	}

	return true;
}

function isSameKind(a: NormalizedNode, b: NormalizedNode): boolean {
	if (a.kind !== b.kind) {
		return false;
	}
	if (a.kind === "element" && b.kind === "element") {
		return a.tag === b.tag && (a.namespace ?? "") === (b.namespace ?? "");
	}
	return true;
}

function patchProps(
	element: Element,
	oldProps: IgniteJsxProps,
	newProps: IgniteJsxProps,
) {
	const isSvgElement = element instanceof SVGElement;
	if (
		!isSvgElement &&
		(element.localName === "input" || element.localName === "textarea")
	) {
		watchComposition(element as HTMLElement);
	}
	// One listener per event. The last spelling in prop order wins.
	patchEventSlots(element, oldProps, newProps, "removeEventListener");
	if (__IGNITE_DEV_WARNINGS__) {
		warnDuplicateProps(element, newProps, isSvgElement);
	}

	settleSmil(element, oldProps, newProps);

	// Drops run first so a setter or attribute written for a present spelling
	// is never erased by the drop of a differently cased old one.
	for (const key of Object.keys(oldProps)) {
		if (hostRuntimeEnabled && key === "use") continue;
		if (isForbiddenProp(key)) continue;
		if (
			key === "children" ||
			key === "ref" ||
			isBlockedMarkupProp(element, key)
		)
			continue;
		// Listeners are diffed by event slot, not by each spelling.
		if (isEventHandlerKey(key)) continue;
		// data-id and DATA-ID are one key. A spelling that is still present
		// is not a drop.
		const kept = sinkMatch(newProps, element, key, isSvgElement);
		if (kept) {
			// The spelling that stays owns the attribute: the old marker is handed over.
			if (kept !== key) committedKeys(element).delete(key);
			continue;
		}
		removeProp(element, key, isSvgElement);
	}
	patchEventSlots(element, newProps, oldProps, "addEventListener");

	// default* before checked, value, and selected, whatever the key order.
	for (let pass = 0; pass < 2; pass++) {
		for (const [key, next] of Object.entries(newProps)) {
			const late = key === "checked" || key === "value" || key === "selected";
			if (late !== (pass === 1)) continue;
			if (hostRuntimeEnabled && key === "use") continue;
			if (isForbiddenProp(key)) continue;
			if (key === "children" || key === "ref") continue;
			if (isBlockedMarkupProp(element, key)) {
				if (next !== undefined && next !== null && next !== false) {
					warnBlockedMarkupProp(element, key);
				}
				continue;
			}
			if (isIgnoredHandlerAttribute(key)) {
				// A string `ONCLICK` or `xlink:onclick` would become an executable
				// attribute. Functions bind once per event slot above.
				continue;
			}
			// Stryker restore all
			if (isUrlPartKey(key)) continue;
			// Stryker disable all
			const prev = oldProps[key];
			if (isBlockedUrlValue(element, key, next, newProps)) {
				warnBlockedUrl(element, key);
				// The drop loop already cleared what an earlier render committed.
				continue;
			}
			// An own setter may have side effects its getter does not show, so a
			// present value is assigned exactly once per render, here, before any
			// equality skip and without the default*/live reapply below.
			if (!isSvgElement && hasOwnCustomSetter(element as HTMLElement, key)) {
				if (next == null) removeProp(element, key, false);
				else {
					// A fallback attribute written before the upgrade is replaced.
					const keys = committedKeys(element);
					if (keys.get(key)) dropFallback(element, key);
					keys.set(key, false);
					setContained(element, key, next);
				}
				continue;
			}
			// Any other commit is a fallback: the renderer owns that attribute.
			if (next != null) committedKeys(element).set(key, true);

			if (key.toLowerCase() === "style") {
				patchStyle(element as HTMLElement, prev, next);
				continue;
			}

			// Passed checked, value, and selected are written every render,
			// including explicit false. Null leaves the live property alone.
			if (!isSvgElement && isLiveField(element, key)) {
				// Select value is queued after its options. Every other live
				// field waits for the same flush, so a later default* sibling
				// cannot clear it.
				// A file input's value is the user's selection: never written.
				if (
					key === "value" &&
					(element.localName === "select" ||
						(element as HTMLInputElement).type === "file")
				)
					continue;
				if (next != null) {
					queueControlled(element as HTMLElement, key, next);
				}
				continue;
			}

			if (key === "class" || key === "className") {
				const nextClass = next !== false && next != null ? String(next) : "";
				if (!nextClass) act(element, "removeAttribute", "class");
				else if (
					act<string | null>(element, "getAttribute", "class") !== nextClass
				)
					act(element, "setAttribute", "class", nextClass);
				continue;
			}

			// An unchanged spelling is still applied when its twin was dropped.
			// Two spellings at once stay unspecified; one remaining spelling is not.
			// Unchanged also means committed: a value the previous props blocked
			// (for example a SMIL `to` beside an href target) was never written.
			if (
				next === prev &&
				!isBlockedUrlValue(element, key, prev, oldProps) &&
				!droppedSiblingSpelling(oldProps, newProps, element, key, isSvgElement)
			) {
				continue;
			}

			// Explicit false is a set for these defaults, not a drop. The live
			// checked or selected value is written by its own pass afterwards.
			if (
				next === false &&
				!isSvgElement &&
				(key === "defaultChecked" || key === "defaultSelected")
			) {
				applyProperty(element as HTMLElement, key, false);
				continue;
			}

			if (next === false || next === null || next === undefined) {
				// A present false is a value. undefined is only for a later drop.
				if (
					next === false &&
					!isSvgElement &&
					/^(translate|spellcheck|draggable)$/i.test(key)
				) {
					// These attributes have false tokens; absence has different semantics.
					act(
						element,
						"setAttribute",
						key,
						/^translate$/i.test(key) ? "no" : "false",
					);
				} else {
					removeProp(element, key, isSvgElement);
				}
				continue;
			}

			if (!isSvgElement && key in element && key !== "list") {
				applyProperty(element as HTMLElement, key, next);
				continue;
			}

			const attrName = propAttributeName(element, key, isSvgElement);
			act(element, "setAttribute", attrName, String(next));
		}
	}
	if (linkReflectsStylesheet(element)) {
		act(element, "removeAttribute", "rel");
		act(element, "removeAttribute", "href");
	}
}

// Stryker disable all
function patchStyle(element: HTMLElement, prev: unknown, next: unknown): void {
	// An override of style is a user getter: contained, and a non-style value
	// (undefined, or the throw fallback) leaves the rest of the render alone.
	const style = getContained(element, "style") as CSSStyleDeclaration;
	if (!style?.setProperty) return;

	if (next === null || next === undefined || next === false) {
		setContained(style, "cssText", "");
		return;
	}

	const trusted = readTrustedStyle(next);
	if (trusted !== undefined) {
		if (getContained(style, "cssText") !== trusted) {
			setContained(style, "cssText", trusted);
		}
		return;
	}

	if (typeof next === "object") {
		const prevIsMap =
			!!prev &&
			typeof prev === "object" &&
			readTrustedStyle(prev) === undefined;
		if (prevIsMap) {
			for (const key of Object.keys(prev as Record<string, unknown>)) {
				if (!(key in next)) act(style, "removeProperty", toKebabCase(key));
			}
		} else {
			setContained(style, "cssText", "");
		}
		for (const [key, value] of Object.entries(next)) {
			const cssProperty = toKebabCase(key);
			const safe = cssValueForStyle(value);
			if (safe === false) {
				if (__IGNITE_DEV_WARNINGS__) {
					warnIgnoredProp(
						element,
						`style:${key}`,
						`[ignite-jsx] \`${key}\` was not applied because its URL scheme is not allowed.`,
					);
				}
				act(style, "removeProperty", cssProperty);
				continue;
			}
			if (safe === undefined) continue;
			if (act<string>(style, "getPropertyValue", cssProperty) !== safe) {
				act(style, "setProperty", cssProperty, safe);
			}
		}
		return;
	}

	const raw = String(next);
	const nextString = cssTextWithoutUrls(raw);
	if (__IGNITE_DEV_WARNINGS__ && nextString !== raw) {
		warnIgnoredProp(
			element,
			"style:url",
			"[ignite-jsx] `style` was not applied because its URL scheme is not allowed.",
		);
	}
	if (getContained(style, "cssText") !== nextString) {
		setContained(style, "cssText", nextString);
	}
}

function eventSlots(props: IgniteJsxProps): Record<string, EventListener> {
	const slots: Record<string, EventListener> = {};
	for (const key of Object.keys(props)) {
		const value = props[key];
		if (typeof value !== "function" || !isEventHandlerKey(key)) continue;
		slots[normalizeEventName(key.slice(2))] = value as EventListener;
	}
	return slots;
}

// Removals are drops and run with them; additions are sets and run after.
// Each call walks the slots of `from` that `to` does not share.
function patchEventSlots(
	element: Element,
	from: IgniteJsxProps,
	to: IgniteJsxProps,
	method: "addEventListener" | "removeEventListener",
) {
	const a = eventSlots(from);
	const b = eventSlots(to);
	for (const name in a)
		if (a[name] !== b[name]) act(element, method, name, a[name]);
}

// Own means a writable field or setter on the instance or a prototype before
// HTMLElement. Inherited IDL, including a media element's volume, is not own.
// The walk stops at HTMLElement so an override of an inherited name such as
// id still counts. There is no cached built-in element.
function hasOwnCustomSetter(element: HTMLElement, key: string): boolean {
	if (!element.localName.includes("-")) return false;
	for (
		let current: object | null = element;
		current && current !== HTMLElement.prototype;
		current = Object.getPrototypeOf(current)
	) {
		const desc = Object.getOwnPropertyDescriptor(current, key);
		if (!desc) continue;
		return Boolean(desc.set || desc.writable);
	}
	return false;
}

function propAttributeName(
	element: Element,
	key: string,
	isSvg: boolean,
): string {
	const lower = key.toLowerCase();
	if (lower === "xlinkhref") return "xlink:href";
	if (lower === "class" || lower === "classname") return "class";
	if (lower === "htmlfor") return "for";
	if (lower === "acceptcharset") return "accept-charset";
	if (lower === "httpequiv" || metaRefreshKey(element, key)) {
		return "http-equiv";
	}
	// ariaLabel reflects to aria-label, not arialabel. aria-label stays.
	if (
		lower.startsWith("aria") &&
		key.charCodeAt(4) >= 65 &&
		key.charCodeAt(4) <= 90
	) {
		return `aria-${lower.slice(4)}`;
	}
	return isSvg ? normalizeSvgAttributeName(key) : lower;
}

// value, checked, and selected use the IDL property only in that spelling.
// CHECKED and VALUE are attributes, so they are not the same sink.
function isLiveField(element: Element, key: string): boolean {
	const tag = element.localName;
	if (key === "checked") return tag === "input";
	if (key === "selected") return tag === "option";
	return (
		key === "value" &&
		(tag === "input" || tag === "textarea" || tag === "select")
	);
}

// These properties have no attribute counterpart. The set path writes them
// only in this exact spelling; SCROLLTOP is an unrelated attribute.
// The value is the default a drop restores.
const UNREFLECTED_PROPERTIES = new Map<string, number | boolean>([
	["scrollTop", 0],
	["scrollLeft", 0],
	["indeterminate", false],
	["muted", false],
]);

function isUnreflectedProperty(
	element: Element,
	key: string,
	isSvg: boolean,
): boolean {
	return !isSvg && UNREFLECTED_PROPERTIES.has(key) && key in element;
}

// Events and HTML attributes compare case-insensitively. Exact-name property
// sinks keep their spelling, so foo and FOO are different keys.
function sinkKey(element: Element, key: string, isSvg: boolean): string {
	if (isEventHandlerKey(key)) {
		return `*${normalizeEventName(key.slice(2))}`;
	}
	if (
		hasOwnCustomSetter(element as HTMLElement, key) ||
		isLiveField(element, key) ||
		isUnreflectedProperty(element, key, isSvg)
	) {
		return `\0${key}`;
	}
	return propAttributeName(element, key, isSvg);
}

function droppedSiblingSpelling(
	oldProps: IgniteJsxProps,
	newProps: IgniteJsxProps,
	element: Element,
	key: string,
	isSvg: boolean,
): boolean {
	const id = sinkKey(element, key, isSvg);
	for (const other of Object.keys(oldProps)) {
		if (other === key || other in newProps) continue;
		if (sinkKey(element, other, isSvg) === id) return true;
	}
	return false;
}

function sinkMatch(
	props: IgniteJsxProps,
	element: Element,
	key: string,
	isSvg: boolean,
): string | undefined {
	const id = sinkKey(element, key, isSvg);
	for (const other of Object.keys(props)) {
		// A blocked present spelling writes nothing, so it keeps nothing.
		if (
			sinkKey(element, other, isSvg) === id &&
			!isBlockedUrlValue(element, other, props[other], props)
		)
			return other;
	}
	return undefined;
}

function dropFallback(element: Element, key: string): void {
	act(element, "removeAttribute", propAttributeName(element, key, false));
}

function removeProp(element: Element, key: string, isSvg: boolean): void {
	// Removing a prop forgets what the renderer committed for it.
	const had = committedKeys(element).delete(key);
	// An own setter, whatever its name, is cleared with undefined.
	if (!isSvg && hasOwnCustomSetter(element as HTMLElement, key)) {
		// Only a value the renderer committed is cleared. The fallback attribute
		// goes first, so a reflection the setter makes survives.
		if (had) {
			dropFallback(element, key);
			setContained(element, key, undefined);
		}
		return;
	}

	// Dropped checked, value, and selected stay as they are. Catalog form
	// components own that state. A file input is included and is not cleared.
	if (!isSvg && isLiveField(element, key)) {
		if (__IGNITE_DEV_WARNINGS__) warnDroppedControl(element, key);
		return;
	}

	// An unreflected property is dropped by itself. Its lower-case attribute
	// spelling is another sink and stays.
	if (isUnreflectedProperty(element, key, isSvg)) {
		setContained(element, key, UNREFLECTED_PROPERTIES.get(key));
		return;
	}

	// Absent native defaults stay. A dropped checked, value, or selected does
	// not read them. Own custom setters, including these names, are cleared
	// above. Explicit false is applied in the set path.
	if (
		key in element &&
		/^(default(Value|Checked|Selected)|volume|playbackRate|currentTime)$/.test(
			key,
		)
	) {
		return;
	}

	if (
		!isSvg &&
		key in element &&
		key !== "list" &&
		typeof getContained(element, key) === "boolean"
	) {
		setContained(element, key, false);
	}
	act(element, "removeAttribute", propAttributeName(element, key, isSvg));
}

const composing = new WeakMap<Node, boolean>();

function watchComposition(element: HTMLElement): void {
	if (composing.has(element)) return;
	composing.set(element, false);
	const end = () => composing.set(element, false);
	// Registration is a DOM call like any other: it can be overridden.
	act(element, "addEventListener", "compositionstart", () =>
		composing.set(element, true),
	);
	for (const type of ["compositionend", "blur", "focus"]) {
		act(element, "addEventListener", type, end);
	}
}

function queueControlled(
	element: HTMLElement,
	key: string,
	value: unknown,
): void {
	commitQueue[0].push(() => assignControlled(element, key, value));
}

// A render owns its queues; nested or failed renders cannot drain its work.
// Who owns a host is stored on the host under a shared key, like the mount
// mark, so bundled copies of this module agree: the token of the newest commit
// to publish, or a detach. A render superseded before it publishes writes
// nothing; once published, a newer commit stops its controlled writes, and
// only a detach or a commit that replaced the DOM (`r`) stops its refs.
const owner = Symbol.for("ignite.o");
// Private unwinding signal: a thrown user symbol is never mistaken for it.
const abort = {};
type Token = { r?: boolean };
type Frame = Token & { h?: object; e?: Token; m?: () => boolean };
type Owned = { [owner]?: Token };
/** The owner of a root that detach() is tearing down. */
export const detaching = {};
export const setOwner = (host: object, token: object) => {
	(host as Owned)[owner] = token;
};

// Every write site in the patch asks this first. Once a detach or a newer commit
// owns the host it throws `abort`, which unwinds the whole patch at its root.
// The one write helper. Every DOM method that writes or removes goes through it,
// and ownership is checked after it too: a custom element's callbacks run user
// code inside the write, so nothing after the last write may act on a stale commit.
function act<T = void>(target: object, method: string, ...args: unknown[]): T {
	live();
	try {
		// The lookup is user code too: an accessor can supersede before the call.
		const call = (target as Record<string, (...a: unknown[]) => T>)[method];
		live();
		return call.apply(target, args);
	} finally {
		// Also when the call threw: a call that superseded and then threw is stale.
		live();
	}
}

// Keys the renderer committed a value for. true: it wrote the attribute
// fallback; false: an own setter received the value.
const committed = new WeakMap<object, Map<string, boolean>>();
function committedKeys(element: object): Map<string, boolean> {
	let keys = committed.get(element);
	if (!keys) {
		keys = new Map();
		committed.set(element, keys);
	}
	return keys;
}

// A detached root owns its commit from the moment it exists, before any setter
// runs, so a mount made inside one supersedes the rest of the construction.
function claim(root: Node): void {
	const frame = commitQueue as unknown as Frame;
	if (frame.h) return;
	setOwner(root, frame);
	frame.h = root;
	frame.e = frame;
}

function stale(): boolean {
	const { h, e, m } = commitQueue as unknown as Frame;
	// During the controlled phase there is no host any more: m is the check.
	return h ? (h as Owned)[owner] !== e : !!m && !m();
}

function live(): void {
	if (stale()) throw abort;
}

// Commits this renderer instance made. A token from another instance cannot
// invalidate this instance's ref bookkeeping, so its queue stops there.
const ownCommits = new WeakSet<object>();

function commitRender<T>(render: () => T, host?: object): T {
	const parent = commitQueue;
	const queues: typeof commitQueue = [[], []];
	commitQueue = queues;
	ownCommits.add(queues);
	const restoreHost = hostTools && useHostOwnership(hostTools);
	try {
		let result: T | undefined;
		try {
			result = render();
		} catch (error) {
			// live() unwinds a superseded render here, whole, and it publishes nothing.
			// A raw read that superseded and then threw is stale too, not a failure.
			if (error !== abort && !stale()) throw error;
		}
		// A superseded detached root is still the value of its own call.
		const frame = queues as unknown as Frame;
		result ??= (host ? undefined : frame.h) as T | undefined;
		// The write phase is over. Queued writes check ownership through mine().
		frame.h = undefined;
		const root = (host ?? result) as Owned | undefined;
		const mine = () => !root || root[owner] === (queues as unknown as Token);
		frame.m = mine;
		try {
			for (const commit of queues[0]) if (mine()) commit();
		} catch (error) {
			if (error !== abort) throw error;
		} finally {
			frame.m = undefined;
		}
		for (const commit of queues[1]) {
			const current = root?.[owner] as Token;
			if (mine() || (ownCommits.has(current) && !current.r)) commit();
		}
		return result as T;
	} finally {
		restoreHost?.();
		commitQueue = parent;
	}
}

function assignControlled(
	element: HTMLElement,
	key: string,
	value: unknown,
): void {
	// Composition keeps text until the next render after compositionend.
	if (key === "value" && composing.get(element) === true) {
		if (element.isConnected && element.matches(":focus")) return;
		// Both reads are user code: a newer render they made owns this state.
		live();
		composing.set(element, false);
	}
	// A select setter clears extra selections even when its getter matches.
	if (
		key === "value" &&
		element.localName !== "select" &&
		getContained(element, key) === value
	)
		return;

	setContained(element, key, value);
}

// Every property read goes through here. A throwing getter reads as a value
// nothing equals, so the render still tries the write and carries on.
function getContained(element: object, key: string): unknown {
	try {
		return act(Reflect, "get", element, key);
	} catch {
		// A throwing getter reads as a value nothing equals. The abort act()
		// throws after a superseding getter returns is not a getter error.
		live();
		return {};
	}
}

// Every property write goes through here. A throwing setter stops at its own
// write and never aborts the render. File values are not cleared.
function setContained(element: object, key: string, value: unknown): void {
	// __proto__, constructor, and prototype are never assigned. Reflect.set
	// would invoke the __proto__ setter and swap the element's prototype.
	if (isForbiddenProp(key)) return;
	try {
		act(Reflect, "set", element, key, value);
	} catch {
		live();
	}
}

function applyProperty(
	element: HTMLElement,
	key: string,
	value: unknown,
): void {
	// An own setter may have side effects its getter does not show, so it is
	// always assigned. Native properties skip a value they already hold.
	if (
		hasOwnCustomSetter(element, key) ||
		getContained(element, key) !== value
	) {
		setContained(element, key, value);
	}
}

function flushSelectValue(element: Element, props: IgniteJsxProps): void {
	if (element.localName !== "select" || props.value == null) return;
	queueControlled(element as HTMLElement, "value", props.value);
}

function replaceAll(parent: ParentNode, children: NormalizedNode[]): void {
	while (parent.firstChild) {
		detachChild(parent, parent.firstChild);
	}
	for (const child of children) {
		act(parent, "appendChild", createDomFromNormalized(child));
		if (hostRuntimeEnabled) {
			const placed = parent.lastChild;
			if (placed) commitFresh(placed, child);
		}
	}
}

function normalizeEventName(rawName: string): string {
	const trimmed = rawName.replace(/^[^a-zA-Z0-9]+/, "");
	const withHyphens = trimmed
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.replace(/_/g, "-");
	return withHyphens.toLowerCase();
}

function normalizeSvgAttributeName(name: string): string {
	if (name.includes("-") || name.includes(":")) {
		return name;
	}
	if (CAMEL_CASE_SVG_ATTRS.has(name)) {
		return name;
	}
	if (name.startsWith("data") || name.startsWith("aria")) {
		return normalizeEventName(name);
	}
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/_+/g, "-")
		.toLowerCase();
}

function toKebabCase(value: string): string {
	return value.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export type { NormalizedNode };
