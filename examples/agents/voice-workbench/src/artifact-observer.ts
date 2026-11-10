import {
	parseProjectionDocumentCollection,
	validateProjectionDocument,
} from "./artifact-document";
import type { ProjectionDocument } from "./artifact-types";
import { voiceWorkbenchCommandDefinitions } from "./workbench-component";

export type ArtifactView = {
	modelContext: { artifacts: unknown };
	commandAvailability: Readonly<Record<string, boolean>>;
};
type ArtifactSource = {
	watch(handler: (view: ArtifactView) => void): { unsubscribe(): void };
};

// Application-owned delivery policy over the ordinary Ignite watch contract.
// It observes accepted source data; it neither constructs nor stops the source.
export function observeWorkbenchDocuments(
	source: ArtifactSource,
	commit: (document: ProjectionDocument) => void | Promise<void>,
	onError: (error: unknown) => void = (error) =>
		console.error("[voice-workbench] Document delivery failed", error),
): { dispose(): void } {
	let disposed = false;
	let running = false;
	let queued: ArtifactView | undefined;
	const delivered = new Map<string, string>();

	const report = (error: unknown) => {
		try {
			onError(error);
		} catch {
			/* Reporting cannot break observation. */
		}
	};
	const drain = async () => {
		while (!disposed && queued) {
			const view = queued;
			queued = undefined;
			try {
				const parsed = parseProjectionDocumentCollection(
					view.modelContext.artifacts,
				);
				if (!parsed.ok) throw new Error(parsed.issues.join("; "));
				const document = parsed.documents[0];
				if (!document) continue;
				const issues = validateProjectionDocument(document, {
					schema: { commands: voiceWorkbenchCommandDefinitions },
					canExecute: (name) => view.commandAvailability[name] === true,
				});
				if (issues.length > 0) throw new Error(issues.join("; "));
				if (delivered.get(document.id) === document.revision) continue;
				delivered.set(document.id, document.revision);
				try {
					await commit(document);
				} catch (error) {
					delivered.delete(document.id);
					throw error;
				}
			} catch (error) {
				report(error);
			}
		}
		running = false;
	};
	let subscription: ReturnType<ArtifactSource["watch"]>;
	try {
		subscription = source.watch((view) => {
			if (disposed) return;
			queued = view;
			if (!running) {
				running = true;
				void Promise.resolve().then(drain);
			}
		});
	} catch (error) {
		disposed = true;
		queued = undefined;
		throw error;
	}
	return {
		dispose() {
			if (disposed) return;
			disposed = true;
			queued = undefined;
			subscription.unsubscribe();
		},
	};
}
