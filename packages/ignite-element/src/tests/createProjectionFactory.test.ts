import { describe, expect, it, vi } from "vitest";
import { createProjectionFactory } from "../createProjectionFactory";
import { StateScope } from "../IgniteAdapter";

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
			resolveStateSnapshot: () => adapter.getSnapshot(),
			resolveCommandActor: () => ({
				send: adapter.send,
				getState: () => adapter.getSnapshot(),
			}),
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

	it("prefers explicit resolvers over matching factory metadata", () => {
		type State = { value: number };
		type Event = { type: "noop" };
		type Snapshot = { label: string };
		type CommandActor = { publish: () => void };
		const adapter = {
			scope: StateScope.Isolated,
			subscribeSnapshots: vi.fn(() => ({ unsubscribe: () => undefined })),
			send: vi.fn<(event: Event) => void>(),
			getSnapshot: vi.fn((): State => ({ value: 1 })),
			stop: vi.fn(),
		};
		const metadataActor: CommandActor = { publish: vi.fn() };
		const overrideActor: CommandActor = { publish: vi.fn() };
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot: (): Snapshot => ({ label: "metadata" }),
			resolveCommandActor: (): CommandActor => metadataActor,
		});
		const projection = createProjectionFactory(createAdapter, {
			resolveStateSnapshot: (): Snapshot => ({ label: "override" }),
			resolveCommandActor: (): CommandActor => overrideActor,
			view: ({ snapshot }) => ({ label: snapshot.label }),
			commands: ({ actor }) => ({ publish: () => actor.publish() }),
		});

		expect(projection.resolveInspection(adapter)).toEqual({
			snapshot: { label: "override" },
			view: { label: "override" },
		});
		const args = projection.createAdditionalArgs(adapter, {}, () => true);
		args.publish();
		expect(overrideActor.publish).toHaveBeenCalledOnce();
		expect(metadataActor.publish).not.toHaveBeenCalled();
	});
});
