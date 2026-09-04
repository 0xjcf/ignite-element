import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StateScope } from "../IgniteAdapter";
import igniteElementFactory from "../IgniteElementFactory";
import MinimalMockAdapter from "./MockAdapter";

describe("attribute observation", () => {
	const initialState = { repo: null, env: "PRD" };

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	function createSetup(scope = StateScope.Isolated) {
		const adapter = new MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>(initialState, scope);
		const setRepoCalls: (string | null)[] = [];
		const setEnvCalls: (string | null)[] = [];
		const reloadCalls: unknown[] = [];
		const highlightPathsCalls: unknown[] = [];

		// Functions must have correct .length for attribute inference
		const setRepo = (repo: string | null) => {
			setRepoCalls.push(repo);
		};
		const setEnv = (env: string | null) => {
			setEnvCalls.push(env);
		};
		const reload = () => {
			reloadCalls.push(undefined);
		};
		const highlightPaths = (paths: string[], severity: string) => {
			highlightPathsCalls.push({ paths, severity });
		};

		const createAdapter = vi.fn(() => adapter);
		const component = igniteElementFactory(createAdapter, {
			scope,
			createAdditionalArgs: () => ({
				setRepo,
				setEnv,
				reload,
				highlightPaths,
			}),
		});

		return {
			adapter,
			component,
			setRepoCalls,
			setEnvCalls,
			reloadCalls,
			highlightPathsCalls,
		};
	}

	it("calls setRepo when repo attribute is set after connection", async () => {
		const { component, setRepoCalls } = createSetup();
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		document.body.appendChild(el);

		el.setAttribute("repo", "my-service");
		// MutationObserver is async — flush microtasks
		await new Promise((r) => setTimeout(r, 0));
		expect(setRepoCalls).toContain("my-service");
	});

	it("calls setEnv when env attribute changes", async () => {
		const { component, setEnvCalls } = createSetup();
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		document.body.appendChild(el);

		el.setAttribute("env", "STG");
		await new Promise((r) => setTimeout(r, 0));
		expect(setEnvCalls).toContain("STG");
	});

	it("processes initial attributes set before element is connected", () => {
		const { component, setRepoCalls } = createSetup();
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		el.setAttribute("repo", "pre-upgrade-repo");
		document.body.appendChild(el);

		// processInitialAttributes runs synchronously in connectedCallback
		expect(setRepoCalls).toContain("pre-upgrade-repo");
	});

	it("calls command with null when attribute is removed", async () => {
		const { component, setRepoCalls } = createSetup();
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		document.body.appendChild(el);

		el.setAttribute("repo", "my-service");
		await new Promise((r) => setTimeout(r, 0));

		el.removeAttribute("repo");
		await new Promise((r) => setTimeout(r, 0));
		expect(setRepoCalls).toContain(null);
	});

	it("works with shared scope", () => {
		const { component, setRepoCalls } = createSetup(StateScope.Shared);
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		el.setAttribute("repo", "shared-repo");
		document.body.appendChild(el);

		// processInitialAttributes runs synchronously in connectedCallback
		expect(setRepoCalls).toContain("shared-repo");
	});

	it("does not call reload (zero-arg command) via attributes", async () => {
		const { component, reloadCalls } = createSetup();
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		document.body.appendChild(el);

		el.setAttribute("reload", "true");
		await new Promise((r) => setTimeout(r, 0));
		expect(reloadCalls).toHaveLength(0);
	});

	it("does not call highlightPaths (multi-arg command) via attributes", async () => {
		const { component, highlightPathsCalls } = createSetup();
		const elementName = `attr-test-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);

		const el = document.createElement(elementName);
		document.body.appendChild(el);

		el.setAttribute("highlightPaths", "[]");
		await new Promise((r) => setTimeout(r, 0));
		expect(highlightPathsCalls).toHaveLength(0);
	});
});
