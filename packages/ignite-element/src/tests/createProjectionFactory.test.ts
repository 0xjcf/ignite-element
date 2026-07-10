import { describe, expect, it, vi } from "vitest";
import { StateScope } from "../IgniteAdapter";
import { createProjectionFactory } from "../createProjectionFactory";

describe("createProjectionFactory", () => {
	it("captures snapshot and view from one coherent source read", () => {
		let revision = 0;
		const adapter = {
			scope: StateScope.Isolated,
			subscribeSnapshots: vi.fn(() => ({ unsubscribe: () => undefined })),
			send: vi.fn(),
			getSnapshot: vi.fn(() => {
				revision += 1;
				return { revision };
			}),
			stop: vi.fn(),
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
		});
		const projection = createProjectionFactory(createAdapter, {
			view: ({ snapshot }: { snapshot: { revision: number } }) => ({
				revision: snapshot.revision,
			}),
		});

		const inspection = projection.resolveInspection(adapter);

		expect(inspection.snapshot).toEqual({ revision: 1 });
		expect(inspection.view).toEqual({ revision: 1 });
		expect(adapter.getSnapshot).toHaveBeenCalledTimes(1);
	});

	it("uses the adapter state and standard command actor by default", () => {
		type CounterState = { count: number };
		type CounterEvent = { type: "INCREMENT" };
		const adapter = {
			scope: StateScope.Isolated,
			subscribeSnapshots: vi.fn(() => ({ unsubscribe: () => undefined })),
			send: vi.fn<(event: CounterEvent) => void>(),
			getSnapshot: vi.fn((): CounterState => ({ count: 2 })),
			stop: vi.fn(),
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
		});
		const projection = createProjectionFactory(createAdapter, {
			view: ({ snapshot }) => ({ count: snapshot.count }),
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INCREMENT" }),
				readCount: () => actor.getState().count,
			}),
		});

		const inspection = projection.resolveInspection(adapter);
		const args = projection.createAdditionalArgs(
			adapter,
			new EventTarget(),
			() => undefined,
		);

		expect(inspection).toEqual({ snapshot: { count: 2 }, view: { count: 2 } });
		expect(args.readCount()).toBe(2);
		args.increment();
		expect(adapter.send).toHaveBeenCalledWith({ type: "INCREMENT" });
	});

	it("uses explicit custom snapshot and actor resolvers", () => {
		type State = { count: number };
		type Event = { type: "NOOP" };
		type Snapshot = { label: string };
		type Actor = { record(label: string): void };
		const adapter = {
			scope: StateScope.Isolated,
			subscribeSnapshots: vi.fn(() => ({ unsubscribe: () => undefined })),
			send: vi.fn<(event: Event) => void>(),
			getSnapshot: vi.fn((): State => ({ count: 3 })),
			stop: vi.fn(),
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
		});
		const record = vi.fn<(label: string) => void>();
		const actor: Actor = { record };
		const projection = createProjectionFactory<
			State,
			Event,
			Snapshot,
			{ label: string },
			Actor,
			{ record: () => void }
		>(createAdapter, {
			resolveStateSnapshot: () => ({ label: "custom" }),
			resolveCommandActor: () => actor,
			view: ({ snapshot }) => ({ label: snapshot.label }),
			commands: ({ actor: resolvedActor }) => ({
				record: () => resolvedActor.record("explicit"),
			}),
		});

		const inspection = projection.resolveInspection(adapter);
		const args = projection.createAdditionalArgs(
			adapter,
			new EventTarget(),
			() => undefined,
		);

		expect(inspection).toEqual({
			snapshot: { label: "custom" },
			view: { label: "custom" },
		});
		args.record();
		expect(record).toHaveBeenCalledWith("explicit");
	});

	it("uses snapshot and actor resolver metadata from the adapter factory", () => {
		type State = { count: number };
		type Event = { type: "NOOP" };
		const adapter = {
			scope: StateScope.Isolated,
			subscribeSnapshots: vi.fn(() => ({ unsubscribe: () => undefined })),
			send: vi.fn<(event: Event) => void>(),
			getSnapshot: vi.fn((): State => ({ count: 4 })),
			stop: vi.fn(),
		};
		const record = vi.fn<(value: number) => void>();
		const metadataActor = { record };
		const resolveStateSnapshot = vi.fn(() => ({ label: "metadata" }));
		const resolveCommandActor = vi.fn(() => metadataActor);
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot,
			resolveCommandActor,
		});
		const projection = createProjectionFactory(createAdapter, {
			view: ({ snapshot }) => ({ label: snapshot.label }),
			commands: ({ actor }) => ({
				record: () => actor.record(4),
			}),
		});

		const inspection = projection.resolveInspection(adapter);
		const args = projection.createAdditionalArgs(
			adapter,
			new EventTarget(),
			() => undefined,
		);

		expect(inspection.view).toEqual({ label: "metadata" });
		expect(resolveStateSnapshot).toHaveBeenCalledWith(adapter);
		expect(resolveCommandActor).toHaveBeenCalledWith(adapter);
		args.record();
		expect(record).toHaveBeenCalledWith(4);
	});

	it("requires resolvers for explicitly requested custom generic types", () => {
		type State = { count: number };
		type Event = { type: "NOOP" };
		type Snapshot = { label: string };
		type StandardActor = {
			send(event: Event): void;
			getState(): State;
		};
		type CustomActor = { record(): void };
		const adapter = {
			subscribeSnapshots: vi.fn(() => ({ unsubscribe: () => undefined })),
			send: vi.fn<(event: Event) => void>(),
			getSnapshot: vi.fn((): State => ({ count: 1 })),
			stop: vi.fn(),
		};
		const createAdapter = () => adapter;
		const assertResolverRequirements = () => {
			// @ts-expect-error custom snapshots require a typed resolver
			createProjectionFactory<
				State,
				Event,
				Snapshot,
				Record<never, never>,
				StandardActor
			>(createAdapter, {});
			// @ts-expect-error custom command actors require a typed resolver
			createProjectionFactory<
				State,
				Event,
				State,
				Record<never, never>,
				CustomActor
			>(createAdapter, {});
		};

		void assertResolverRequirements;
	});
});
