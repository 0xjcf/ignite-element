import { jsx } from "../../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import {
	createDomNode,
	mountIgniteJsx,
	renderIgniteJsx,
	unmountIgniteSubtree,
} from "../../../../../ignite-renderer/src/renderers/jsx/renderer";

export type RefCase = {
	kind: "input" | "textarea" | "checkbox" | "radio" | "select" | "option";
	mode: "mount" | "update" | "replace" | "create";
	connected: boolean;
	value: string;
};
function reading(root: ParentNode, includeRoot?: Element) {
	const nodes = Array.from(
		root.querySelectorAll("input,textarea,select,option"),
	);
	if (includeRoot?.matches("input,textarea,select,option"))
		nodes.unshift(includeRoot);
	return nodes.map((element) => ({
		tag: element.localName,
		value: (element as HTMLInputElement).value,
		checked:
			element.localName === "input"
				? (element as HTMLInputElement).checked
				: null,
		selected:
			element.localName === "option"
				? (element as HTMLOptionElement).selected
				: null,
		text: element.textContent,
	}));
}
export function refs(scenario: RefCase) {
	const host = document.createElement("div");
	if (scenario.connected && scenario.mode !== "create")
		document.body.append(host);
	const observations: {
		state: ReturnType<typeof reading>;
		placed: boolean;
		connected: boolean;
		target: unknown;
		finalTarget?: unknown;
	}[] = [];
	const targets: Element[] = [];
	const targetState = (node: Element) => ({
		value: Reflect.get(node, "value"),
		checked: Reflect.get(node, "checked"),
		selected: Reflect.get(node, "selected"),
	});
	const root: ParentNode = host;
	const acquire = (node: Element | null) => {
		if (!node) return;
		// createDomNode returns its own detached root; the callback can inspect it.
		const intended =
			scenario.mode === "create" ? (node.getRootNode() as ParentNode) : root;
		const state = reading(
			intended,
			scenario.mode === "create" && intended instanceof Element
				? intended
				: undefined,
		);
		targets.push(node);
		observations.push({
			state,
			placed: scenario.mode === "create" || host.contains(node),
			connected: node.isConnected,
			target: targetState(node),
		});
	};
	const view = (bare: boolean) => {
		const ref = bare ? undefined : acquire;
		const value = bare ? "initial" : scenario.value;
		if (scenario.kind === "select" || scenario.kind === "option")
			return jsx("select", {
				ref,
				...(scenario.kind === "select" ? { value: bare ? "a" : "b" } : {}),
				children: [
					jsx("option", {
						value: "a",
						ref: scenario.kind === "option" ? ref : undefined,
						selected: scenario.kind === "option" ? !bare : undefined,
						children: bare ? "old" : "new",
					}),
					jsx("option", { value: "b", defaultSelected: true, children: "b" }),
				],
			});
		if (scenario.kind === "radio")
			return jsx("form", {
				ref,
				children: [
					jsx("input", { type: "radio", name: "commit", checked: !bare, ref }),
					jsx("input", { type: "radio", name: "commit", defaultChecked: true }),
				],
			});
		return jsx(scenario.kind === "textarea" ? "textarea" : "input", {
			ref,
			type: scenario.kind === "checkbox" ? "checkbox" : "text",
			defaultValue: "default",
			value,
			...(scenario.kind === "checkbox"
				? { defaultChecked: true, checked: false }
				: {}),
		});
	};
	try {
		if (scenario.mode === "create") {
			const node = createDomNode(view(false));
			host.append(node);
		} else if (scenario.mode === "mount") mountIgniteJsx(host, view(false));
		else {
			const tree = mountIgniteJsx(host, view(true));
			renderIgniteJsx(host, view(false), tree, {
				mode: scenario.mode === "replace" ? "replace" : "diff",
			});
		}
		const final = reading(host);
		observations.forEach((observation, index) => {
			observation.finalTarget = targetState(targets[index]);
		});
		return { observations, final };
	} finally {
		unmountIgniteSubtree(host);
		host.remove();
	}
}

