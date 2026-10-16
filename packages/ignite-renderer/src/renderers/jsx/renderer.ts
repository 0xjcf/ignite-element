import {
	executableUriPattern,
	uriBearingKeyPattern,
	uriSpacePattern,
} from "./executableUri";
import {
	configureHostOwnership,
	type IgniteHostRuntime,
	syncHostElement,
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

declare const __IGNITE_DEV_WARNINGS__: boolean;
declare const __IGNITE_HOST_RUNTIME__: boolean | undefined;

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
	| { kind: "text"; value: string }
	| { kind: "comment"; comment?: string };

export function createDomNode(
	node: IgniteJsxChild,
	namespace?: string,
): Node | DocumentFragment {
	return commitRender(() => {
		const normalized = normalizeChild(node, namespace);
		if (normalized.length === 1) {
			const result = createDomFromNormalized(normalized[0]);
			return result;
		}
		const fragment = document.createDocumentFragment();
		for (const child of normalized) {
			fragment.appendChild(createDomFromNormalized(child));
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
	return commitRender(() => {
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
		options.onTreePublished?.(next);
		return next;
	});
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
		const result = node.type(node.props);
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

function warnInvalidKeys(children: NormalizedNode[]): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	const shape = classifyKeys(children);
	if (shape === "duplicate") {
		const key = duplicateKey(children);
		console.warn(
			`[ignite-jsx] Duplicate key "${String(key)}" among siblings. Keys must be unique.`,
		);
		return;
	}
	if (shape === "mixed") {
		console.warn(
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
		console.warn(
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
	console.warn(message);
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
		if (key === "children" || key === "ref") continue;
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

function isBlockedMarkupProp(key: string): boolean {
	const normalized = key.toLowerCase();
	return (
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

const dataDocumentTagPattern = /^(?:script|iframe|frame|object|embed|applet)$/;

function isEventHandlerKey(key: string): boolean {
	const name = key.toLowerCase();
	return name.length > 2 && name.startsWith("on");
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
		if (
			!kept ||
			newProps[kept] !== oldProps[key] ||
			isBlockedUrlValue(element, kept, newProps[kept], newProps)
		) {
			removeProp(element, key, oldProps[key], true);
		}
	}
}

function isBlockedUrlValue(
	element: Element,
	key: string,
	value: unknown,
	props?: IgniteJsxProps,
): boolean {
	if (value == null || value === false) return false;
	const name = key.toLowerCase();
	const tag = element.localName.toLowerCase();
	// <base href> retargets relative URLs. srcset lists and poster are
	// documented in the changeset; they are not checked here.
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
	const metaEquiv = metaRefreshKey(element, key);
	const guarded =
		name === "attributename" ||
		name === "codebase" ||
		metaEquiv ||
		uriBearingKeyPattern.test(name) ||
		(name === "data" && tag === "object");
	if (!guarded) return false;
	// Reject a non-string before any check. The string that is checked is
	// the same string that is written.
	if (typeof value !== "string") return true;
	if (metaEquiv) {
		return strippedUri(value) === "refresh";
	}
	if (name === "attributename") return false;
	const normalized = strippedUri(value);
	return (
		executableUriPattern.test(normalized) ||
		(normalized.startsWith("data:") && dataDocumentTagPattern.test(tag))
	);
}

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

if (hostRuntimeEnabled) {
	configureHostOwnership({
		claimSubtree,
		releaseSubtree,
		onUnmount: onIgniteUnmount,
		unmountSubtree: unmountIgniteSubtree,
	});
}

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

function reportRendererError(node: Node, error: unknown): void {
	const root = node.getRootNode();
	const host = root instanceof ShadowRoot ? root.host : null;
	const candidate = host as {
		handleError?: (error: unknown) => void;
		onError?: (error: unknown) => void;
	} | null;
	const handler = candidate?.handleError ?? candidate?.onError;
	if (typeof handler === "function") {
		try {
			handler.call(host, error);
			return;
		} catch (handlerError) {
			console.error("[ignite-jsx] Error handler failed.", handlerError);
		}
	}
	console.error("[ignite-jsx] Callback failed.", error);
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
			const result = next(element);
			if (typeof result === "function") {
				if (!mount.unmounted && !mount.released && mount.binding === acquire)
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
	parent.removeChild(child);
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
	if (!isAppendOnlyCompatible(oldChildren, newChildren)) {
		// Instead of full replacement, try positional patching.
		// This preserves existing elements when siblings change kind.
		const maxLen = Math.max(oldChildren.length, newChildren.length);
		for (let i = 0; i < maxLen; i++) {
			const domChild = parent.childNodes[i];
			if (i < oldChildren.length && i < newChildren.length && domChild) {
				const patched = patchNode(
					domChild,
					oldChildren[i],
					newChildren[i],
					onFallbackReplace,
				);
				if (patched !== domChild) {
					parent.replaceChild(patched, domChild);
					if (hostRuntimeEnabled) {
						const spec = newChildren[i];
						if (spec) commitFresh(patched, spec);
					}
				}
			} else if (i >= oldChildren.length) {
				parent.appendChild(createDomFromNormalized(newChildren[i]));
				if (hostRuntimeEnabled) {
					const created = newChildren[i];
					const placed = parent.lastChild;
					if (created && placed) commitFresh(placed, created);
				}
			} else if (i >= newChildren.length && domChild) {
				detachChild(parent, domChild);
			}
		}
		// Remove any extra trailing DOM nodes
		while (parent.childNodes.length > newChildren.length && parent.lastChild) {
			detachChild(parent, parent.lastChild);
		}
		return true;
	}

	let childIndex = 0;
	for (; childIndex < oldChildren.length; childIndex++) {
		const domChild = parent.childNodes[childIndex];
		if (!domChild) {
			return false;
		}
		const patched = patchNode(
			domChild,
			oldChildren[childIndex],
			newChildren[childIndex],
			onFallbackReplace,
		);
		if (patched !== domChild) {
			parent.replaceChild(patched, domChild);
			if (hostRuntimeEnabled) {
				const spec = newChildren[childIndex];
				if (spec) commitFresh(patched, spec);
			}
		}
	}

	for (; childIndex < newChildren.length; childIndex++) {
		parent.appendChild(createDomFromNormalized(newChildren[childIndex]));
		if (hostRuntimeEnabled) {
			const created = newChildren[childIndex];
			const placed = parent.lastChild;
			if (created && placed) commitFresh(placed, created);
		}
	}

	// If the parent has extra nodes beyond managed children, leave them untouched.
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
					match.dom.parentNode.removeChild(match.dom);
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
			if (patched !== dom && dom.parentNode) dom.parentNode.removeChild(dom);
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
			parent.insertBefore(node, cursor);
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
		focused.focus();
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
			domNode.textContent = newNode.value;
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
			elementNode.appendChild(createDomFromNormalized(child));
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
				? document.createElementNS(node.namespace, node.tag)
				: document.createElement(node.tag);
			patchProps(element, {}, node.props);
			for (const child of node.children) {
				element.appendChild(createDomFromNormalized(child));
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
	patchEventSlots(element, oldProps, newProps);
	if (__IGNITE_DEV_WARNINGS__) {
		warnDuplicateProps(element, newProps, isSvgElement);
	}

	settleSmil(element, oldProps, newProps);

	// default* before checked, value, and selected, whatever the key order.
	for (let pass = 0; pass < 2; pass++) {
		for (const [key, next] of Object.entries(newProps)) {
			const late = key === "checked" || key === "value" || key === "selected";
			if (late !== (pass === 1)) continue;
			if (hostRuntimeEnabled && key === "use") continue;
			if (key === "children" || key === "ref") continue;
			if (isBlockedMarkupProp(key)) {
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
			if (isBlockedUrlValue(element, key, next, newProps)) {
				warnBlockedUrl(element, key);
				// removeProp clears a non-reflected property and the attribute.
				// Attribute removal alone leaves a stale custom-element URL.
				removeProp(element, key, oldProps[key], isSvgElement);
				continue;
			}
			const prev = oldProps[key];
			if (key === "class" || key === "className") {
				const nextClass = next !== false && next != null ? String(next) : "";
				if (element.getAttribute("class") !== nextClass) {
					if (nextClass) {
						element.setAttribute("class", nextClass);
					} else {
						element.removeAttribute("class");
					}
				}
				continue;
			}

			if (key === "style") {
				patchStyle(element as HTMLElement, prev, next);
				continue;
			}

			// Passed checked, value, and selected are written every render,
			// including explicit false. Null leaves the live property alone.
			if (!isSvgElement && isLiveField(element, key)) {
				// Select value is queued after its options. Every other live
				// field waits for the same flush, so a later default* sibling
				// cannot clear it.
				if (key === "value" && element.localName === "select") continue;
				if (next != null) {
					queueControlled(element as HTMLElement, key, next);
				}
				continue;
			}

			// An unchanged spelling is still applied when its twin was dropped.
			// Two spellings at once stay unspecified; one remaining spelling is not.
			if (
				next === prev &&
				!droppedSiblingSpelling(oldProps, newProps, element, key, isSvgElement)
			) {
				continue;
			}

			// Explicit false is a set for these defaults, not a drop. Applying it
			// can clear a still-controlled checked or selected value. Reapply
			// custom fields here; native live fields also have a final flush.
			if (
				next === false &&
				!isSvgElement &&
				(key === "defaultChecked" || key === "defaultSelected")
			) {
				const host = element as HTMLElement;
				applyProperty(host, key, false);
				const live = key === "defaultChecked" ? "checked" : "selected";
				if (typeof newProps[live] === "boolean") {
					applyProperty(host, live, newProps[live]);
				}
				continue;
			}

			if (next === false || next === null || next === undefined) {
				// A present false is a value. undefined is only for a later drop.
				if (
					next === false &&
					!isSvgElement &&
					hasOwnCustomSetter(element as HTMLElement, key)
				) {
					applyProperty(element as HTMLElement, key, false);
				} else if (
					next === false &&
					!isSvgElement &&
					/^(translate|spellcheck|draggable)$/i.test(key)
				) {
					// These attributes have false tokens; absence has different semantics.
					element.setAttribute(key, /^translate$/i.test(key) ? "no" : "false");
				} else {
					removeProp(element, key, prev, isSvgElement);
				}
				continue;
			}

			if (!isSvgElement && key in element && key !== "list") {
				applyProperty(element as HTMLElement, key, next);
				continue;
			}

			const attrName = propAttributeName(element, key, isSvgElement);
			const nextString = String(next);
			if (element.getAttribute(attrName) !== nextString) {
				element.setAttribute(attrName, nextString);
			}
		}
	}

	for (const key of Object.keys(oldProps)) {
		if (hostRuntimeEnabled && key === "use") continue;
		if (key === "children" || key === "ref" || isBlockedMarkupProp(key))
			continue;
		// Listeners are diffed by event slot, not by each spelling.
		if (isEventHandlerKey(key)) continue;
		// data-id and DATA-ID are one key. A spelling that is still present
		// is not a drop.
		const matched = sinkMatch(newProps, element, key, isSvgElement);
		if (matched) continue;
		removeProp(element, key, oldProps[key], isSvgElement);
	}
}

function patchStyle(element: HTMLElement, prev: unknown, next: unknown): void {
	const style = element.style;

	if (prev && typeof prev === "object" && next && typeof next === "object") {
		const prevObj = prev as Record<string, unknown>;
		const nextObj = next as Record<string, unknown>;

		for (const key of Object.keys(prevObj)) {
			if (!(key in nextObj)) {
				style.removeProperty(toKebabCase(key));
			}
		}

		for (const [key, value] of Object.entries(nextObj)) {
			if (value != null) {
				const cssProperty = toKebabCase(key);
				const nextValue = String(value);
				if (style.getPropertyValue(cssProperty) !== nextValue) {
					style.setProperty(cssProperty, nextValue);
				}
			}
		}
		return;
	}

	if (next && typeof next === "object") {
		style.cssText = "";
		for (const [key, value] of Object.entries(
			next as Record<string, unknown>,
		)) {
			if (value != null) {
				style.setProperty(toKebabCase(key), String(value));
			}
		}
		return;
	}

	if (next === null || next === undefined || next === false) {
		style.cssText = "";
		return;
	}

	const nextString = String(next);
	if (style.cssText !== nextString) {
		style.cssText = nextString;
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

function patchEventSlots(
	element: Element,
	oldProps: IgniteJsxProps,
	newProps: IgniteJsxProps,
) {
	const prev = eventSlots(oldProps);
	const next = eventSlots(newProps);
	for (const name in prev) {
		if (prev[name] !== next[name]) {
			element.removeEventListener(name, prev[name]);
		}
	}
	for (const name in next) {
		if (next[name] !== prev[name]) {
			element.addEventListener(name, next[name]);
		}
	}
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
		if (sinkKey(element, other, isSvg) === id) return other;
	}
	return undefined;
}

function removeProp(
	element: Element,
	key: string,
	prev: unknown,
	isSvg: boolean,
): void {
	if (key === "class" || key === "className") {
		element.removeAttribute("class");
		return;
	}

	if (key === "style") {
		element.removeAttribute("style");
		return;
	}

	if (isEventHandlerKey(key) && typeof prev === "function") {
		const eventName = normalizeEventName(key.slice(2));
		element.removeEventListener(eventName, prev as EventListener);
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
	if (
		isUnreflectedProperty(element, key, isSvg) &&
		!hasOwnCustomSetter(element as HTMLElement, key)
	) {
		const fallback = UNREFLECTED_PROPERTIES.get(key);
		if (Reflect.get(element, key) !== fallback) {
			setContained(element, key, fallback);
		}
		return;
	}

	// Absent native defaults stay. A dropped checked, value, or selected does
	// not read them. Own custom setters, including these names, are cleared
	// below. Explicit false is applied in the set path.
	if (
		(key === "defaultValue" ||
			key === "defaultChecked" ||
			key === "defaultSelected") &&
		!hasOwnCustomSetter(element as HTMLElement, key)
	) {
		return;
	}

	const attrName = propAttributeName(element, key, isSvg);
	const hadAttribute = element.hasAttribute(attrName);
	if (!isSvg && key in element && key !== "list") {
		const el = element as HTMLElement;
		if (hasOwnCustomSetter(el, key)) {
			setContained(el, key, undefined);
			return;
		}
		const current = el[key as keyof HTMLElement];
		if (typeof current === "boolean") {
			if (current) setContained(el, key, false);
			element.removeAttribute(attrName);
			return;
		}
	}

	if (hadAttribute) element.removeAttribute(attrName);
}

const composing = new WeakMap<Node, boolean>();

function watchComposition(element: HTMLElement): void {
	if (composing.has(element)) return;
	composing.set(element, false);
	element.addEventListener("compositionstart", () => {
		composing.set(element, true);
	});
	const end = () => composing.set(element, false);
	element.addEventListener("compositionend", end);
	element.addEventListener("blur", end);
	element.addEventListener("focus", end);
}

function queueControlled(
	element: HTMLElement,
	key: string,
	value: unknown,
): void {
	commitQueue[0].push(() => assignControlled(element, key, value));
}

// A render owns its queues; nested or failed renders cannot drain its work.
function commitRender<T>(render: () => T): T {
	const parent = commitQueue;
	const queues: typeof commitQueue = [[], []];
	commitQueue = queues;
	try {
		const result = render();
		for (const phase of queues) for (const commit of phase) commit();
		return result;
	} finally {
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
		composing.set(element, false);
	}
	// A select setter clears extra selections even when its getter matches.
	if (
		key === "value" &&
		element.localName !== "select" &&
		Reflect.get(element, key) === value
	)
		return;

	setContained(element, key, value);
}

// Every property write goes through here. A throwing setter stops at its own
// write and never aborts the render. File values are not cleared.
function setContained(element: Element, key: string, value: unknown): void {
	try {
		Reflect.set(element, key, value);
	} catch {
		// A throwing setter stops here.
	}
}

function applyProperty(
	element: HTMLElement,
	key: string,
	value: unknown,
): void {
	const current = Reflect.get(element, key);
	if (current !== value) setContained(element, key, value);
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
		parent.appendChild(createDomFromNormalized(child));
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
