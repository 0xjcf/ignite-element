import { isExecutableUri } from "../../../../../ignite-renderer/src/renderers/jsx/executableUri";
import { jsx } from "../../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import {
	mountIgniteJsx,
	renderIgniteJsx,
} from "../../../../../ignite-renderer/src/renderers/jsx/renderer";
import {
	type AliasReport,
	type AliasScenario,
	type ClassReport,
	type ClassScenario,
	type ContractControl,
	type ContractScenario,
	type ContractSnap,
	type ContractStep,
	type ContractTrace,
	type ControlSnapshot,
	type EventReport,
	type EventSequence,
	type LiveReport,
	type LiveScenario,
	OFF_LIST_PROPS,
	type OffListReading,
	offListAttribute,
	type RadioReport,
	type RadioScenario,
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
	// -1 is the unset sentinel so a native reset of 0 is visible.
	#scrollTop = -1;
	#scrollLeft = -1;

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

	get scrollTop(): number {
		return this.#scrollTop;
	}

	set scrollTop(value: unknown) {
		this.#scrollTop = value == null ? -1 : Number(value);
	}

	get scrollLeft(): number {
		return this.#scrollLeft;
	}

	set scrollLeft(value: unknown) {
		this.#scrollLeft = value == null ? -1 : Number(value);
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
	const falseDefault = dropped && scenario.falses.includes("defaultSelected");
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
		const held = snapshot(element);
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
			held,
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

function controlProps(
	scenario: LiveScenario,
	key: string,
	value: string | boolean,
): Record<string, unknown> {
	const props: Record<string, unknown> = { [key]: value };
	if (scenario.tag === "input") props.type = scenario.type;
	return props;
}

function readControl(element: Element | null): {
	value: string | null;
	checked: boolean | null;
	attrs: [string, string][];
} {
	if (!element) throw new Error("live mount produced no element");
	const control = element as HTMLInputElement;
	const isControl =
		element.localName === "input" || element.localName === "textarea";
	return {
		value: isControl ? control.value : null,
		checked: element.localName === "input" ? control.checked : null,
		attrs: attrsOf(element),
	};
}

function runLive(scenario: LiveScenario): LiveReport {
	const host = document.createElement("div");
	const freshHost = document.createElement("div");
	document.body.append(host, freshHost);
	try {
		const tree = mountIgniteJsx(
			host,
			jsx(
				scenario.tag,
				controlProps(scenario, scenario.fromKey, scenario.from),
			),
		);
		const held = readControl(host.firstElementChild);
		renderIgniteJsx(
			host,
			jsx(scenario.tag, controlProps(scenario, scenario.toKey, scenario.to)),
			tree,
		);
		mountIgniteJsx(
			freshHost,
			jsx(scenario.tag, controlProps(scenario, scenario.toKey, scenario.to)),
		);
		const updated = readControl(host.firstElementChild);
		const fresh = readControl(freshHost.firstElementChild);
		return {
			heldValue: held.value,
			heldChecked: held.checked,
			updatedValue: updated.value,
			freshValue: fresh.value,
			updatedChecked: updated.checked,
			freshChecked: fresh.checked,
			updatedAttrs: updated.attrs,
			freshAttrs: fresh.attrs,
		};
	} finally {
		host.remove();
		freshHost.remove();
	}
}

function radioView(scenario: RadioScenario, dropped: boolean) {
	const first: Record<string, unknown> = {
		type: "radio",
		name: scenario.name,
		defaultChecked: scenario.defaultChecked,
	};
	if (!dropped) first.checked = false;
	const second: Record<string, unknown> = {
		type: "radio",
		name: scenario.name,
		checked: scenario.secondChecked,
	};
	return jsx("div", {
		children: [jsx("input", first, "a"), jsx("input", second, "b")],
	});
}

function radioChecked(root: ParentNode): boolean[] {
	return Array.from(root.querySelectorAll("input")).map(
		(element) => (element as HTMLInputElement).checked,
	);
}

function runRadio(scenario: RadioScenario): RadioReport {
	// Separate forms so the fresh mount is not in the updated radio group.
	const host = document.createElement("form");
	const freshHost = document.createElement("form");
	document.body.append(host, freshHost);
	try {
		const tree = mountIgniteJsx(host, radioView(scenario, false));
		const held = radioChecked(host);
		renderIgniteJsx(host, radioView(scenario, true), tree);
		const updated = radioChecked(host);
		mountIgniteJsx(freshHost, radioView(scenario, true));
		return { held, updated, fresh: radioChecked(freshHost) };
	} finally {
		host.remove();
		freshHost.remove();
	}
}

function eventType(key: string): string {
	return key.slice(2).toLowerCase();
}

function runEvents(sequence: EventSequence): EventReport {
	const host = document.createElement("div");
	document.body.append(host);
	const pool = new Map<number, EventListener>();
	let fired: number[] = [];
	const handler = (id: number): EventListener => {
		const existing = pool.get(id);
		if (existing) return existing;
		const created = () => {
			fired.push(id);
		};
		pool.set(id, created);
		return created;
	};
	const seen: string[] = [];
	try {
		let tree: ReturnType<typeof mountIgniteJsx> | undefined;
		const steps: EventReport["steps"] = [];
		for (let index = 0; index < sequence.steps.length; index++) {
			const props: Record<string, unknown> = {};
			for (const binding of sequence.steps[index].bindings) {
				props[binding.key] = handler(binding.id);
				const name = eventType(binding.key);
				if (!seen.includes(name)) seen.push(name);
			}
			const view = jsx(sequence.tag, props);
			tree =
				index === 0
					? mountIgniteJsx(host, view)
					: renderIgniteJsx(host, view, tree);
			const element = host.firstElementChild;
			if (!element) throw new Error("event mount produced no element");
			const fires: EventReport["steps"][number] = [];
			for (const event of seen) {
				fired = [];
				element.dispatchEvent(new Event(event));
				fires.push({ event, ids: fired.slice() });
			}
			steps.push(fires);
		}
		return { steps };
	} finally {
		host.remove();
	}
}

function runClass(scenario: ClassScenario): ClassReport {
	const host = document.createElement("div");
	document.body.append(host);
	try {
		const tree = mountIgniteJsx(
			host,
			jsx("div", { [scenario.key]: scenario.value }),
		);
		if (scenario.drop) {
			renderIgniteJsx(host, jsx("div", {}), tree);
		}
		const element = host.firstElementChild;
		if (!element) throw new Error("class mount produced no element");
		return {
			classAttr: element.getAttribute("class"),
			names: element.getAttributeNames().sort(),
		};
	} finally {
		host.remove();
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

function contractView(scenario: ContractScenario, step: ContractStep) {
	if (scenario.shape === "form") {
		const props: Record<string, unknown> = {};
		if (step.acceptCharset != null) props.acceptCharset = step.acceptCharset;
		if (step.acceptCharsetAttr != null) {
			props["accept-charset"] = step.acceptCharsetAttr;
		}
		if (step.action != null) props.action = step.action;
		if (step.actionCased != null) props.ACTION = step.actionCased;
		return jsx("form", props);
	}
	if (scenario.shape === "select") {
		const props: Record<string, unknown> = {
			children: step.controls.map((control) => {
				const option: Record<string, unknown> = {
					id: control.id,
					value: control.value ?? control.id,
					children: control.text,
				};
				if (control.defaultSelected != null) {
					option.defaultSelected = control.defaultSelected;
				}
				if (control.selected != null) option.selected = control.selected;
				return jsx("option", option, control.id);
			}),
		};
		if (step.selectValue != null) props.value = step.selectValue;
		return jsx("select", props);
	}
	const type =
		scenario.shape === "text"
			? "text"
			: scenario.shape === "radios"
				? "radio"
				: "checkbox";
	return jsx("form", {
		children: step.controls.map((control) => {
			const props: Record<string, unknown> = { id: control.id, type };
			if (scenario.shape === "radios") props.name = "g";
			if (control.defaultChecked != null) {
				props.defaultChecked = control.defaultChecked;
			}
			if (control.checked != null) props.checked = control.checked;
			if (control.defaultValue != null)
				props.defaultValue = control.defaultValue;
			if (control.value != null) props.value = control.value;
			if (scenario.shape === "live" && step.checkedAttr != null) {
				props.CHECKED = step.checkedAttr;
			}
			return jsx("input", props, control.id);
		}),
	});
}

function contractSnap(
	root: ParentNode,
	shape: ContractScenario["shape"],
): ContractSnap {
	if (shape === "form") {
		const form = root.querySelector("form") as HTMLFormElement | null;
		return {
			checked: [],
			values: form ? [form.action] : [],
			selected: [],
			attrs: form ? attrsOf(form) : [],
		};
	}
	if (shape === "select") {
		const select = root.querySelector("select") as HTMLSelectElement | null;
		const options = select ? Array.from(select.options) : [];
		return {
			checked: [],
			values: select ? [select.value] : [],
			selected: options.map((option) => option.selected),
			attrs: options.flatMap((option) => attrsOf(option)),
		};
	}
	const inputs = Array.from(root.querySelectorAll("input"));
	return {
		checked: inputs.map((input) => (input as HTMLInputElement).checked),
		values: inputs.map((input) => (input as HTMLInputElement).value),
		selected: [],
		attrs: inputs.flatMap((input) => attrsOf(input)),
	};
}

function markComposing(root: ParentNode, on: boolean): void {
	for (const input of root.querySelectorAll("input, textarea")) {
		const field = input as HTMLElement & { isComposing?: boolean };
		field.isComposing = on;
		field.dispatchEvent(new Event(on ? "compositionstart" : "compositionend"));
	}
}

function applyManualControl(
	element: HTMLInputElement,
	control: ContractControl,
	step: ContractStep,
	shape: ContractScenario["shape"],
): void {
	(element as HTMLElement & { isComposing?: boolean }).isComposing =
		step.composing;
	if (control.defaultChecked != null)
		element.defaultChecked = control.defaultChecked;
	if (control.defaultValue != null) element.defaultValue = control.defaultValue;
	if (control.checked != null) element.checked = control.checked;
	if (
		control.value != null &&
		!step.composing &&
		element.value !== control.value
	) {
		element.value = control.value;
	}
	if (shape === "live" && step.checkedAttr === false) {
		element.removeAttribute("checked");
	} else if (shape === "live" && step.checkedAttr === true) {
		element.setAttribute("checked", "");
	}
}

function manualForm(
	scenario: ContractScenario,
	step: ContractStep,
): HTMLFormElement {
	const form = document.createElement("form");
	if (scenario.shape === "select") {
		const select = document.createElement("select");
		form.append(select);
		applyManualSelect(select, step);
		return form;
	}
	if (scenario.shape === "form") return form;
	for (const control of step.controls) {
		const input = document.createElement("input");
		input.id = control.id;
		const inputType =
			scenario.shape === "text"
				? "text"
				: scenario.shape === "radios"
					? "radio"
					: "checkbox";
		if (input.type !== inputType) input.type = inputType;
		if (scenario.shape === "radios") input.name = "g";
		// Props run before the node is appended, matching the first mount.
		applyManualControl(input, control, step, scenario.shape);
		form.append(input);
	}
	return form;
}

function applyManualSelect(
	select: HTMLSelectElement,
	step: ContractStep,
): void {
	const existing = new Map<string, HTMLOptionElement>();
	for (const option of Array.from(select.options))
		existing.set(option.id, option);
	const next: HTMLOptionElement[] = [];
	for (const control of step.controls) {
		let option = existing.get(control.id);
		if (!option) {
			option = document.createElement("option");
			option.id = control.id;
		}
		option.value = control.value ?? control.id;
		option.textContent = control.text;
		if (control.defaultSelected != null) {
			option.defaultSelected = control.defaultSelected;
		}
		if (control.selected != null) option.selected = control.selected;
		next.push(option);
	}
	for (const option of Array.from(select.options)) {
		if (!next.includes(option)) option.remove();
	}
	for (const option of next) select.append(option);
	// Match the renderer: a passed select value is applied after options exist.
	if (step.selectValue != null && select.value !== step.selectValue) {
		select.value = step.selectValue;
	}
}

function applyManual(
	form: HTMLFormElement,
	scenario: ContractScenario,
	step: ContractStep,
): void {
	if (scenario.shape === "form") return;
	if (scenario.shape === "select") {
		const select = form.querySelector("select");
		if (select) applyManualSelect(select, step);
		return;
	}
	const inputs = Array.from(form.querySelectorAll("input"));
	if (scenario.shape === "radios") {
		for (const [index, input] of inputs.entries()) {
			const control = step.controls[index];
			if (control?.defaultChecked != null) {
				input.defaultChecked = control.defaultChecked;
			}
		}
		for (const [index, input] of inputs.entries()) {
			const control = step.controls[index];
			if (!control) continue;
			if (control.defaultValue != null)
				input.defaultValue = control.defaultValue;
			if (
				control.value != null &&
				!step.composing &&
				input.value !== control.value
			) {
				input.value = control.value;
			}
			if (control.checked != null) input.checked = control.checked;
		}
		return;
	}
	step.controls.forEach((control, index) => {
		const input = inputs[index] as HTMLInputElement | undefined;
		if (input) applyManualControl(input, control, step, scenario.shape);
	});
}

function runComposition(
	steps: { value: string; composing: boolean; text: string | null }[],
): string[] {
	const host = document.createElement("div");
	document.body.append(host);
	const values: string[] = [];
	try {
		let tree: ReturnType<typeof mountIgniteJsx> | undefined;
		let input: HTMLInputElement | undefined;
		for (const step of steps) {
			if (input) {
				input.dispatchEvent(
					new Event(step.composing ? "compositionstart" : "compositionend"),
				);
				if (step.composing && step.text != null) input.value = step.text;
			}
			const view = jsx("input", { value: step.value });
			tree = tree
				? renderIgniteJsx(host, view, tree)
				: mountIgniteJsx(host, view);
			input = host.querySelector("input") as HTMLInputElement;
			values.push(input.value);
		}
		return values;
	} finally {
		host.remove();
	}
}

function runContract(scenario: ContractScenario): ContractTrace[] {
	const host = document.createElement("div");
	const manualHost = document.createElement("div");
	document.body.append(host, manualHost);
	const traces: ContractTrace[] = [];
	try {
		let tree: ReturnType<typeof mountIgniteJsx> | undefined;
		let manual: HTMLFormElement | undefined;
		for (const step of scenario.steps) {
			const view = contractView(scenario, step);
			const freshHost = document.createElement("div");
			document.body.append(freshHost);
			mountIgniteJsx(freshHost, view);
			const fresh = contractSnap(freshHost, scenario.shape);
			freshHost.remove();
			if (!tree || !manual) {
				tree = mountIgniteJsx(host, view);
				manual = manualForm(scenario, step);
				manualHost.append(manual);
				const updated = contractSnap(host, scenario.shape);
				traces.push({
					held: updated,
					updated,
					fresh,
					manual:
						scenario.shape === "form"
							? updated
							: contractSnap(manualHost, scenario.shape),
				});
				continue;
			}
			markComposing(host, step.composing);
			markComposing(manual, step.composing);
			const held = contractSnap(host, scenario.shape);
			tree = renderIgniteJsx(host, view, tree);
			applyManual(manual, scenario, step);
			traces.push({
				held,
				updated: contractSnap(host, scenario.shape),
				fresh,
				manual:
					scenario.shape === "form"
						? contractSnap(host, scenario.shape)
						: contractSnap(manualHost, scenario.shape),
			});
		}
		return traces;
	} finally {
		host.remove();
		manualHost.remove();
	}
}

window.__igniteProperties = {
	runReset,
	runSink,
	runAlias,
	runLive,
	runRadio,
	runEvents,
	runClass,
	runContract,
	runComposition,
};

declare global {
	interface Window {
		__igniteProperties: {
			runReset: typeof runReset;
			runSink: typeof runSink;
			runAlias: typeof runAlias;
			runLive: typeof runLive;
			runRadio: typeof runRadio;
			runEvents: typeof runEvents;
			runClass: typeof runClass;
			runContract: typeof runContract;
			runComposition: typeof runComposition;
		};
	}
}
