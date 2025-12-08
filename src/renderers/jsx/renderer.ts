import {
	Fragment,
	type IgniteJsxChild,
	type IgniteJsxElement,
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

export function createDomNode(
	node: IgniteJsxChild,
	namespace?: string,
): Node | DocumentFragment {
	if (Array.isArray(node)) {
		const fragment = document.createDocumentFragment();
		for (const child of node) {
			const childNode = createDomNode(child, namespace);
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
		return createElementNode(node, namespace);
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

function createElementNode(
	element: IgniteJsxElement,
	parentNamespace?: string,
): Node {
	const { type, props } = element;

	if (type === Fragment) {
		const fragment = document.createDocumentFragment();
		for (const child of normalizeChildren(props.children)) {
			appendNode(fragment, createDomNode(child, parentNamespace));
		}
		return fragment;
	}

	if (typeof type === "function") {
		const result = type(props);
		return createDomNode(result, parentNamespace);
	}

	const tagName = String(type);
	const isSvgRoot = tagName === "svg";
	const useSvgNamespace = isSvgRoot || parentNamespace === SVG_NAMESPACE;
	const elementNode = useSvgNamespace
		? document.createElementNS(SVG_NAMESPACE, tagName)
		: document.createElement(tagName);

	setProps(elementNode, props);

	const childNamespace = isSvgRoot
		? SVG_NAMESPACE
		: tagName === "foreignObject"
			? undefined
			: useSvgNamespace
				? SVG_NAMESPACE
				: undefined;

	for (const child of normalizeChildren(props.children)) {
		appendNode(elementNode, createDomNode(child, childNamespace));
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
	const isSvgElement = element instanceof SVGElement;
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
					const cssProperty = styleKey
						.replace(/([A-Z])/g, "-$1")
						.toLowerCase();
					(element as HTMLElement).style.setProperty(
						cssProperty,
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

		if (!isSvgElement && key in element) {
			Reflect.set(element, key, value);
			continue;
		}

		const attributeName = isSvgElement ? normalizeSvgAttributeName(key) : key;
		element.setAttribute(attributeName, String(value));
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
