import {
	executableUriPattern,
	isExecutableUri,
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
	const normalized = normalizeChild(node, namespace);
	if (normalized.length === 1) {
		return createDomFromNormalized(normalized[0]);
	}
	const fragment = document.createDocumentFragment();
	for (const child of normalized) {
		fragment.appendChild(createDomFromNormalized(child));
	}
	return fragment;
}

export function mountIgniteJsx(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
	options: RenderOptions = {},
): NormalizedNode[] {
	const mount = () => {
		const normalized = normalizeRoot(view);
		replaceAll(host, normalized);
		return normalized;
	};
	if (hostRuntimeEnabled) return withIgniteHostRuntime(options.hosts, mount);
	return mount();
}

type RenderOptions = {
	mode?: "diff" | "replace";
	onFallbackReplace?: (reason: string) => void;
	hosts?: IgniteHostRuntime;
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
	const next = normalizeRoot(view);

	if (options.mode === "replace") {
		replaceAll(host, next);
		return next;
	}

	if (!previous || host.childNodes.length === 0) {
		replaceAll(host, next);
		return next;
	}

	const patched = patchChildren(
		host,
		previous,
		next,
		options.onFallbackReplace,
	);
	if (!patched) {
		replaceAll(host, next);
	}
	return next;
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

function warnDeprecatedContentProp(element: Element, key: string): void {
	warnIgnoredProp(
		element,
		key,
		`[ignite-jsx] \`${key}\` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.`,
	);
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

function isBlockedMarkupProp(key: string): boolean {
	const normalized = key.toLowerCase();
	return (
		normalized === "innerhtml" ||
		normalized === "outerhtml" ||
		normalized === "srcdoc"
	);
}

const dataDocumentTagPattern = /^(?:script|iframe|frame|object|embed)$/;

function isEventHandlerKey(key: string): boolean {
	const name = key.toLowerCase();
	return name.length > 2 && name.startsWith("on");
}

function isIgnoredHandlerAttribute(key: string): boolean {
	const name = key.toLowerCase();
	return isEventHandlerKey(name) || name.startsWith("xlink:on");
}

function isBlockedUrlValue(
	element: Element,
	key: string,
	value: unknown,
): boolean {
	if (value == null || value === false) return false;
	const name = key.toLowerCase();
	const tag = element.localName;
	// <base href> retargets relative URLs. srcset lists and poster are
	// documented in the changeset; they are not checked here.
	if (tag === "base" && name === "href") return true;
	if (
		!uriBearingKeyPattern.test(name) &&
		!(name === "data" && tag === "object")
	) {
		return false;
	}
	if (typeof value !== "string") return true;
	uriSpacePattern.lastIndex = 0;
	const normalized = value.replace(uriSpacePattern, "").toLowerCase();
	return (
		executableUriPattern.test(normalized) ||
		(normalized.startsWith("data:") && dataDocumentTagPattern.test(tag))
	);
}

function animationTargetsHref(
	element: Element,
	props: IgniteJsxProps,
): boolean {
	const tag = element.localName;
	if (tag !== "animate" && tag !== "set") return false;
	let target: string | null = null;
	for (const [key, value] of Object.entries(props)) {
		if (key.toLowerCase() !== "attributename") continue;
		target = typeof value === "string" ? value : "";
	}
	if (target == null) {
		target = element.getAttribute("attributeName") ?? "";
	}
	const name = target.trim().toLowerCase();
	return name === "href" || name === "xlink:href";
}

function hasExecutableAnimationValue(key: string, value: unknown): boolean {
	if (typeof value !== "string") return false;
	const name = key.toLowerCase();
	if (name === "to") return isExecutableUri(value);
	if (name !== "values") return false;
	for (const token of value.split(";")) {
		if (token && isExecutableUri(token)) return true;
	}
	return false;
}

function isBlockedRefresh(
	element: Element,
	key: string,
	value: unknown,
): boolean {
	if (element.localName !== "meta" || typeof value !== "string") return false;
	return (
		key.toLowerCase().replace(/-/g, "") === "httpequiv" &&
		value.trim().toLowerCase() === "refresh"
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

function assignRef(element: Element, ref: unknown): void {
	const mount = ensureMount(element);
	if (mount.unmounted) return;
	const next = typeof ref === "function" ? (ref as RefCallback) : null;
	if (mount.ref === next && !mount.released) return;
	if (mount.ref && !mount.released) {
		const previous = mount.ref;
		const cleanup = mount.cleanup;
		mount.ref = null;
		mount.cleanup = null;
		releaseRefBinding(element, previous, cleanup);
	}
	mount.ref = next;
	mount.cleanup = null;
	mount.released = false;
	if (!next) return;
	try {
		const result = next(element);
		if (typeof result === "function") {
			mount.cleanup = result;
			return;
		}
		observeRejection(element, result);
	} catch (error) {
		mount.cleanup = null;
		reportRendererError(element, error);
	}
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
			const ref = mount.ref;
			mount.released = false;
			mount.cleanup = null;
			try {
				const result = ref(node);
				if (typeof result === "function") mount.cleanup = result;
				else observeRejection(node, result);
			} catch (error) {
				mount.cleanup = null;
				reportRendererError(node, error);
			}
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
	for (const child of Array.from(root.childNodes)) {
		reacquireNodeRefs(child);
	}
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

// textContent replaces the element's subtree as a DOM property. Nodes it creates
// are not tracked by the normalized children model, so the child diff must defer
// to it. Hosts claim the same rule through `claimSubtree`. innerHTML is not applied.
function ownsSubtreeViaProps(props: IgniteJsxProps): boolean {
	const value = (props as Record<string, unknown>).textContent;
	return value !== undefined && value !== null && value !== false;
}

function subtreeIsOwned(element: Element, props: IgniteJsxProps): boolean {
	return subtreeOwners.has(element) || ownsSubtreeViaProps(props);
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
	const droppingHost =
		hostRuntimeEnabled &&
		ownsSubtreeViaProps(newNode.props) &&
		(typeof nextUse !== "string" || nextUse.length === 0);
	if (droppingHost) {
		syncHostElement(elementNode, nextUse);
	}

	patchProps(elementNode, oldNode.props, newNode.props);
	const previouslyOwned = hostRuntimeEnabled
		? subtreeIsOwned(elementNode, oldNode.props)
		: ownsSubtreeViaProps(oldNode.props);
	if (hostRuntimeEnabled && !droppingHost) {
		syncHostElement(elementNode, nextUse);
	}
	// A subtree owner (textContent or a host claim) is opaque. patchProps already
	// applied the owning prop — skip child diffing so the positional patch does
	// not desync against untracked DOM nodes (issue #57).
	if (subtreeIsOwned(elementNode, newNode.props)) {
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
	const blockHrefAnimation = animationTargetsHref(element, newProps);

	for (const key of Object.keys(oldProps)) {
		if (hostRuntimeEnabled && key === "use") continue;
		if (key === "children" || key === "ref" || isBlockedMarkupProp(key))
			continue;
		if (!(key in newProps)) {
			removeProp(element, key, oldProps[key], isSvgElement);
		}
	}

	for (const [key, next] of Object.entries(newProps)) {
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
			// attribute. Functions still bind through addEventListener.
			if (
				isEventHandlerKey(key) &&
				(typeof next === "function" || typeof oldProps[key] === "function")
			) {
				patchEventListener(element, key, oldProps[key], next);
			}
			continue;
		}
		if (
			isBlockedUrlValue(element, key, next) ||
			isBlockedRefresh(element, key, next) ||
			(blockHrefAnimation && hasExecutableAnimationValue(key, next))
		) {
			warnBlockedUrl(element, key);
			// removeProp clears a non-reflected property and the attribute.
			// Attribute removal alone leaves a stale custom-element URL.
			removeProp(element, key, oldProps[key], isSvgElement);
			continue;
		}
		const prev = oldProps[key];
		if (
			key === "textContent" &&
			next !== undefined &&
			next !== null &&
			next !== false
		) {
			warnDeprecatedContentProp(element, key);
			if (next !== prev) {
				for (const child of Array.from(element.childNodes)) {
					unmountIgniteSubtree(child);
				}
			}
		}

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

		if (next === prev) {
			continue;
		}

		if (next === false || next === null || next === undefined) {
			removeProp(element, key, prev, isSvgElement);
			continue;
		}

		if (!isSvgElement && key in element && key !== "list") {
			applyProperty(element as HTMLElement, key, next);
			continue;
		}

		const attrName = isSvgElement ? normalizeSvgAttributeName(key) : key;
		const nextString = String(next);
		if (element.getAttribute(attrName) !== nextString) {
			element.setAttribute(attrName, nextString);
		}
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

function patchEventListener(
	element: Element,
	key: string,
	prev: unknown,
	next: unknown,
) {
	const eventName = normalizeEventName(key.slice(2));
	const prevHandler =
		typeof prev === "function" ? (prev as EventListener) : null;
	const nextHandler =
		typeof next === "function" ? (next as EventListener) : null;

	if (prevHandler && prevHandler !== nextHandler) {
		element.removeEventListener(eventName, prevHandler);
	}

	if (nextHandler && nextHandler !== prevHandler) {
		element.addEventListener(eventName, nextHandler);
	}
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
		(element as HTMLElement).style.cssText = "";
		return;
	}

	if (isEventHandlerKey(key) && typeof prev === "function") {
		const eventName = normalizeEventName(key.slice(2));
		element.removeEventListener(eventName, prev as EventListener);
		return;
	}

	const attrName = isSvg ? normalizeSvgAttributeName(key) : key;
	if (element.hasAttribute(attrName)) {
		element.removeAttribute(attrName);
	}

	// Reflected URL setters turn undefined into the relative URL "undefined".
	// Attribute removal clears those. A non-reflected custom property stays
	// equal to the previous value, and only that property is cleared.
	if (
		!isSvg &&
		key in element &&
		key !== "list" &&
		(element as HTMLElement)[key as keyof HTMLElement] === prev
	) {
		Reflect.set(element as HTMLElement, key, undefined);
	}
}

function applyProperty(
	element: HTMLElement,
	key: string,
	value: unknown,
): void {
	if (key === "value" || key === "checked") {
		const current = Reflect.get(element, key);
		if (current !== value && !(isComposingInput(element) && key === "value")) {
			Reflect.set(element, key, value);
		}
		return;
	}

	const current = Reflect.get(element, key);
	if (current !== value) {
		Reflect.set(element, key, value);
	}
}

function isComposingInput(element: HTMLElement): boolean {
	return (
		"isComposing" in element &&
		Boolean((element as HTMLElement & { isComposing?: boolean }).isComposing)
	);
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
