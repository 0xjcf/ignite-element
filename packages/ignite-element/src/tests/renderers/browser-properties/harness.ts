import { isExecutableUri } from "../../../../../ignite-renderer/src/renderers/jsx/executableUri";
import { jsx } from "../../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import {
	mountIgniteJsx,
	renderIgniteJsx,
} from "../../../../../ignite-renderer/src/renderers/jsx/renderer";
import type {
	ControlSnapshot,
	ResetReport,
	ResetScenario,
	SinkScenario,
	ValueSpec,
} from "./scenarios";

const PROBE = "x-reset-probe";

class ResetProbe extends HTMLElement {
	#label = "";
	#count = 0;

	get label(): string {
		return this.#label;
	}

	set label(value: unknown) {
		this.#label = value == null ? "" : String(value).trim();
	}

	get count(): number {
		return this.#count;
	}

	set count(value: unknown) {
		this.#count = value == null || value === false ? 0 : Number(value);
	}
}

if (!customElements.get(PROBE)) {
	customElements.define(PROBE, ResetProbe);
}

let mounts = 0;
let unmounts = 0;

function childRef(): () => void {
	mounts += 1;
	return () => {
		unmounts += 1;
	};
}

function tagName(tag: ResetScenario["tag"]): string {
	if (tag.kind === "input") return "input";
	if (tag.kind === "textarea") return "textarea";
	if (tag.kind === "select") return "select";
	if (tag.kind === "custom") return PROBE;
	return "div";
}

function childNodes(scenario: ResetScenario, dropped: boolean) {
	const dropSelected = dropped && scenario.drop.includes("selected");
	const dropDefault = dropped && scenario.drop.includes("defaultSelected");
	if (scenario.tag.kind === "select") {
		return scenario.options.map((option) => {
			const props: Record<string, unknown> = {
				ref: childRef,
				value: option.value,
				children: option.text,
			};
			if (!dropDefault && option.defaultSelected) props.defaultSelected = true;
			if (!dropSelected && option.selected != null) {
				props.selected = option.selected;
			}
			return jsx("option", props, option.value);
		});
	}
	if (scenario.tag.kind === "input" || scenario.tag.kind === "textarea") {
		return undefined;
	}
	return jsx(
		"span",
		{
			ref: childRef,
			style: { display: "block", height: "80px" },
			children: "kept",
		},
		"child",
	);
}

function view(scenario: ResetScenario, dropped: boolean) {
	const props: Record<string, unknown> = {
		style: { height: "24px", overflow: "auto" },
	};
	if (scenario.tag.kind === "input") props.type = scenario.tag.type;
	if (scenario.tag.kind === "input" || scenario.tag.kind === "textarea") {
		props.ref = childRef;
	}
	if (scenario.tag.kind === "select" && scenario.tag.multiple) {
		props.multiple = true;
	}
	for (const [key, value] of Object.entries(scenario.props)) {
		if (dropped && scenario.drop.includes(key)) continue;
		props[key] = value;
	}
	props.children = childNodes(scenario, dropped);
	return jsx(tagName(scenario.tag), props);
}

function attrsOf(element: Element): [string, string][] {
	return element
		.getAttributeNames()
		.sort()
		.map((name) => [name, element.getAttribute(name) ?? ""]);
}

function snapshot(element: Element): ControlSnapshot {
	const tag = element.localName;
	const control = element as HTMLInputElement;
	const isControl = tag === "input" || tag === "textarea" || tag === "select";
	const probe = element as ResetProbe;
	const select = element as HTMLSelectElement;
	return {
		value: isControl ? control.value : null,
		defaultValue:
			tag === "input" || tag === "textarea" ? control.defaultValue : null,
		checked: tag === "input" ? control.checked : null,
		defaultChecked: tag === "input" ? control.defaultChecked : null,
		scrollTop: (element as HTMLElement).scrollTop,
		scrollLeft: (element as HTMLElement).scrollLeft,
		attrs: attrsOf(element),
		options:
			tag === "select"
				? Array.from(select.options).map((option) => ({
						value: option.value,
						selected: option.selected,
						defaultSelected: option.defaultSelected,
						attrs: attrsOf(option),
					}))
				: [],
		label: tag === PROBE ? probe.label : null,
		count: tag === PROBE ? probe.count : null,
		text: element.textContent ?? "",
	};
}

function optionNodes(element: Element): Element[] {
	if (element.localName !== "select") return [];
	return Array.from((element as HTMLSelectElement).options);
}