export const ATTRIBUTES = [
	{
		key: "translate",
		attr: "translate",
		value: false,
		token: "no",
		context: "yes",
	},
	{
		key: "TRANSLATE",
		attr: "translate",
		value: false,
		token: "no",
		context: "yes",
	},
	{
		key: "spellcheck",
		attr: "spellcheck",
		value: false,
		token: "false",
		context: "true",
	},
	{
		key: "SPELLCHECK",
		attr: "spellcheck",
		value: false,
		token: "false",
		context: "true",
	},
	{
		key: "draggable",
		attr: "draggable",
		value: false,
		token: "false",
		context: "true",
	},
	{
		key: "DRAGGABLE",
		attr: "draggable",
		value: false,
		token: "false",
		context: "true",
	},
	{
		key: "contentEditable",
		attr: "contenteditable",
		value: "false",
		token: "false",
		context: "true",
	},
	{
		key: "contenteditable",
		attr: "contenteditable",
		value: "false",
		token: "false",
		context: "true",
	},
	{ key: "hidden", attr: "hidden", value: false, token: null, context: "" },
	{
		key: "hidden",
		attr: "hidden",
		value: "until-found",
		token: "until-found",
		context: "",
	},
	{
		key: "autocapitalize",
		attr: "autocapitalize",
		value: "none",
		token: "none",
		context: "words",
	},
	{
		key: "autocapitalize",
		attr: "autocapitalize",
		value: "off",
		token: "off",
		context: "words",
	},
] as const;
export type AttributeCase = {
	index: number;
	update: boolean;
	inherited: boolean;
	removal: "omit" | "null" | "undefined";
};
function semantics(element: HTMLElement, attr: string) {
	if (attr === "contenteditable") return element.isContentEditable;
	if (attr === "autocapitalize") return element.autocapitalize;
	return Reflect.get(element, attr);
}
export function attributes(scenario: AttributeCase) {
	const spec = ATTRIBUTES[scenario.index];
	const host = document.createElement("div");
	const oracleHost = document.createElement("div");
	if (scenario.inherited) {
		host.setAttribute(spec.attr, spec.context);
		oracleHost.setAttribute(spec.attr, spec.context);
	}
	document.body.append(host, oracleHost);
	// An anchor's auto draggable state is true; removal is observably different.
	const tag = spec.attr === "draggable" ? "a" : "div";
	const oracle = document.createElement(tag);
	if (tag === "a") oracle.setAttribute("href", "#drag");
	oracleHost.append(oracle);
	const view = (props: Record<string, unknown>) =>
		jsx(tag, { ...(tag === "a" ? { href: "#drag" } : {}), ...props });
	try {
		let tree = mountIgniteJsx(
			host,
			view(
				scenario.update
					? { [spec.key]: spec.context }
					: { [spec.key]: spec.value },
			),
		);
		if (scenario.update)
			tree = renderIgniteJsx(host, view({ [spec.key]: spec.value }), tree);
		const element = host.firstElementChild as HTMLElement;
		if (spec.token !== null) oracle.setAttribute(spec.attr, spec.token);
		const actual = {
			token: element.getAttribute(spec.attr),
			semantic: semantics(element, spec.attr),
		};
		const expected = {
			token: spec.token,
			semantic: semantics(oracle, spec.attr),
		};
		const props =
			scenario.removal === "omit"
				? {}
				: { [spec.key]: scenario.removal === "null" ? null : undefined };
		renderIgniteJsx(host, view(props), tree);
		oracle.removeAttribute(spec.attr);
		return {
			actual,
			expected,
			removed: {
				token: element.getAttribute(spec.attr),
				semantic: semantics(element, spec.attr),
			},
			absent: { token: null, semantic: semantics(oracle, spec.attr) },
		};
	} finally {
		host.remove();
		oracleHost.remove();
	}
}

