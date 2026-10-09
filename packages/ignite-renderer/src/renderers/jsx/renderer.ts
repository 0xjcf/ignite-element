import { isNoDiffDenylistedTag } from "./noDiffDenylist";
import {
	Fragment,
	type IgniteJsxChild,
	type IgniteJsxProps,
	isIgniteJsxElement,
	normalizeChildren,
} from "./types";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
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
): NormalizedNode[] {
	const normalized = normalizeRoot(view);
	replaceAll(host, normalized);
	return normalized;
}

type RenderOptions = {
	mode?: "diff" | "replace";
	onFallbackReplace?: (reason: string) => void;
};

export function renderIgniteJsx(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
	previous?: NormalizedNode[],
	options: RenderOptions = {},
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
	warnDuplicateKeys(nodes);
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
		return normalizeChildren(node.props.children).flatMap((child) =>
			normalizeChild(child, namespace),
		);
	}

	if (typeof node.type === "function") {
		const result = node.type(node.props);
		return normalizeChild(result, namespace);
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
	warnDuplicateKeys(normalizedChildren);

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

type RefCallback = (element: Element | null) => void;

interface ElementMount {
	ref: RefCallback | null;
	hooks: Array<() => void>;
	unmounted: boolean;
}

const elementMounts = new WeakMap<Node, ElementMount>();
const subtreeOwners = new WeakSet<Element>();
const deprecatedContentWarnings = new WeakMap<Element, Set<string>>();

function isDevelopment(): boolean {
	// Exact expression so the production bundler can strip the warning.
	return process.env.NODE_ENV !== "production";
}

function nodeKey(node: NormalizedNode): string | number | undefined {
	if (node.kind !== "element" || node.key == null) return undefined;
	return node.key;
}

function listHasKey(children: NormalizedNode[]): boolean {
	for (const child of children) {
		if (nodeKey(child) !== undefined) return true;
	}
	return false;
}

function warnDuplicateKeys(children: NormalizedNode[]): void {
	if (!isDevelopment()) return;
	const seen = new Set<string | number>();
	for (const child of children) {
		const key = nodeKey(child);
		if (key === undefined) continue;
		if (seen.has(key)) {
			console.warn(
				`[ignite-jsx] Duplicate key "${String(key)}" among siblings. Keys must be unique.`,
			);
			return;
		}
		seen.add(key);
	}
}

function warnDeprecatedContentProp(
	element: Element,
	key: "innerHTML" | "textContent",
): void {
	if (!isDevelopment()) return;
	let seen = deprecatedContentWarnings.get(element);
	if (!seen) {
		seen = new Set();
		deprecatedContentWarnings.set(element, seen);
	}
	if (seen.has(key)) return;
	seen.add(key);
	console.warn(
		`[ignite-jsx] \`${key}\` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.`,
	);
}

function ensureMount(node: Node): ElementMount {
	let mount = elementMounts.get(node);
	if (!mount) {
		mount = { ref: null, hooks: [], unmounted: false };
		elementMounts.set(node, mount);
	}
	return mount;
}

/** Hosts claim an element so the differ never touches its subtree. */
export function claimSubtree(element: Element): void {
	subtreeOwners.add(element);
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

/** Shared unmount path. Runs before detach, exactly once per mount. */
export function unmountIgniteSubtree(node: Node): void {
	if (
		node.nodeType === Node.ELEMENT_NODE ||
		node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
	) {
		for (const child of Array.from(node.childNodes)) {
			unmountIgniteSubtree(child);
		}
	}
	const mount = elementMounts.get(node);
	if (!mount || mount.unmounted) return;
	mount.unmounted = true;
	const hooks = mount.hooks.splice(0, mount.hooks.length);
	for (const hook of hooks) hook();
	const ref = mount.ref;
	mount.ref = null;
	elementMounts.delete(node);
	if (ref) ref(null);
}

function assignRef(element: Element, ref: unknown): void {
	const mount = ensureMount(element);
	if (mount.unmounted) return;
	const next = typeof ref === "function" ? (ref as RefCallback) : null;
	if (mount.ref === next) return;
	if (mount.ref) {
		const previous = mount.ref;
		mount.ref = null;
		previous(null);
	}
	mount.ref = next;
	if (next) next(element);
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
	if (listHasKey(oldChildren) || listHasKey(newChildren)) {
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
				}
			} else if (i >= oldChildren.length) {
				parent.appendChild(createDomFromNormalized(newChildren[i]));
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
		}
	}

	for (; childIndex < newChildren.length; childIndex++) {
		parent.appendChild(createDomFromNormalized(newChildren[childIndex]));
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
	const focused =
		document.activeElement instanceof HTMLElement &&
		document.activeElement !== document.body
			? document.activeElement
			: null;

	const oldDom = domNodes.slice(0, oldChildren.length);
	const extras = domNodes.slice(oldChildren.length);
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

	const anchor = extras.find((node) => node.parentNode === parent) ?? null;
	for (const node of nextDom) parent.insertBefore(node, anchor);
	// Moving a node drops focus in some DOM implementations. Browsers usually
	// keep it; restore it when the focused node is still in the document.
	if (focused?.isConnected && document.activeElement !== focused) {
		focused.focus();
	}
	return true;
}

// Props whose value imperatively replaces the element's entire subtree as a DOM
// property. Nodes they create are not tracked by the normalized children model,
// so the child diff must defer to them rather than reconcile against them.
// Hosts claim the same rule through `claimSubtree`.
const SUBTREE_OWNING_PROPS = ["innerHTML", "textContent"] as const;

function ownsSubtreeViaProps(props: IgniteJsxProps): boolean {
	for (const key of SUBTREE_OWNING_PROPS) {
		const value = (props as Record<string, unknown>)[key];
		if (value !== undefined && value !== null && value !== false) {
			return true;
		}
	}
	return false;
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
		if (domNode.nodeType !== Node.TEXT_NODE) {
			return replaceMounted(domNode, newNode);
		}
		if (domNode.textContent !== newNode.value) {
			domNode.textContent = newNode.value;
		}
		return domNode;
	}

	if (newNode.kind === "comment") {
		if (domNode.nodeType !== Node.COMMENT_NODE) {
			return replaceMounted(domNode, newNode);
		}
		return domNode;
	}

	// element
	if (newNode.kind !== "element" || oldNode.kind !== "element") {
		return createDomFromNormalized(newNode);
	}

	if (isNoDiffDenylistedTag(newNode.tag)) {
		onFallbackReplace?.(`denylist:${newNode.tag.toLowerCase()}`);
		return replaceMounted(domNode, newNode);
	}

	if (
		domNode.nodeType !== Node.ELEMENT_NODE ||
		(domNode as Element).namespaceURI !==
			(newNode.namespace ?? (domNode as Element).namespaceURI) ||
		(domNode as Element).tagName.toLowerCase() !== newNode.tag.toLowerCase()
	) {
		return replaceMounted(domNode, newNode);
	}

	const elementNode = domNode as Element & ParentNode;

	patchProps(elementNode, oldNode.props, newNode.props);
	assignRef(elementNode, newNode.props.ref);

	// A subtree owner (innerHTML, textContent, or a host claim) is opaque.
	// patchProps already applied the owning prop — skip child diffing so the
	// positional patch does not desync against untracked DOM nodes (issue #57).
	if (subtreeIsOwned(elementNode, newNode.props)) {
		return domNode;
	}
	// If the PREVIOUS render owned the subtree via props but this one renders
	// JSX children, hard-clear the imperatively-managed content before
	// reconciling so stale or duplicate nodes are not left behind.
	if (ownsSubtreeViaProps(oldNode.props)) {
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
		}
	}

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

	// Detect reorder (same multiset, different order)
	if (oldChildren.length > 1 && newChildren.length === oldChildren.length) {
		const oldFingerprints = oldChildren.map(fingerprintNode).join("|");
		const newFingerprints = newChildren.map(fingerprintNode).join("|");
		if (oldFingerprints !== newFingerprints) {
			const oldSorted = [...oldChildren].map(fingerprintNode).sort().join("|");
			const newSorted = [...newChildren].map(fingerprintNode).sort().join("|");
			if (oldSorted === newSorted) {
				return false;
			}
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

function fingerprintNode(node: NormalizedNode): string {
	switch (node.kind) {
		case "text":
			return `t:${node.value}`;
		case "comment":
			return `c:${node.comment ?? ""}`;
		case "element":
			return `e:${node.namespace ?? ""}:${node.tag}:${node.children
				.map((child) => fingerprintNode(child))
				.join(",")}`;
	}
}

function patchProps(
	element: Element,
	oldProps: IgniteJsxProps,
	newProps: IgniteJsxProps,
) {
	const isSvgElement = element instanceof SVGElement;

	for (const key of Object.keys(oldProps)) {
		if (key === "children" || key === "ref") continue;
		if (!(key in newProps)) {
			removeProp(element, key, oldProps[key], isSvgElement);
		}
	}

	for (const [key, next] of Object.entries(newProps)) {
		if (key === "children" || key === "ref") continue;
		if (
			(key === "innerHTML" || key === "textContent") &&
			next !== undefined &&
			next !== null &&
			next !== false
		) {
			warnDeprecatedContentProp(element, key);
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

		if (key.startsWith("on") && key.length > 2) {
			patchEventListener(element, key, prev, next);
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

	if (key.startsWith("on") && key.length > 2 && typeof prev === "function") {
		const eventName = normalizeEventName(key.slice(2));
		element.removeEventListener(eventName, prev as EventListener);
		return;
	}

	if (!isSvg && key in element && key !== "list") {
		// Reset property to undefined to avoid stale values.
		Reflect.set(element as HTMLElement, key, undefined);
	}

	const attrName = isSvg ? normalizeSvgAttributeName(key) : key;
	if (element.hasAttribute(attrName)) {
		element.removeAttribute(attrName);
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