function runReset(scenario: ResetScenario): ResetReport {
	mounts = 0;
	unmounts = 0;
	const host = document.createElement("div");
	const freshHost = document.createElement("div");
	document.body.append(host, freshHost);
	try {
		const tree = mountIgniteJsx(host, view(scenario, false));
		const element = host.firstElementChild;
		if (!element) throw new Error("mount produced no element");
		const before = optionNodes(element);
		renderIgniteJsx(host, view(scenario, true), tree);
		const after = optionNodes(element);
		const mountsAfterUpdate = mounts;
		const unmountsAfterUpdate = unmounts;
		mountIgniteJsx(freshHost, view(scenario, true));
		const fresh = freshHost.firstElementChild;
		if (!fresh) throw new Error("fresh mount produced no element");
		return {
			updated: snapshot(element),
			fresh: snapshot(fresh),
			mounts: mountsAfterUpdate,
			unmounts: unmountsAfterUpdate,
			optionCountBefore: before.length,
			optionCountAfter: after.length,
			sameOptionNodes:
				before.length === after.length &&
				before.every((node, index) => node === after[index]),
		};
	} finally {
		host.remove();
		freshHost.remove();
	}
}

function materialize(spec: ValueSpec): unknown {
	if (spec.kind === "string") return spec.value;
	if (spec.kind === "array") return spec.values;
	if (spec.kind === "boxed") return Object(spec.value);
	if (spec.kind === "toString") return { toString: () => spec.value };
	const boxed = Object(spec.value) as { [Symbol.toPrimitive]: () => string };
	boxed[Symbol.toPrimitive] = () => spec.value;
	return boxed;
}

function sinkView(scenario: SinkScenario, spec: ValueSpec) {
	const value = materialize(spec);
	if (scenario.surface === "href") {
		return jsx("a", { href: value, children: "go" });
	}
	if (scenario.surface === "src") {
		return jsx("iframe", { src: value, title: "frame" });
	}
	if (scenario.surface === "action") {
		return jsx("form", { action: value });
	}
	if (scenario.surface === "formaction") {
		return jsx("button", { formAction: value, children: "go" });
	}
	if (scenario.surface === "srcdoc") {
		return jsx("iframe", { srcdoc: value, title: "doc" });
	}
	if (scenario.surface === "handler") {
		return jsx("div", { [scenario.handlerName]: value, children: "node" });
	}
	if (scenario.surface === "meta") {
		return jsx("meta", {
			[scenario.metaKey]: value,
			content: "0;url=https://example.com",
		});
	}
	return jsx("svg", {
		children: jsx(scenario.surface, {
			attributeName: materialize(scenario.attributeName),
			from: value,
			to: value,
			by: value,
			values: value,
		}),
	});
}

function stripped(value: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII controls hide schemes
	return value.replace(/[\u0000-\u0020\u007f]/g, "").toLowerCase();
}

function targetsHref(name: string): boolean {
	return stripped(name).split(/[:}]/).pop() === "href";
}

const urlAttributes = new Set([
	"href",
	"src",
	"action",
	"formaction",
	"xlink:href",
]);

function collectArmed(host: ParentNode): string[] {
	const armed: string[] = [];
	const elements = host.querySelectorAll("*");
	for (const element of elements) {
		for (const name of element.getAttributeNames()) {
			const lower = name.toLowerCase();
			const raw = element.getAttribute(name) ?? "";
			if (lower.startsWith("on")) armed.push(`handler ${name}`);
			if (urlAttributes.has(lower) && isExecutableUri(raw)) {
				armed.push(`attribute ${element.localName} ${name}=${raw}`);
			}
		}
		const urlHost = element as unknown as Record<string, unknown>;
		for (const key of ["href", "src", "action", "formAction"] as const) {
			if (!(key in element)) continue;
			const current = urlHost[key];
			if (typeof current !== "string" || current === "") continue;
			if (isExecutableUri(current)) {
				armed.push(`property ${element.localName}.${key}`);
				continue;
			}
			try {
				const url = new URL(current, location.href);
				if (url.protocol === "javascript:" || url.protocol === "vbscript:") {
					armed.push(`url ${element.localName}.${key} ${url.protocol}`);
				}
			} catch {
				// The property is not a URL.
			}
		}
		if (element.localName === "meta") {
			const equiv = element.getAttribute("http-equiv");
			if (equiv && stripped(equiv) === "refresh") armed.push("meta refresh");
		}
		if (element.localName === "iframe" && element.hasAttribute("srcdoc")) {
			armed.push("srcdoc");
		}
		if (element.localName === "animate" || element.localName === "set") {
			const name =
				element.getAttribute("attributeName") ??
				element.getAttribute("attribute-name");
			if (name != null && targetsHref(name)) {
				for (const key of ["from", "to", "by", "values"]) {
					if (element.hasAttribute(key)) {
						armed.push(`${element.localName} ${key} targets href`);
					}
				}
			}
		}
	}
	return armed;
}

function runSink(scenario: SinkScenario): { armed: string[] } {
	const host = document.createElement("div");
	document.body.append(host);
	try {
		const tree = mountIgniteJsx(host, sinkView(scenario, scenario.value));
		renderIgniteJsx(host, sinkView(scenario, scenario.next), tree);
		return { armed: collectArmed(host) };
	} finally {
		host.remove();
	}
}

window.__igniteProperties = { runReset, runSink };

declare global {
	interface Window {
		__igniteProperties: {
			runReset: typeof runReset;
			runSink: typeof runSink;
		};
	}
}
