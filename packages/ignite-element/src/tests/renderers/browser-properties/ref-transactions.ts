import {
	createIgniteJsxRenderStrategy,
	jsx,
	mountIgniteJsxOnce,
} from "@ignite-element/renderer/jsx";
export type TransactionCase = {
	kind:
		| "setter"
		| "connect"
		| "abandon"
		| "nested-failure"
		| "retire"
		| "rebind"
		| "self-retire"
		| "stable-nested"
		| "native-radio";
	value: string;
	connected: boolean;
};
class NestedProbe extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}
	set execute(callback: (node: NestedProbe) => void) {
		callback(this);
	}
	invoke?: (node: NestedProbe) => void;
	connectedCallback() {
		this.invoke?.(this);
	}
}
customElements.define("x-ref-transaction-probe", NestedProbe);
export function transaction(scenario: TransactionCase) {
	const root = document.createElement("div");
	if (scenario.connected || scenario.kind === "connect")
		document.body.append(root);
	const seen: {
		value: string;
		placed: boolean;
		connected: boolean;
		children: number;
	}[] = [];
	const inner: { value: string; placed: boolean }[] = [];
	const abandoned: string[] = [];
	let cleanup = 0;
	let cleanupBeforeDetach = 0;
	const observe = (node: HTMLInputElement | null) => {
		if (node)
			seen.push({
				value: node.value,
				placed: root.contains(node),
				connected: node.isConnected,
				children: root.childElementCount,
			});
	};
	const controlled = () =>
		jsx("input", {
			defaultValue: "before",
			value: scenario.value,
			ref: observe,
		});
	const invalid = () =>
		jsx("section", {
			children: [
				jsx("input", {
					value: "abandoned",
					ref: (node: HTMLInputElement | null) => {
						if (node) abandoned.push(node.value);
					},
				}),
				jsx("bad tag", {}),
			],
		});
	const nested = (node: NestedProbe) => {
		if (scenario.kind === "nested-failure") {
			try {
				mountIgniteJsxOnce(node.shadowRoot!, invalid());
			} catch {}
		} else
			mountIgniteJsxOnce(
				node.shadowRoot!,
				jsx("input", {
					value: "inner",
					ref: (input: HTMLInputElement | null) => {
						if (input)
							inner.push({
								value: input.value,
								placed: node.shadowRoot!.contains(input),
							});
					},
				}),
			);
	};
	try {
		if (scenario.kind === "setter" || scenario.kind === "nested-failure") {
			mountIgniteJsxOnce(
				root,
				jsx("section", {
					children: [
						controlled(),
						jsx("x-ref-transaction-probe", { execute: nested }),
						jsx("span", { children: "tail" }),
					],
				}),
			);
		} else if (scenario.kind === "connect") {
			mountIgniteJsxOnce(root, [
				controlled(),
				jsx("x-ref-transaction-probe", { invoke: nested }),
				jsx("span", { children: "tail" }),
			]);
		} else if (scenario.kind === "abandon") {
			try {
				mountIgniteJsxOnce(root, invalid());
			} catch {}
		} else if (scenario.kind === "native-radio") {
			const input = document.createElement("input");
			input.type = "radio";
			root.append(input);
			input.value = scenario.value;
			input.defaultChecked = true;
			input.checked = false;
			return {
				seen,
				inner,
				beforeUnrelated: 0,
				afterUnrelated: 0,
				cleanup: 0,
				cleanupBeforeDetach: 0,
				finalChildren: root.childElementCount,
				native: {
					value: input.value,
					defaultValue: input.defaultValue,
					valueAttribute: input.getAttribute("value"),
					checked: input.checked,
					defaultChecked: input.defaultChecked,
					checkedAttribute: input.getAttribute("checked"),
				},
			};
		} else {
			const shadow = root.attachShadow({ mode: "open" });
			const strategy = createIgniteJsxRenderStrategy();
			strategy.attach(shadow);
			const incoming = (node: HTMLInputElement | null) => {
				if (node)
					seen.push({
						value: node.value,
						placed: shadow.contains(node),
						connected: node.isConnected,
						children: shadow.childElementCount,
					});
			};
			if (scenario.kind === "stable-nested") {
				let nested = false;
				const ref = (node: Element | null) => {
					if (!node) return;
					if (!nested) {
						nested = true;
						strategy.render(jsx("input", { ref }));
					}
					return () => {
						cleanup++;
					};
				};
				strategy.render(jsx("input", {}));
				strategy.render(jsx("input", { ref }));
			} else if (scenario.kind === "self-retire") {
				strategy.render(
					jsx("input", {
						ref: (node: HTMLInputElement | null) => {
							if (!node) return;
							strategy.render(null);
							return () => {
								cleanup++;
							};
						},
					}),
				);
			} else {
				strategy.render(
					jsx("input", {
						ref: (node: Element | null) =>
							node
								? () => {
										if (scenario.kind === "rebind")
											strategy.render(
												jsx("input", {
													value: "rebound",
													ref: (input: HTMLInputElement | null) => {
														if (input)
															inner.push({
																value: input.value,
																placed: shadow.contains(input),
															});
													},
												}),
											);
										else strategy.render(null);
									}
								: undefined,
					}),
				);
				strategy.render(jsx("input", { value: scenario.value, ref: incoming }));
			}
			cleanupBeforeDetach = cleanup;
			strategy.detach();
		}
		const beforeUnrelated = abandoned.length;
		const unrelated = document.createElement("div");
		document.body.append(unrelated);
		mountIgniteJsxOnce(unrelated, jsx("p", { children: "unrelated" }));
		unrelated.remove();
		return {
			seen,
			inner,
			beforeUnrelated,
			afterUnrelated: abandoned.length,
			cleanup,
			cleanupBeforeDetach,
			finalChildren: root.childElementCount,
			native: undefined,
		};
	} finally {
		root.remove();
	}
}
window.__refTransactions = transaction;
declare global {
	interface Window {
		__refTransactions: typeof transaction;
	}
}

