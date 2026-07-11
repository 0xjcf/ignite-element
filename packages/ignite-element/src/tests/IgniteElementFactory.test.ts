import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StateScope } from "../IgniteAdapter";
import igniteElementFactory from "../IgniteElementFactory";
import {
	igniteDomBridgeSymbol,
	type IgniteRuntimeHostOverride,
	igniteRuntimeHostOverrideSymbol,
} from "../runtime/agent";
import { facadeCleanupSymbol } from "../runtime/effects";
import MinimalMockAdapter from "./MockAdapter";

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("igniteElementFactory", () => {
	const initialState = { count: 0 };

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("creates a component that subscribes to the adapter", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const createAdapter = vi.fn(() => adapter);

		const component = igniteElementFactory(createAdapter);
		const elementName = `ignite-component-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapter.subscribeSnapshots).toHaveBeenCalled();
	});

	it("creates a new adapter instance per component when factory returns fresh adapters", () => {
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const instance = new MinimalMockAdapter<
				typeof initialState,
				{ type: string }
			>(initialState);
			adapters.push(instance);
			return instance;
		});

		const component = igniteElementFactory(createAdapter);
		const elementName = `ignite-component-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(createAdapter).toHaveBeenCalledTimes(2);
		adapters.forEach((instance) => {
			expect(instance.scope).toBe(StateScope.Isolated);
		});
	});

	it("reuses adapter and marks scope as shared", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const createAdapter = vi.fn(() => adapter);

		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
		});
		const elementName = `ignite-shared-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapter.scope).toBe(StateScope.Shared);
	});

	it("returns when attempting to define an element more than once", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-duplicate-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		expect(() => component(elementName, () => html`<div></div>`)).not.toThrow();
	});

	it("supports class-based renderers", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-class-${crypto.randomUUID()}`;

		class ClassRenderer {
			render() {
				return html`<span>class renderer</span>`;
			}
		}

		const renderSpy = vi.spyOn(ClassRenderer.prototype, "render");

		component(elementName, ClassRenderer);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(renderSpy).toHaveBeenCalled();
	});

	it("creates a class renderer instance for each isolated element", () => {
		const component = igniteElementFactory(
			() => new MinimalMockAdapter(initialState),
		);
		const elementName = `ignite-class-isolated-${crypto.randomUUID()}`;
		let created = 0;

		class ClassRenderer {
			readonly instanceId = ++created;

			render() {
				return html`<span>renderer ${this.instanceId}</span>`;
			}
		}

		component(elementName, ClassRenderer);
		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(created).toBe(2);
	});

	it("supports object renderers", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-object-${crypto.randomUUID()}`;

		const renderObject = {
			template: html`<span>object renderer</span>`,
			render() {
				return this.template;
			},
		};
		const renderSpy = vi.spyOn(renderObject, "render");

		component(elementName, renderObject);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(renderSpy).toHaveBeenCalled();
	});

	it("throws when renderer does not provide a render implementation", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
		});
		const elementName = `ignite-invalid-${crypto.randomUUID()}`;

		expect(() => component(elementName, 123 as unknown as never)).toThrow(
			"[igniteElementFactory] Invalid renderer provided. Supply a render function, an object with a render method, or a class with a render method.",
		);
	});

	it("keeps the shared (consumer-owned) adapter alive when the last element disconnects (default cleanup)", () => {
		// Repro for the SPA-router outlet-swap footgun: one core registered under
		// multiple element names shares ONE adapter. Swapping pages drives the
		// refcount transiently to zero, which previously stopped the shared adapter
		// and froze every page's reads. A consumer-owned shared source lives for the
		// core's lifetime, not any one element's — disconnecting must not stop it.
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const createAdapter = vi.fn(() => adapter);

		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
		});
		const pageA = `ignite-shared-page-a-${crypto.randomUUID()}`;
		const pageB = `ignite-shared-page-b-${crypto.randomUUID()}`;
		component(pageA, () => html`<div></div>`);
		component(pageB, () => html`<div></div>`);

		const a = document.createElement(pageA);
		const b = document.createElement(pageB);
		document.body.append(a, b);
		a.remove();
		b.remove();

		expect(adapter.stop).not.toHaveBeenCalled();
	});

	it("still releases the shared adapter on last disconnect when cleanup:true is explicit", async () => {
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);

		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
		});
		const name = `ignite-shared-cleanup-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});

	it("restores shared runtime state after host overrides so cleanup:true can release", async () => {
		const runCase = async (
			runOverride: (
				override: IgniteRuntimeHostOverride,
			) => Promise<void> | void,
		) => {
			const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
			const component = igniteElementFactory(() => adapter, {
				scope: StateScope.Shared,
				cleanup: true,
			});
			const name = `ignite-shared-runtime-restore-${crypto.randomUUID()}`;
			component(name, () => html`<div></div>`);

			const override = (
				component as typeof component & {
					[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
				}
			)[igniteRuntimeHostOverrideSymbol];
			await runOverride(override);

			const element = document.createElement(name);
			document.body.appendChild(element);
			element.remove();
			await flushMicrotasks();

			expect(adapter.stop).toHaveBeenCalledTimes(1);
		};

		await runCase((override) => {
			override(document.createElement("section"), () => undefined);
		});
		await runCase(async (override) => {
			await override(document.createElement("section"), async () => undefined);
		});
		await runCase((override) => {
			expect(() =>
				override(document.createElement("section"), () => {
					throw new Error("host override failed");
				}),
			).toThrow("host override failed");
		});
	});

	it("does not restore host override resources created during override as the runtime base", async () => {
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const reportedAdapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
			adapters.push(adapter);
			return adapter;
		});
		const cleanupAdditionalArgs = vi.fn();
		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: (adapter) =>
				({
					reportAdapter: () => {
						reportedAdapters.push(
							adapter as MinimalMockAdapter<
								typeof initialState,
								{ type: string }
							>,
						);
					},
					[facadeCleanupSymbol]: cleanupAdditionalArgs,
				}) as never,
		});
		const name = `ignite-runtime-override-base-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const runtime = component as typeof component & {
			execute: (call: { command: string; input?: unknown }) => Promise<unknown>;
		};
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];

		await override(document.createElement("section"), () =>
			runtime.execute({ command: "reportAdapter" }),
		);
		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();
		await runtime.execute({ command: "reportAdapter" });

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(reportedAdapters).toEqual([adapters[0], adapters[1]]);
	});

	it("releases shared cleanup after direct runtime access and last disconnect", async () => {
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const reportedAdapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
			adapters.push(adapter);
			return adapter;
		});
		const cleanupAdditionalArgs = vi.fn();
		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: (adapter) =>
				({
					reportAdapter: () => {
						reportedAdapters.push(
							adapter as MinimalMockAdapter<
								typeof initialState,
								{ type: string }
							>,
						);
					},
					[facadeCleanupSymbol]: cleanupAdditionalArgs,
				}) as never,
		});
		const name = `ignite-direct-runtime-cleanup-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const runtime = component as typeof component & {
			execute: (call: { command: string; input?: unknown }) => Promise<unknown>;
			getSnapshot: () => typeof initialState;
		};

		expect(runtime.getSnapshot()).toEqual(initialState);
		await runtime.execute({ command: "reportAdapter" });

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(cleanupAdditionalArgs).toHaveBeenCalledTimes(2);

		await runtime.execute({ command: "reportAdapter" });

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(reportedAdapters).toHaveLength(2);
		expect(reportedAdapters[0]).toBe(adapters[0]);
		expect(reportedAdapters[1]).toBe(adapters[1]);
	});

	it("resets shared runtime bookkeeping when runtime facade cleanup throws", async () => {
		const cleanupError = new Error("runtime facade cleanup failed");
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const reportedAdapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
			adapters.push(adapter);
			return adapter;
		});
		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: (adapter) =>
				({
					reportAdapter: () => {
						reportedAdapters.push(
							adapter as MinimalMockAdapter<
								typeof initialState,
								{ type: string }
							>,
						);
					},
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-direct-runtime-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const runtime = component as typeof component & {
			execute: (call: { command: string; input?: unknown }) => Promise<unknown>;
		};
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await runtime.execute({ command: "reportAdapter" });
		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			cleanupError,
		);

		await runtime.execute({ command: "reportAdapter" });

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(reportedAdapters).toHaveLength(2);
		expect(reportedAdapters[0]).toBe(adapters[0]);
		expect(reportedAdapters[1]).toBe(adapters[1]);
	});

	it("logs deferred shared cleanup failures when bridge stop releases runtime access", async () => {
		const cleanupError = new Error("bridge runtime cleanup failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-bridge-deferred-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const bridge = (
			component as typeof component & {
				[igniteDomBridgeSymbol]: (renderer: () => unknown) => {
					stop: () => void;
				};
			}
		)[igniteDomBridgeSymbol](() => html`<span>bridge</span>`);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(() => bridge.stop()).not.toThrow();
		expect(adapter.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			cleanupError,
		);
	});

	it("restores host override state when additional args cleanup fails", async () => {
		const cleanupError = new Error("runtime args cleanup failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-shared-runtime-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(override(document.createElement("section"), () => undefined)).toBe(
			undefined,
		);

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(adapter.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[igniteElementFactory] Runtime host restore failed after callback completion.",
			cleanupError,
		);
	});

	it("rolls back host override state when additional args setup fails", async () => {
		const setupError = new Error("runtime args setup failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const overrideHost = document.createElement("section");
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: (_adapter, host) => {
				if (host === overrideHost) {
					throw setupError;
				}
				return {} as never;
			},
		});
		const name = `ignite-shared-runtime-setup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];

		expect(() => override(overrideHost, () => undefined)).toThrow(setupError);

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});

	it("preserves host override callback errors when restore cleanup fails", () => {
		const cleanupError = new Error("runtime args cleanup failed");
		const callbackError = new Error("host override failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-shared-runtime-callback-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(() =>
			override(document.createElement("section"), () => {
				throw callbackError;
			}),
		).toThrow(callbackError);
		expect(errorSpy).toHaveBeenCalledWith(
			"[igniteElementFactory] Runtime host restore failed after callback error.",
			cleanupError,
		);
	});

	it("preserves host override callback results when restore cleanup fails", () => {
		const cleanupError = new Error("runtime args cleanup failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-shared-runtime-callback-result-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(override(document.createElement("section"), () => "ok")).toBe("ok");
		expect(errorSpy).toHaveBeenCalledWith(
			"[igniteElementFactory] Runtime host restore failed after callback completion.",
			cleanupError,
		);
	});

	it("preserves async host override callback errors when restore cleanup fails", async () => {
		const cleanupError = new Error("runtime args cleanup failed");
		const callbackError = new Error("async host override failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-shared-runtime-async-callback-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			override(document.createElement("section"), () =>
				Promise.reject(callbackError),
			),
		).rejects.toThrow(callbackError);
		expect(errorSpy).toHaveBeenCalledWith(
			"[igniteElementFactory] Runtime host restore failed after callback error.",
			cleanupError,
		);
	});

	it("preserves async host override callback results when restore cleanup fails", async () => {
		const cleanupError = new Error("runtime args cleanup failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-shared-runtime-async-callback-result-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const override = (
			component as typeof component & {
				[igniteRuntimeHostOverrideSymbol]: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			override(document.createElement("section"), () => Promise.resolve("ok")),
		).resolves.toBe("ok");
		expect(errorSpy).toHaveBeenCalledWith(
			"[igniteElementFactory] Runtime host restore failed after callback resolution.",
			cleanupError,
		);
	});

	it("clears isolated adapter bookkeeping before additional args cleanup can fail", async () => {
		const cleanupError = new Error("isolated args cleanup failed");
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState);
			adapters.push(adapter);
			return adapter;
		});
		const component = igniteElementFactory(createAdapter, {
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-isolated-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();
		document.body.appendChild(element);

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			cleanupError,
		);

		element.remove();
		await flushMicrotasks();
	});

	it("stops an isolated adapter when true disconnect cleanup throws", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-disconnect-error-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);
		const elementConstructor = customElements.get(elementName) as
			| (CustomElementConstructor & {
					prototype: { onTrueDisconnect: () => void };
			  })
			| undefined;
		if (!elementConstructor) {
			throw new Error(`Expected ${elementName} to be registered.`);
		}
		const disconnectError = new Error("cleanup failed");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const onTrueDisconnect = vi
			.spyOn(elementConstructor.prototype, "onTrueDisconnect")
			.mockImplementation(() => {
				throw disconnectError;
			});

		const element = document.createElement(elementName);
		document.body.appendChild(element);
		const queuedMicrotasks: VoidFunction[] = [];
		vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
			queuedMicrotasks.push(callback);
		});

		element.remove();

		expect(queuedMicrotasks).toHaveLength(1);
		expect(() => queuedMicrotasks[0]?.()).not.toThrow();
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			disconnectError,
		);
		expect(onTrueDisconnect).toHaveBeenCalledTimes(1);
		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});
});
