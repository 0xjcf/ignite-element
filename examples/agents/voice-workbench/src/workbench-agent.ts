import { igniteTools, isOk } from "ignite-element/tools";
import {
	type ModelExchange,
	type ModelToolFeedback,
	type ModelTurnResult,
	modelTools,
	modelTurn,
} from "./agent-loop";
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

export async function completeSubmittedPrompt(
	configuration: MlxWorkbenchConfiguration,
	event: { modality: "text" | "speech"; text: string },
): Promise<ModelTurnResult | null> {
	const prompt = { channel: event.modality, text: event.text };
	const history: ModelExchange[] = [];
	let result: ModelTurnResult | null = null;
	let priorTrace: ModelTurnResult["trace"] = [];

	for (let round = 0; round < 5; round += 1) {
		const tools = igniteTools(component);
		const response = await requestMlxWorkbenchModel(configuration, {
			prompt,
			tools: modelTools(tools.manifest),
			view: component.getView().modelContext,
			history,
		});
		const protocol = modelTurn(response);
		let step = protocol.next();
		while (!step.done) {
			const call = step.value;
			const execution = await tools.run({
				name: call.command,
				input: call.input,
			});
			const rejectedByActor = isOk(execution)
				? execution.value.events.find(
						(actorEvent) => actorEvent.type === "artifact-rejected",
					)
				: undefined;
			const feedback: ModelToolFeedback = {
				id: call.id ?? `model-round-${round}`,
				command: call.command,
				status: !isOk(execution)
					? "tool-error"
					: rejectedByActor
						? "actor-rejected"
						: "accepted",
				...(!isOk(execution)
					? {
							reason: execution.error.kind,
							...(execution.error.kind === "InvalidInput"
								? { issues: execution.error.issues }
								: {}),
						}
					: rejectedByActor && "reason" in rejectedByActor
						? {
								reason: String(rejectedByActor.reason),
								...(rejectedByActor.issues
									? { issues: rejectedByActor.issues }
									: {}),
							}
						: {}),
				view: component.getView().modelContext,
				events: isOk(execution)
					? execution.value.events.map((actorEvent) => ({
							type: actorEvent.type,
							...("reason" in actorEvent
								? { reason: String(actorEvent.reason) }
								: {}),
						}))
					: [],
			};
			step = protocol.next(feedback);
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
