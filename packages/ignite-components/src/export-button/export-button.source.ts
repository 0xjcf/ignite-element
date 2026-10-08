import { assign, emit, setup } from "xstate";

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
	label: string;
	pendingLabel: string;
	readyLabel: string;
	format: string;
	reason: string | null;
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

/**
 * The host is the download. This machine asks for a file and waits.
 * It does not write the file. ready means the host finished. failed keeps the reason.
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
		applyFormat: assign({
			format: ({ event }) =>
				event.type === "SET_FORMAT" ? exportFormat(event.format) : "json",
		}),
		applyFailure: assign({
			reason: ({ event }) =>
				event.type === "FAIL" ? exportReason(event.reason) : FAILED_REASON,
		}),
		clearReason: assign({
			reason: () => null,
		}),
		announceExport: emit(({ context }) => ({
			type: "export" as const,
			format: context.format,
		})),
	},
}).createMachine({
	id: "export-button",
	initial: "idle",
	context: ({ input }) => ({
		label: input?.label?.trim() ? input.label : DEFAULT_EXPORT_LABEL,
		pendingLabel: input?.pendingLabel?.trim()
			? input.pendingLabel
			: DEFAULT_PENDING_LABEL,
		readyLabel: input?.readyLabel?.trim()
			? input.readyLabel
			: DEFAULT_READY_LABEL,
		format: exportFormat(input?.format ?? "json"),
		reason: null,
	}),
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_PENDING_LABEL: { actions: "applyPendingLabel" },
		SET_READY_LABEL: { actions: "applyReadyLabel" },
		SET_FORMAT: { actions: "applyFormat" },
	},
	states: {
		idle: {
			entry: "clearReason",
			on: {
				EXPORT: { target: "preparing", actions: "announceExport" },
			},
		},
		preparing: {
			on: {
				SUCCEED: "ready",
				FAIL: { target: "failed", actions: "applyFailure" },
			},
		},
		ready: {
			on: {
				EXPORT: { target: "preparing", actions: "announceExport" },
				RESET: "idle",
			},
		},
		failed: {
			on: {
				EXPORT: { target: "preparing", actions: "announceExport" },
				RESET: "idle",
			},
		},
	},
});
