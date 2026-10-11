import { isExecutableUri } from "../../../../../ignite-renderer/src/renderers/jsx/executableUri";
import { jsx } from "../../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import {
	mountIgniteJsx,
	renderIgniteJsx,
} from "../../../../../ignite-renderer/src/renderers/jsx/renderer";
import {
	type AliasReport,
	type AliasScenario,
	type ControlSnapshot,
	OFF_LIST_PROPS,
	type OffListReading,
	offListAttribute,
	type ResetReport,
	type ResetScenario,
	type SinkScenario,
	type ValueSpec,
} from "./scenarios";

const PROBE = "x-reset-probe";

class ResetProbe extends HTMLElement {
	#label = "";
	#count = 0;
	#defaultValue = "";
	#defaultChecked = false;
	#defaultSelected = false;
	#foo = 0;
	#fooUpper = 0;

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

	get defaultValue(): string {
		return this.#defaultValue;
	}

	set defaultValue(value: unknown) {
		this.#defaultValue = value == null ? "" : String(value);
	}

	get defaultChecked(): boolean {
		return this.#defaultChecked;
	}

	set defaultChecked(value: unknown) {
		this.#defaultChecked = !(value == null || value === false);
	}

	get defaultSelected(): boolean {
		return this.#defaultSelected;
	}

	set defaultSelected(value: unknown) {
		this.#defaultSelected = !(value == null || value === false);
	}

	get foo(): number {
		return this.#foo;
	}

	set foo(value: unknown) {
		this.#foo = value == null || value === false ? 0 : Number(value);
	}

	get FOO(): number {
		return this.#fooUpper;
	}

