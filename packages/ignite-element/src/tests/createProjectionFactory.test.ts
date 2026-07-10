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
});
