// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
	type ArtifactView,
	observeWorkbenchDocuments,
} from "./artifact-observer";

const document = (revision = "1", id = "first") => ({
	id,
	revision,
	nodes: [{ kind: "text", id: "summary", text: "Ready" }],
});
const view = (artifacts: unknown): ArtifactView => ({
	modelContext: { artifacts },
	commandAvailability: {},
});
function fixture() {
	let listener: (states: ArtifactView) => void = () => {};
	const unsubscribe = vi.fn();
	const source = {
		watch(handler: typeof listener) {
			listener = handler;
			handler(view([]));
			return { unsubscribe };
		},
	};
	return {
		source,
		unsubscribe,
		emit: (artifacts: unknown) => listener(view(artifacts)),
	};
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("application document observation", () => {
	it("rolls back queued delivery when subscription installation fails", async () => {
		const sink = vi.fn();
		const failure = new Error("subscription failed");
		let late: (state: ArtifactView) => void = () => {};
		expect(() =>
			observeWorkbenchDocuments(
				{
					watch(handler) {
						late = handler;
						handler(view([document()]));
						throw failure;
					},
				},
				sink,
			),
		).toThrow(failure);
		late(view([document("2")]));
		await flush();
		expect(sink).not.toHaveBeenCalled();
	});
	it("reports actionable diagnostics and accepts schema-valid available actions", async () => {
		const f = fixture();
		const sink = vi.fn();
		const errors = vi.fn();
		const observation = observeWorkbenchDocuments(f.source, sink, errors);
		await flush();
		expect(errors).not.toHaveBeenCalled();
		f.emit([{ id: "broken", revision: 1, nodes: "invalid" }]);
		await flush();
		expect(errors.mock.calls[0]?.[0].message).toContain("; ");
		const action = {
			id: "action-panel",
			revision: "1",
			nodes: [
				{
					kind: "action",
					id: "action",
					label: "Complete",
					commandName: "completeResponse",
					payload: { text: "Ready", speech: "Ready" },
				},
			],
		};
		let emit: (state: ArtifactView) => void = () => {};
		const allowed = observeWorkbenchDocuments(
			{
				watch(handler) {
					emit = handler;
					return { unsubscribe() {} };
				},
			},
			sink,
			errors,
		);
		emit({
			...view([action]),
			commandAvailability: { completeResponse: true },
		});
		await flush();
		expect(sink).toHaveBeenCalledExactlyOnceWith(action);
		f.emit([action]);
		await flush();
		expect(errors.mock.calls[1]?.[0].message).toContain(
			'command "completeResponse" is unavailable',
		);
		f.emit([
			{
				...action,
				nodes: [...action.nodes, { ...action.nodes[0], id: "second-action" }],
			},
		]);
		await flush();
		expect(errors.mock.calls[2]?.[0].message).toContain("; ");
		observation.dispose();
		allowed.dispose();
	});
	it("reports default delivery failures and contains reporter failures", async () => {
		const f = fixture();
		const logger = vi.spyOn(console, "error").mockImplementation(() => {});
		const observation = observeWorkbenchDocuments(f.source, () => {
			throw new Error("offline");
		});
		try {
			f.emit([document()]);
			await flush();
			expect(logger).toHaveBeenCalledWith(
				"[voice-workbench] Document delivery failed",
				expect.objectContaining({ message: "offline" }),
			);
		} finally {
			observation.dispose();
			logger.mockRestore();
		}
		const throwing = observeWorkbenchDocuments(
			f.source,
			() => {
				throw new Error("offline");
			},
			() => {
				throw new Error("reporter failed");
			},
		);
		f.emit([document()]);
		await flush();
		throwing.dispose();
	});

	it("coalesces bursts, selects the first document, and deduplicates reentrant delivery", async () => {
		const f = fixture();
		const sink = vi.fn(() => {
			f.emit([document("2"), document("3", "second")]);
		});
		const observation = observeWorkbenchDocuments(f.source, sink);
		f.emit([document()]);
		f.emit([document("2"), document("3", "second")]);
		await flush();
		expect(sink).toHaveBeenCalledExactlyOnceWith(document("2"));
		observation.dispose();
		observation.dispose();
		expect(f.unsubscribe).toHaveBeenCalledOnce();
	});

	it("serializes slow commits, retries failures on a later notification, and cancels queued delivery", async () => {
		const f = fixture();
		let finish: () => void = () => {};
		const sink = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finish = resolve;
					}),
			)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(undefined);
		const errors = vi.fn();
		const observation = observeWorkbenchDocuments(f.source, sink, errors);
		f.emit([document()]);
		await flush();
		f.emit([document()]);
		f.emit([document("2")]);
		await flush();
		expect(sink).toHaveBeenCalledTimes(1);
		finish();
		await flush();
		expect(sink).toHaveBeenCalledTimes(2);
		expect(errors).toHaveBeenCalledOnce();
		f.emit([document("2")]);
		await flush();
		expect(sink).toHaveBeenCalledTimes(3);
		f.emit([document("3")]);
		observation.dispose();
		await flush();
		expect(sink).toHaveBeenCalledTimes(3);
	});

	it("rejects the entire invalid catalog and unavailable actions without invoking accessors", async () => {
		const f = fixture();
		const sink = vi.fn();
		const errors = vi.fn();
		const observation = observeWorkbenchDocuments(f.source, sink, errors);
		const getter = vi.fn();
		f.emit([
			document(),
			Object.defineProperty(document("2", "unsafe"), "nodes", { get: getter }),
		]);
		await flush();
		expect(sink).not.toHaveBeenCalled();
		expect(getter).not.toHaveBeenCalled();
		f.emit([
			{
				id: "first",
				revision: "1",
				nodes: [
					{
						kind: "action",
						id: "action",
						label: "Complete",
						commandName: "completeResponse",
						payload: { text: "Ready", speech: "Ready" },
					},
				],
			},
		]);
		await flush();
		expect(sink).not.toHaveBeenCalled();
		expect(errors).toHaveBeenCalledTimes(2);
		observation.dispose();
	});

	it("delivers each consecutive accepted revision once across notification and disposal traces", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.integer({ min: 1, max: 8 }), {
					minLength: 1,
					maxLength: 30,
				}),
				async (revisions) => {
					const f = fixture();
					const sink = vi.fn();
					const observation = observeWorkbenchDocuments(f.source, sink);
					const expected: string[] = [];
					for (const revision of revisions) {
						const value = String(revision);
						f.emit([document(value)]);
						await flush();
						if (expected[expected.length - 1] !== value) expected.push(value);
					}
					observation.dispose();
					f.emit([document("99")]);
					await flush();
					expect(sink.mock.calls.map(([value]) => value.revision)).toEqual(
						expected,
					);
				},
			),
			{ seed: 1801028, numRuns: 50 },
		);
	});
});
