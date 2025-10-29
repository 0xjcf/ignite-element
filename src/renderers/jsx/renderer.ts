import {
	Fragment,
	type IgniteJsxChild,
	type IgniteJsxElement,
	type IgniteJsxProps,
	isIgniteJsxElement,
	normalizeChildren,
} from "./types";

export function createDomNode(node: IgniteJsxChild): Node | DocumentFragment {
	if (Array.isArray(node)) {
		const fragment = document.createDocumentFragment();
		for (const child of node) {
			const childNode = createDomNode(child);
			appendNode(fragment, childNode);
		}
		return fragment;
	}

	if (node === null || node === undefined || node === false || node === true) {
		return document.createComment("ignite-empty");
	}

	if (typeof node === "string" || typeof node === "number") {
		return document.createTextNode(String(node));
	}

	if (isIgniteJsxElement(node)) {
		return createElementNode(node);
	}

	return document.createComment("ignite-unknown");
}

export function mountIgniteJsx(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
) {
	while (host.firstChild) {
		host.removeChild(host.firstChild);
	}

	const node = createDomNode(view);
	appendNode(host, node);
}

function createElementNode(element: IgniteJsxElement): Node {
	const { type, props } = element;

	if (type === Fragment) {
		const fragment = document.createDocumentFragment();
		for (const child of normalizeChildren(props.children)) {
			appendNode(fragment, createDomNode(child));
		}
		return fragment;
	}

	if (typeof type === "function") {
		const result = type(props);
		return createDomNode(result);
	}

	const elementNode = document.createElement(type);
	setProps(elementNode, props);
	for (const child of normalizeChildren(props.children)) {
		appendNode(elementNode, createDomNode(child));
	}
	return elementNode;
}

function appendNode(
	parent: Node | DocumentFragment,
	child: Node | DocumentFragment,
) {
	parent.appendChild(child);
}

function setProps(element: Element, props: IgniteJsxProps) {
	for (const [key, value] of Object.entries(props)) {
		if (key === "children" || key === "ref") {
			continue;
		}

		if (key === "class" || key === "className") {
			if (value !== false && value != null) {
				element.setAttribute("class", String(value));
			}
			continue;
		}

		if (key === "style" && value && typeof value === "object") {
			for (const [styleKey, styleValue] of Object.entries(
				value as Record<string, unknown>,
			)) {
				if (styleValue != null) {
					(element as HTMLElement).style.setProperty(
						styleKey,
						String(styleValue),
					);
				}
			}
			continue;
		}

		if (typeof value === "function" && key.startsWith("on") && key.length > 2) {
			const eventName = normalizeEventName(key.slice(2));
			(element as HTMLElement).addEventListener(
				eventName,
				value as EventListener,
			);
			continue;
		}

		if (value === false || value === null || value === undefined) {
			element.removeAttribute(key);
			continue;
		}

		if (key in element) {
			Reflect.set(element, key, value);
			continue;
		}

		element.setAttribute(key, String(value));
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
