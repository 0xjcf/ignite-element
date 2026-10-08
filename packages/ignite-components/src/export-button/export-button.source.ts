import { assign, emit, setup } from "xstate";
import { createInstanceId } from "../live-status/live-status.source";

export const DEFAULT_EXPORT_LABEL = "Export JSON";
export const DEFAULT_PENDING_LABEL = "Preparing…";
export const DEFAULT_READY_LABEL = "Exported";
export const FAILED_REASON = "The export failed.";

export type ExportButtonInput = {
	label?: string;
	pendingLabel?: string;
	readyLabel?: string;
	format?: string;
	reason?: string | null;
};

export type ExportButtonContext = {
	instanceId: string;
	label: string;
	pendingLabel: string;
	readyLabel: string;
	format: string;
	reason: string | null;
	statusLine: string | null;
	duplicateExport: boolean;
};

export type ExportButtonEvent =
	| { type: "EXPORT" }
	| { type: "SUCCEED" }
	| { type: "FAIL"; reason: string | null }
	| { type: "RESET" }
	| { type: "SET_LABEL"; label: string }
	| { type: "SET_PENDING_LABEL"; pendingLabel: string }
	| { type: "SET_READY_LABEL"; readyLabel: string }
	| { type: "SET_FORMAT"; format: string };

export type ExportButtonEmitted = { type: "export"; format: string };

export function exportReason(reason: string | null): string {
	if (reason === null || reason.trim().length === 0) return FAILED_REASON;
	return reason.trim();
}

export function exportFormat(format: string | null): string {
	const next = format?.trim().toLowerCase() ?? "";
	return next.length === 0 ? "json" : next;
}

/** Default button label for a format. A host label that differs is kept. */
export function formatLabel(format: string): string {
	return `Export ${format.toUpperCase()}`;
}

export function isGeneratedLabel(label: string, format: string): boolean {
	return label === formatLabel(format) || label === DEFAULT_EXPORT_LABEL;
}

/** A real initial reason starts failed. Whitespace-only is absent. */
export function initialExportReason(
	reason: string | null | undefined,
): string | null {
	if (reason == null) return null;
	const trimmed = reason.trim();
	return trimmed.length === 0 ? null : trimmed;
}

/**
 * The host is the download. This machine asks for a file and waits.
 * It does not write the file. Retry and success clear the failure reason.
 */
export const exportButtonMachine = setup({
	types: {
		context: {} as ExportButtonContext,
		events: {} as ExportButtonEvent,
		emitted: {} as ExportButtonEmitted,
		input: {} as ExportButtonInput,
	},
	actions: {
		applyLabel: assign({
			label: ({ event }) =>
				event.type === "SET_LABEL" ? event.label : DEFAULT_EXPORT_LABEL,
		}),
		applyPendingLabel: assign({
			pendingLabel: ({ event }) =>
				event.type === "SET_PENDING_LABEL"
					? event.pendingLabel
					: DEFAULT_PENDING_LABEL,
		}),
		applyReadyLabel: assign({
			readyLabel: ({ event }) =>
				event.type === "SET_READY_LABEL"
					? event.readyLabel
					: DEFAULT_READY_LABEL,
		}),
		applyFormat: assign(({ context, event }) => {
			if (event.type !== "SET_FORMAT") return {};
			const format = exportFormat(event.format);
			const label = isGeneratedLabel(context.label, context.format)
				? formatLabel(format)
				: context.label;
			return { format, label };
		}),
		applyFailure: assign({
			reason: ({ event }) =>
				event.type === "FAIL" ? exportReason(event.reason) : FAILED_REASON,
			statusLine: ({ event }) =>
				event.type === "FAIL" ? exportReason(event.reason) : FAILED_REASON,
			duplicateExport: () => false,
		}),
		clearReason: assign({
			reason: () => null,
		}),
		markExporting: assign({
			statusLine: () => "in progress",
			duplicateExport: () => false,
		}),
		markReady: assign({
			statusLine: ({ context }) => context.readyLabel,
			duplicateExport: () => false,
		}),
		noteDuplicate: assign({
			duplicateExport: () => true,
			statusLine: () => "already running",
		}),
		announceExport: emit(({ context }) => ({
			type: "export" as const,
			format: context.format,
		})),
	},
	guards: {
		hasConfiguredReason: ({ context }) => context.reason !== null,
	},
}).createMachine({
	id: "export-button",
	initial: "idle",
	context: ({ input }) => ({
		instanceId: createInstanceId("export"),
		label: input?.label?.trim() ? input.label : DEFAULT_EXPORT_LABEL,
		pendingLabel: input?.pendingLabel?.trim()
			? input.pendingLabel
			: DEFAULT_PENDING_LABEL,
		readyLabel: input?.readyLabel?.trim()
			? input.readyLabel
			: DEFAULT_READY_LABEL,
		format: exportFormat(input?.format ?? "json"),
		reason: initialExportReason(input?.reason),
		statusLine: null,
		duplicateExport: false,
	}),
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_PENDING_LABEL: { actions: "applyPendingLabel" },
		SET_READY_LABEL: { actions: "applyReadyLabel" },
		SET_FORMAT: { actions: "applyFormat" },
	},
	states: {
		idle: {
			always: {
				guard: "hasConfiguredReason",
				target: "failed",
			},
			on: {
				EXPORT: {
					target: "preparing",
					actions: ["clearReason", "announceExport", "markExporting"],
				},
			},
		},
		preparing: {
			on: {
				EXPORT: { actions: "noteDuplicate" },
				SUCCEED: { target: "ready", actions: ["clearReason", "markReady"] },
				FAIL: { target: "failed", actions: "applyFailure" },
			},
		},
		ready: {
			on: {
				EXPORT: {
					target: "preparing",
					actions: ["clearReason", "announceExport", "markExporting"],
				},
				RESET: { target: "idle", actions: "clearReason" },
			},
		},
		failed: {
			on: {
				EXPORT: {
					target: "preparing",
					actions: ["clearReason", "announceExport", "markExporting"],
				},
				RESET: { target: "idle", actions: "clearReason" },
			},
		},
	},
});
