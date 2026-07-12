import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it, vi } from "vitest";
import type { VoiceWorkbenchComponent as Component } from "./session";

type SessionModule = {
	component: Component;
	source: { stop(): void };
};

const loadWorkbench = async (): Promise<SessionModule> => {
	vi.resetModules();
	const module = (await import("./session")) as Record<string, unknown>;
	expect(
		typeof module.component,
		"session module must export component = igniteCore({ source, ... })",
	).toBe("function");
	expect(typeof (module.source as { stop?: unknown } | undefined)?.stop).toBe(
		"function",
	);
	return module as SessionModule;
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

describe("voice workbench headless component", () => {
	it("exports one literal component with phase-gated commands", async () => {
		const { component, source } = await loadWorkbench();
		const schema = component.getSchema();

		expect(Object.keys(schema.commands)).toEqual([
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
			"submitPrompt",
		]);
		expect(() => JSON.stringify(schema)).not.toThrow();
		expect(component.getView().status).toBe("ready");
		expect(component.canExecute("submitPrompt")).toBe(true);
		expect(component.canExecute("createArtifact")).toBe(false);
		expect(component.canExecute("reviseArtifact")).toBe(false);
		expect(component.canExecute("completeResponse")).toBe(false);
		source.stop();
	});

	it("drives a continuing session through canonical Ignite commands", async () => {
		const { component, source } = await loadWorkbench();

		(
			await igniteTest(component).when({
				command: "submitPrompt",
				input: { modality: "text", text: "Capture a decision" },
			})
		).expectView({ messageCount: 1, status: "responding" });
		expect(component.canExecute("submitPrompt")).toBe(false);
		expect(component.canExecute("createArtifact")).toBe(true);
		expect(component.canExecute("reviseArtifact")).toBe(false);
		expect(component.canExecute("completeResponse")).toBe(true);

		(
			await igniteTest(component).when({
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
		expect(component.canExecute("reviseArtifact")).toBe(true);

		(
			await igniteTest(component).when({
				command: "reviseArtifact",
				input: {
					artifactId: "decision",
					expectedRevision: 9,
					nodes: artifact.nodes,
				},
			})
		).expectEvent({ type: "artifact-rejected", reason: "conflict" });

		(
			await igniteTest(component).when({
				command: "completeResponse",
				input: { text: "Decision captured.", speech: "Decision captured." },
			})
		)
			.expectEvent({ type: "response-completed" })
			.expectSnapshot((snapshot) => snapshot.context.phase === "ready")
			.expectView({ status: "ready", canRevise: false });
		expect(component.canExecute("submitPrompt")).toBe(true);
		expect(component.canExecute("createArtifact")).toBe(false);
		expect(component.canExecute("reviseArtifact")).toBe(false);
		expect(component.canExecute("completeResponse")).toBe(false);

		(
			await igniteTest(component).when({
				command: "submitPrompt",
				input: { modality: "speech", text: "Revise that decision" },
			})
		).expectView({ messageCount: 3, status: "responding" });
		source.stop();
	});

	it("publishes coherent live facts until the owner stops the source", async () => {
		const { component, source } = await loadWorkbench();
		const snapshots = vi.fn();
		const views = vi.fn();
		const snapshotSubscription = component.watchSnapshot(snapshots);
		const viewSubscription = component.watchView(views);

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Observe this turn" },
		});
		expect(snapshots).toHaveBeenCalledTimes(1);
		expect(views).toHaveBeenCalledTimes(1);
		expect(component.getSnapshot().context.revision).toBe(
			component.getView().revision,
		);
		snapshotSubscription.unsubscribe();
		viewSubscription.unsubscribe();
		source.stop();
	});
});