export type CompositionCase = {
	tag: "input" | "textarea";
	shadow: boolean;
	loss:
		| "end"
		| "blur"
		| "detach"
		| "reconnect"
		| "reconnect-focus"
		| "unmount"
		| "other-target";
	value: string;
};
export function composition(scenario: CompositionCase) {
	const host = document.createElement("div");
	document.body.append(host);
	const root = scenario.shadow ? host.attachShadow({ mode: "open" }) : host;
	const view = (value: string) => jsx(scenario.tag, { value });
	let tree = mountIgniteJsx(root, view("initial"));
	const input = root.firstElementChild as
		| HTMLInputElement
		| HTMLTextAreaElement;
	input.focus();
	input.dispatchEvent(
		new CompositionEvent("compositionstart", { bubbles: true }),
	);
	input.value = "ime";
	tree = renderIgniteJsx(root, view(scenario.value), tree);
	const held = input.value;
	if (scenario.loss === "end")
		input.dispatchEvent(
			new CompositionEvent("compositionend", { bubbles: true }),
		);
	else if (scenario.loss === "blur" || scenario.loss === "other-target")
		input.blur();
	else if (scenario.loss === "unmount") unmountIgniteSubtree(input);
	else {
		host.remove();
		if (scenario.loss === "reconnect" || scenario.loss === "reconnect-focus")
			document.body.append(host);
		if (scenario.loss === "reconnect-focus") input.focus();
	}
	if (scenario.loss === "other-target") {
		// Late events may target an element that no longer owns focus.
		input.dispatchEvent(
			new CompositionEvent("compositionstart", { bubbles: true }),
		);
	}
	const beforeNextRender = input.value;
	renderIgniteJsx(root, view(scenario.value), tree);
	const recovered = input.value;
	// A later real session still holds, even inside a shadow root.
	document.body.append(host);
	input.focus();
	input.dispatchEvent(new CompositionEvent("compositionstart"));
	input.value = "next-ime";
	tree = renderIgniteJsx(root, view("next-value"), tree);
	const nextHeld = input.value;
	input.dispatchEvent(new CompositionEvent("compositionend"));
	renderIgniteJsx(root, view("next-value"), tree);
	const nextRecovered = input.value;
	unmountIgniteSubtree(host);
	host.remove();
	return { held, beforeNextRender, recovered, nextHeld, nextRecovered };
}
function preview() {
	document.body.replaceChildren();
	const host = document.createElement("main");
	document.body.append(host);
	const observations: string[] = [];
	mountIgniteJsx(
		host,
		jsx("form", {
			children: [
				jsx("h1", { children: "Renderer commit validation" }),
				jsx("label", {
					children: [
						"Controlled selection: ",
						jsx("select", {
							value: "b",
							ref: (node: HTMLSelectElement | null) => {
								if (node)
									observations.push(
										`select ref: ${node.value}; connected: ${node.isConnected}`,
									);
							},
							children: [
								jsx("option", { value: "a", children: "a" }),
								jsx("option", { value: "b", children: "b" }),
							],
						}),
					],
				}),
				jsx("p", { translate: false, children: "Explicit translate=false" }),
				jsx("textarea", {
					spellcheck: false,
					value: "Controlled value recovered after IME cancellation",
				}),
				jsx("input", { type: "radio", name: "preview", checked: true }),
				jsx("input", { type: "radio", name: "preview", defaultChecked: true }),
			],
		}),
	);
	const details = document.createElement("pre");
	details.textContent =
		observations.join("\n") + "\n" + JSON.stringify(reading(host), null, 2);
	host.append(details);
	document.body.style.cssText =
		"font:16px system-ui;margin:32px;max-width:800px";
}
window.__commitBoundaries = { refs, attributes, composition, preview };
declare global {
	interface Window {
		__commitBoundaries: {
			refs: typeof refs;
			attributes: typeof attributes;
			composition: typeof composition;
			preview: typeof preview;
		};
	}
}