	set FOO(value: unknown) {
		this.#fooUpper = value == null || value === false ? 0 : Number(value);
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
	if (tag.kind === "audio") return "audio";
	if (tag.kind === "label") return "label";
	if (tag.kind === "form") return "form";
	if (tag.kind === "meta") return "meta";
	if (tag.kind === "td") return "td";
	return "div";
}

function isOffList(key: string): boolean {
	return (OFF_LIST_PROPS as readonly string[]).includes(key);
}

function childNodes(
	scenario: ResetScenario,
	dropped: boolean,
	reference: boolean,
) {
	const dropSelected = dropped && scenario.drop.includes("selected");
	const falseDefault =
		dropped && scenario.falses.includes("defaultSelected");
	const dropDefault =
		dropped && scenario.drop.includes("defaultSelected") && !reference;
	if (scenario.tag.kind === "select") {
		const values = scenario.options.map((option) => option.value);
		const duplicate = values.length !== new Set(values).size;
		return scenario.options.map((option, index) => {
			const props: Record<string, unknown> = {
				ref: childRef,
				value: option.value,
				children: option.text,
			};
			if (falseDefault && option.defaultSelected) {
				props.defaultSelected = false;
			} else if (!dropDefault && option.defaultSelected) {
				props.defaultSelected = true;
			}
			if (!dropSelected && option.selected != null) {
				props.selected = option.selected;
			}
			return jsx("option", props, duplicate ? index : option.value);
		});
	}
	if (
		scenario.tag.kind === "input" ||
		scenario.tag.kind === "textarea" ||
		scenario.tag.kind === "audio"
	) {
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

function view(scenario: ResetScenario, dropped: boolean, reference = false) {
	const props: Record<string, unknown> = {
		style: { height: "24px", overflow: "auto" },
	};
	if (scenario.tag.kind === "input") props.type = scenario.tag.type;
	if (
		scenario.tag.kind === "input" ||
		scenario.tag.kind === "textarea" ||
		scenario.tag.kind === "audio"
	) {
		props.ref = childRef;
	}
	if (scenario.tag.kind === "select" && scenario.tag.multiple) {
		props.multiple = true;
	}
	for (const [key, value] of Object.entries(scenario.props)) {
		if (dropped && scenario.falses.includes(key)) {
			props[key] = false;
			continue;
		}
		if (
			dropped &&
			scenario.drop.includes(key) &&
			!(reference && isOffList(key) && scenario.tag.kind !== "custom")
		) {
			continue;
		}
		props[key] = value;
	}
	props.children = childNodes(scenario, dropped, reference);
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
			tag === PROBE
				? probe.defaultValue
				: tag === "input" || tag === "textarea"
					? control.defaultValue
					: null,
		checked: tag === "input" ? control.checked : null,
		defaultChecked:
			tag === PROBE
				? probe.defaultChecked
				: tag === "input"
					? control.defaultChecked
					: null,
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
		probeDefaultSelected: tag === PROBE ? probe.defaultSelected : null,
		text: element.textContent ?? "",
	};
}

function optionNodes(element: Element): Element[] {
	if (element.localName !== "select") return [];
	return Array.from((element as HTMLSelectElement).options);
}

function readValue(value: unknown): string | number | boolean | null {
	if (
		typeof value === "number" ||
		typeof value === "string" ||
		typeof value === "boolean"
	) {
		return value;
	}
	return null;
}

function readOffList(
	element: Element,
	scenario: ResetScenario,
): OffListReading[] {
	const record = element as unknown as Record<string, unknown>;
	const readings: OffListReading[] = OFF_LIST_PROPS.filter(
		(key) =>
			key in scenario.props &&
			!scenario.falses.includes(key) &&
			scenario.tag.kind !== "custom",
	).map((key) => ({
		key,
		before: readValue(record[key]),
		after: null,
		attrBefore: element.getAttribute(offListAttribute(key)),
		attrAfter: null,
	}));
	if (
		element.localName === "select" &&
		scenario.drop.includes("defaultSelected")
	) {
		for (const option of (element as HTMLSelectElement).options) {
			readings.push({
				key: `defaultSelected:${option.value}`,
				before: option.defaultSelected,
				after: null,
				attrBefore: option.getAttribute("selected"),
				attrAfter: null,
			});
		}
	}
	return readings;
}

function runReset(scenario: ResetScenario): ResetReport {
	mounts = 0;
	unmounts = 0;
	const host = document.createElement("div");
	const freshHost = document.createElement("div");
	document.body.append(host, freshHost);
	try {
		let tree = mountIgniteJsx(host, view(scenario, scenario.control === true));
		if (scenario.control) {
			tree = renderIgniteJsx(host, view(scenario, false), tree);
		}
		const element = host.firstElementChild;
		if (!element) throw new Error("mount produced no element");
		const offList = readOffList(element, scenario);
		const before = optionNodes(element);
		renderIgniteJsx(host, view(scenario, true), tree);
		const record = element as unknown as Record<string, unknown>;
		const options = element as HTMLSelectElement;
		for (const reading of offList) {
			if (reading.key.startsWith("defaultSelected:")) {
				const optionValue = reading.key.slice("defaultSelected:".length);
				const option = Array.from(options.options).find(
					(item) => item.value === optionValue,
				);
				reading.after = option ? option.defaultSelected : null;
				reading.attrAfter = option ? option.getAttribute("selected") : null;
				continue;
			}
			reading.after = readValue(record[reading.key]);
			reading.attrAfter = element.getAttribute(offListAttribute(reading.key));
		}
		const after = optionNodes(element);
		const mountsAfterUpdate = mounts;
		const unmountsAfterUpdate = unmounts;
		mountIgniteJsx(freshHost, view(scenario, true, true));
		const fresh = freshHost.firstElementChild;
		if (!fresh) throw new Error("fresh mount produced no element");
		return {
			updated: snapshot(element),
			fresh: snapshot(fresh),
			offList,
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

function probeCounts(element: Element): {
	foo: number | null;
	FOO: number | null;
} {
	if (element.localName !== PROBE) return { foo: null, FOO: null };
	const probe = element as ResetProbe;
	return { foo: probe.foo, FOO: probe.FOO };
}

function runAlias(scenario: AliasScenario): AliasReport {
	const host = document.createElement("div");
	const freshHost = document.createElement("div");
	document.body.append(host, freshHost);
	let firstCalls = 0;
	let secondCalls = 0;
	const first = () => {
		firstCalls += 1;
	};
	const second = () => {
		secondCalls += 1;
	};
	const same = scenario.value === scenario.next;
	const event = scenario.kind === "event" || scenario.kind === "event-both";
	try {
		const fromValue = event
			? first
			: scenario.kind === "custom"
				? Number(scenario.value)
				: scenario.value;
		const toValue = event
			? same
				? first
				: second
			: scenario.kind === "custom"
				? Number(scenario.next)
				: scenario.next;
		// The kept spelling is listed first so sink matching sees it before the
		// extra listener. The extra spelling has to be removed on its own.
		const initial =
			scenario.kind === "event-both"
				? { [scenario.toKey]: toValue, [scenario.fromKey]: first }
				: { [scenario.fromKey]: fromValue };
		const tree = mountIgniteJsx(host, jsx(scenario.tag, initial));
		renderIgniteJsx(
			host,
			jsx(scenario.tag, { [scenario.toKey]: toValue }),
			tree,
		);
		mountIgniteJsx(freshHost, jsx(scenario.tag, { [scenario.toKey]: toValue }));
		const updated = host.firstElementChild;
		const fresh = freshHost.firstElementChild;
		if (!updated || !fresh) throw new Error("alias mount produced no element");
		if (event) {
			updated.dispatchEvent(new Event(scenario.toKey.slice(2).toLowerCase()));
		}
		const updatedProbe = probeCounts(updated);
		const freshProbe = probeCounts(fresh);
		return {
			updatedAttrs: attrsOf(updated),
			freshAttrs: attrsOf(fresh),
			firstCalls,
			secondCalls,
			foo: updatedProbe.foo,
			FOO: updatedProbe.FOO,
			freshFoo: freshProbe.foo,
			freshFOO: freshProbe.FOO,
		};
	} finally {
		host.remove();
		freshHost.remove();
	}
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

window.__igniteProperties = { runReset, runSink, runAlias };

declare global {
	interface Window {
		__igniteProperties: {
			runReset: typeof runReset;
			runSink: typeof runSink;
			runAlias: typeof runAlias;
		};
	}
}