export type SelectCase = {
	mode: "option" | "live" | "insert";
	value: string;
	multiple: boolean;
	connected: boolean;
};
export function selectTransaction(scenario: SelectCase) {
	const host = document.createElement("div");
	const nativeForm = document.createElement("form");
	if (scenario.connected) document.body.append(host, nativeForm);
	const root = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(root);
	const native = document.createElement("select");
	native.name = "choice";
	native.multiple = scenario.multiple;
	nativeForm.append(native);
	const extraValue = `_extra_${scenario.value}`;
	const extra = document.createElement("option");
	extra.value = extraValue;
	extra.textContent = "extra";
	const wanted = document.createElement("option");
	wanted.value = scenario.value;
	wanted.textContent = "wanted";
	if (scenario.mode !== "insert") native.append(wanted);
	native.append(extra);
	const read = (select: HTMLSelectElement, form: HTMLFormElement) => ({
		value: select.value,
		options: Array.from(select.options, (option) => option.value),
		selected: Array.from(select.options, (option) => option.selected),
		submitted: new FormData(form).getAll("choice").map(String),
	});
	const observations: {
		state: ReturnType<typeof read>;
		placed: boolean;
		connected: boolean;
	}[] = [];
	const actual: ReturnType<typeof read>[] = [];
	const expected: ReturnType<typeof read>[] = [];
	const view = (showWanted: boolean, controlled: boolean) =>
		jsx("form", {
			children: jsx("select", {
				name: "choice",
				multiple: scenario.multiple,
				...(controlled ? { value: scenario.value } : {}),
				ref: (node: HTMLSelectElement | null) => {
					if (node)
						observations.push({
							state: read(node, node.form!),
							placed: root.contains(node),
							connected: node.isConnected,
						});
				},
				children: [
					...(showWanted
						? [
								jsx(
									"option",
									{ value: scenario.value, children: "wanted" },
									"wanted",
								),
							]
						: []),
					jsx(
						"option",
						{
							value: extraValue,
							children: "extra",
							...(scenario.mode === "option" ? { selected: true } : {}),
						},
						"extra",
					),
				],
			}),
		});
	const render = (showWanted: boolean, controlled: boolean) => {
		// Independent native operations: child selected writes, then the parent setter.
		if (scenario.mode === "option") extra.selected = true;
		if (controlled) native.value = scenario.value;
		expected.push(read(native, nativeForm));
		strategy.render(view(showWanted, controlled));
		actual.push(
			read(root.querySelector("select")!, root.querySelector("form")!),
		);
	};
	try {
		render(scenario.mode !== "insert", true);
		if (scenario.mode === "insert") native.insertBefore(wanted, extra);
		if (scenario.mode === "live") {
			root.querySelector("select")!.options[1].selected = true;
			extra.selected = true;
		}
		render(true, true);
		// Repeated getter-equal render must remove an extra live selection as well.
		root.querySelector("select")!.options[1].selected = true;
		extra.selected = true;
		render(true, true);
		root.querySelector("select")!.options[1].selected = true;
		extra.selected = true;
		render(true, false);
		return { actual, expected, observations };
	} finally {
		strategy.detach();
		host.remove();
		nativeForm.remove();
	}
}
window.__selectTransaction = selectTransaction;
declare global {
	interface Window {
		__selectTransaction: typeof selectTransaction;
	}
}
