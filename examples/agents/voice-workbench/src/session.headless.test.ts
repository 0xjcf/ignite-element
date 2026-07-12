import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it, vi } from "vitest";

const loadSession = async () => {
	const session = await import("./session").catch(() => null);
	expect(
		session,
		"the headless conversation session has not been implemented",
	).not.toBeNull();
	return session as NonNullable<typeof session>;
};

const artifact = {
	id: "decision",
	title: "Decision",
	kind: "decision-log" as const,
	nodes: [
		{
			type: "decision-log" as const,
			entries: [{ decision: "Use Ignite", rationale: "One behavior model" }],
		},
	],
};

describe("voice workbench headless runtime", () => {
	it("discovers only intent commands through the compiled JSON-safe schema", async () => {
		const { createConversationSession } = await loadSession();
		const { runtime, close } = createConversationSession("session-1");
		const schema = runtime.getSchema();

		expect(Object.keys(schema.commands)).toEqual([
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
		]);
		expect(() => JSON.stringify(schema)).not.toThrow();
		expect(runtime.canExecute("createArtifact")).toBe(true);
		expect(runtime.canExecute("reviseArtifact")).toBe(false);
		close();
	});

	it("drives creation, revision conflict, revision, and completion with igniteTest", async () => {
		const { createConversationSession } = await loadSession();
		const { runtime, close } = createConversationSession("session-1");

		(
			await igniteTest(runtime).when({
				command: "createArtifact",
				input: artifact,
			})
		)
			.expectEvent({
				type: "artifact-created",
				artifactId: "decision",
				revision: 1,
			})
			.expectView({ artifactCount: 1, activeArtifactId: "decision" });

		(
			await igniteTest(runtime).when({
				command: "reviseArtifact",
				input: {
					artifactId: "decision",
					expectedRevision: 9,
					nodes: artifact.nodes,
				},
			})
		)
			.expectEvent({ type: "artifact-rejected", reason: "conflict" })
			.expectView({ artifacts: [{ revision: 1 }] });

		(
			await igniteTest(runtime).when({
				command: "reviseArtifact",
				input: {
					artifactId: "decision",
					expectedRevision: 1,
					nodes: artifact.nodes,
				},
			})
		).expectEvent({
			type: "artifact-revised",
			artifactId: "decision",
			revision: 2,
		});

		(
			await igniteTest(runtime).when({
				command: "completeResponse",
				input: { text: "Decision captured.", speech: "Decision captured." },
			})
		)
			.expectEvent({ type: "response-completed" })
			.expectSnapshot((snapshot) => snapshot.context.status === "completed")
			.expectView({
				response: { text: "Decision captured." },
				canRevise: false,
			});
		close();
	});

	it("publishes coherent live facts through subscriptions", async () => {
		const { createConversationSession } = await loadSession();
		const { runtime, close } = createConversationSession("session-1");
		const snapshots = vi.fn();
		const views = vi.fn();
		const snapshotSubscription = runtime.watchSnapshot(snapshots);
		const viewSubscription = runtime.watchView(views);

		await igniteTest(runtime).when({
			command: "createArtifact",
			input: artifact,
		});

		expect(snapshots).toHaveBeenCalledTimes(1);
		expect(views).toHaveBeenCalledTimes(1);
		expect(runtime.getSnapshot().context.revision).toBe(
			runtime.getView().revision,
		);
		snapshotSubscription.unsubscribe();
		viewSubscription.unsubscribe();
		close();
	});
});
