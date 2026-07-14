import { igniteTools, isOk } from "ignite-element/tools";
import {
	type ModelExchange,
	type ModelResult,
	type ModelToolFeedback,
	type ModelTurnResult,
	modelTools,
	modelTurn,
} from "./agent-loop";
import {
	createCapabilityFederation,
	runCapability,
	type CapabilityExecutionFact,
	type CapabilityFederation,
	type CapabilityOwner,
} from "./capability-federation";
import {
	type MlxWorkbenchConfiguration,
	requestMlxWorkbenchModel,
} from "./model";
import { component, type WorkbenchTurnFact } from "./session";

const toTurnFact = (result: ModelTurnResult): WorkbenchTurnFact => {
	if (result.accepted) return { type: "accepted", trace: result.trace };
	if (result.reason === "model-failed") {
		return {
			type: "model-failed",
			failureKind: result.failure.kind,
			message: result.failure.message,
			trace: result.trace,
		};
	}
	if (!("command" in result)) {
		return { type: result.reason, trace: result.trace };
	}
	return {
		type: result.reason,
		command: result.command,
		trace: result.trace,
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const readEvents = (value: unknown): { type: string; reason?: string }[] => {
	if (!Array.isArray(value)) return [];
	return value.flatMap((event) => {
		if (!isRecord(event) || typeof event.type !== "string") return [];
		return [
			{
				type: event.type,
				...(typeof event.reason === "string" ? { reason: event.reason } : {}),
			},
		];
	});
};

const capabilityFeedback = (
	execution: CapabilityExecutionFact,
	id: string,
): ModelToolFeedback => {
	if (execution.type === "success") {
		if (execution.ownerId === "workbench-component") {
			const data = isRecord(execution.data) ? execution.data : {};
			return {
				id,
				command: execution.toolName,
				ownerId: execution.ownerId,
				status: "accepted",
				view: data.view ?? component.getView().modelContext,
				events: readEvents(data.events),
			};
		}
		return {
			id,
			command: execution.toolName,
			ownerId: execution.ownerId,
			status: "capability-success",
			fact: execution.data,
			receipt: execution.receipt,
			view: component.getView().modelContext,
			events: [],
		};
	}

	if (execution.ownerId === "workbench-component") {
		return {
			id,
			command: execution.toolName,
			ownerId: execution.ownerId,
			status: execution.actorRejected ? "actor-rejected" : "tool-error",
			reason: execution.reason ?? execution.type,
			...(execution.issues ? { issues: execution.issues } : {}),
			view: component.getView().modelContext,
			events: [],
		};
	}

	const status: ModelToolFeedback["status"] =
		execution.type === "unavailable"
			? "capability-unavailable"
			: execution.type === "validation"
				? "capability-validation"
				: execution.type === "timeout"
					? "capability-timeout"
					: "capability-failure";
	return {
		id,
		command: execution.toolName,
		ownerId: execution.ownerId,
		status,
		reason: execution.message,
		...(execution.issues ? { issues: execution.issues } : {}),
		fact: { type: execution.type, message: execution.message },
		view: component.getView().modelContext,
		events: [],
	};
};

export async function completeSubmittedPrompt(
	configuration: MlxWorkbenchConfiguration,
	event: { modality: "text" | "speech"; text: string },
	externalCapabilities: readonly CapabilityOwner[] = [],
): Promise<ModelTurnResult | null> {
	const prompt = { channel: event.modality, text: event.text };
	const history: ModelExchange[] = [];
	let result: ModelTurnResult | null = null;
	let priorTrace: ModelTurnResult["trace"] = [];

	for (let round = 0; round < 5; round += 1) {
		const tools = igniteTools(component);
		const componentOwner: CapabilityOwner = {
			id: "workbench-component",
			manifest: modelTools(tools.manifest),
			run: async (call): Promise<CapabilityExecutionFact> => {
				const execution = await tools.run(call);
				if (!isOk(execution)) {
					switch (execution.error.kind) {
						case "InvalidInput":
							return {
								type: "validation",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component command input is invalid.",
								reason: execution.error.kind,
								issues: execution.error.issues,
							};
						case "Unavailable":
							return {
								type: "unavailable",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component command is unavailable.",
								reason: execution.error.kind,
							};
						case "UnknownCommand":
						case "ExecuteFailed":
							return {
								type: "provider-failure",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component could not execute the command.",
								reason: execution.error.kind,
							};
					}
				}

				const rejectedByActor = execution.value.events.find(
					(actorEvent) => actorEvent.type === "artifact-rejected",
				);
				if (rejectedByActor) {
					return {
						type: "validation",
						ownerId: "workbench-component",
						toolName: call.name,
						message: "The actor rejected the proposed command.",
						reason:
							"reason" in rejectedByActor
								? String(rejectedByActor.reason)
								: "actor-rejected",
						...("issues" in rejectedByActor && rejectedByActor.issues
							? { issues: rejectedByActor.issues }
							: {}),
						actorRejected: true,
					};
				}

				return {
					type: "success",
					ownerId: "workbench-component",
					toolName: call.name,
					data: {
						view: component.getView().modelContext,
						events: execution.value.events.map((actorEvent) => ({
							type: actorEvent.type,
							...("reason" in actorEvent
								? { reason: String(actorEvent.reason) }
								: {}),
						})),
					},
					receipt: { provider: "ignite-component" },
				};
			},
		};
		const federation = createCapabilityFederation([
			componentOwner,
			...externalCapabilities,
		]);
		const componentFederation = createCapabilityFederation([componentOwner]);
		if (!componentFederation.ok) return null;
		const routing: CapabilityFederation = federation.ok
			? federation
			: componentFederation;
		const response: ModelResult = federation.ok
			? await requestMlxWorkbenchModel(configuration, {
					prompt,
					tools: federation.manifest,
					view: component.getView().modelContext,
					history,
					capabilities: {
						internetAccess: federation.manifest.some(
							(tool) => tool.name === "searchWeb",
						)
							? "available"
							: "unavailable",
					},
				})
			: {
					ok: false,
					error: {
						kind: "configuration",
						message: "The capability manifest contains duplicate tool names.",
					},
				};
		const protocol = modelTurn(response);
		let step = protocol.next();
		while (!step.done) {
			const call = step.value;
			const execution = await runCapability(routing, {
				id: call.id,
				name: call.command,
				input: call.input,
			});
			step = protocol.next(
				capabilityFeedback(execution, call.id ?? `model-round-${round}`),
			);
		}
		result = {
			...step.value,
			trace: [...priorTrace, ...step.value.trace],
		};
		if ("exchange" in step.value) history.push(step.value.exchange);
		priorTrace = result.trace;
		if (result.accepted || result.reason === "model-failed") break;
	}

	if (!result) return null;
	await component.execute({
		command: "recordTurn",
		input: toTurnFact(result),
	});
	if (result.accepted && event.modality === "text") {
		await component.execute({ command: "changeDraft", input: "" });
	}
	return result;
}
