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
	return normalizeChild(view, undefined);
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

	return [
		{
			kind: "element",
			tag: tagName,
			props: node.props,
			namespace: useSvgNamespace ? SVG_NAMESPACE : undefined,
			children: normalizedChildren,
		},
	];
}

function patchChildren(
	parent: ParentNode,
	oldChildren: NormalizedNode[],
	newChildren: NormalizedNode[],
	onFallbackReplace?: (reason: string) => void,
): boolean {
	if (!isAppendOnlyCompatible(oldChildren, newChildren)) {
		onFallbackReplace?.("child-order-change");
		return false;
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

function patchNode(
	domNode: ChildNode,
	oldNode: NormalizedNode,
	newNode: NormalizedNode,
	onFallbackReplace?: (reason: string) => void,
): ChildNode {
	if (oldNode.kind !== newNode.kind) {
		return createDomFromNormalized(newNode);
	}

	if (newNode.kind === "text") {
		if (domNode.nodeType !== Node.TEXT_NODE) {
			return createDomFromNormalized(newNode);
		}
		if (domNode.textContent !== newNode.value) {
			domNode.textContent = newNode.value;
		}
		return domNode;
	}

	if (newNode.kind === "comment") {
		if (domNode.nodeType !== Node.COMMENT_NODE) {
			return createDomFromNormalized(newNode);
		}
		return domNode;
	}

	// element
	if (newNode.kind !== "element" || oldNode.kind !== "element") {
		return createDomFromNormalized(newNode);
	}

	if (isNoDiffDenylistedTag(newNode.tag)) {
		onFallbackReplace?.(`denylist:${newNode.tag.toLowerCase()}`);
		return createDomFromNormalized(newNode);
	}

	if (
		domNode.nodeType !== Node.ELEMENT_NODE ||
		(domNode as Element).namespaceURI !==
			(newNode.namespace ?? (domNode as Element).namespaceURI) ||
		(domNode as Element).tagName.toLowerCase() !== newNode.tag.toLowerCase()
	) {
		return createDomFromNormalized(newNode);
	}

	const elementNode = domNode as Element & ParentNode;

	patchProps(elementNode, oldNode.props, newNode.props);

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
			elementNode.removeChild(elementNode.firstChild);
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
		parent.removeChild(parent.firstChild);
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
