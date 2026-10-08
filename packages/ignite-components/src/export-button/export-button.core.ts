import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	DEFAULT_EXPORT_LABEL,
	DEFAULT_PENDING_LABEL,
	DEFAULT_READY_LABEL,
	type ExportButtonEvent,
	exportButtonMachine,
	exportFormat,
	exportReason,
} from "./export-button.source";

export type ExportButtonStateName = "idle" | "preparing" | "ready" | "failed";

export type ExportButtonStates = {
	state: ExportButtonStateName;
	label: string;
	pendingLabel: string;
	readyLabel: string;
	format: string;
	reason: string | null;
	buttonLabel: string;
	canExport: boolean;
	canExportRefusal: string | null;
	isPreparing: boolean;
	isPreparingRefusal: string | null;
	isReady: boolean;
	isReadyRefusal: string | null;
	isFailed: boolean;
	isFailedRefusal: string | null;
	showReason: boolean;
	showReasonRefusal: string | null;
};

export type ExportButtonCommands = {
	export: () => void;
	succeed: () => void;
	fail: (reason: string | null) => void;
	reset: () => void;
	setLabel: (label: string | null) => void;
	setPendingLabel: (pendingLabel: string | null) => void;
	setPendinglabel: (pendingLabel: string | null) => void;
	setReadyLabel: (readyLabel: string | null) => void;
	/** HTML lowercases `readyLabel` to `readylabel`. Same setter. */
	setReadylabel: (readyLabel: string | null) => void;
	setFormat: (format: string | null) => void;
};

const RUNNING = "This export is already running.";
const NOT_PREPARING = "This export is not running.";
const NOT_READY = "This export is not ready.";
const NOT_FAILED = "This export has not failed.";
const NO_REASON = "No reason was given.";

function named(value: string | null, fallback: string): string {
	if (value === null || value.trim() === "") return fallback;
	return value;
}

export function projectExportButton(
	snapshot: SnapshotFrom<typeof exportButtonMachine>,
): ExportButtonStates {
	const preparing = snapshot.matches("preparing");
	const ready = snapshot.matches("ready");
	const failed = snapshot.matches("failed");
	const reason = failed ? snapshot.context.reason : null;
	const buttonLabel = preparing
		? snapshot.context.pendingLabel
		: ready
			? snapshot.context.readyLabel
			: failed
				? "Try again"
				: snapshot.context.label;
	return {
		state: preparing
			? "preparing"
			: ready
				? "ready"
				: failed
					? "failed"
					: "idle",
		label: snapshot.context.label,
		pendingLabel: snapshot.context.pendingLabel,
		readyLabel: snapshot.context.readyLabel,
		format: snapshot.context.format,
		reason,
		buttonLabel,
		canExport: !preparing,
		canExportRefusal: preparing ? RUNNING : null,
		isPreparing: preparing,
		isPreparingRefusal: preparing ? null : NOT_PREPARING,
		isReady: ready,
		isReadyRefusal: ready ? null : NOT_READY,
		isFailed: failed,
		isFailedRefusal: failed ? null : NOT_FAILED,
		showReason: reason !== null,
		showReasonRefusal: reason !== null ? null : NO_REASON,
	};
}

export function exportButtonCommands(source: {
	send: (event: ExportButtonEvent) => void;
}): ExportButtonCommands {
	return {
		export: () => {
			source.send({ type: "EXPORT" });
		},
		succeed: () => {
			source.send({ type: "SUCCEED" });
		},
		fail: (reason) => {
			source.send({ type: "FAIL", reason: exportReason(reason) });
		},
		reset: () => {
			source.send({ type: "RESET" });
		},
		setLabel: (label) => {
			source.send({
				type: "SET_LABEL",
				label: named(label, DEFAULT_EXPORT_LABEL),
			});
		},
		setPendingLabel: (pendingLabel) => {
			source.send({
				type: "SET_PENDING_LABEL",
				pendingLabel: named(pendingLabel, DEFAULT_PENDING_LABEL),
			});
		},
		setPendinglabel: (pendingLabel) => {
			source.send({
				type: "SET_PENDING_LABEL",
				pendingLabel: named(pendingLabel, DEFAULT_PENDING_LABEL),
			});
		},
		setReadyLabel: (readyLabel) => {
			source.send({
				type: "SET_READY_LABEL",
				readyLabel: named(readyLabel, DEFAULT_READY_LABEL),
			});
		},
		setReadylabel: (readyLabel) => {
			source.send({
				type: "SET_READY_LABEL",
				readyLabel: named(readyLabel, DEFAULT_READY_LABEL),
			});
		},
		setFormat: (format) => {
			source.send({ type: "SET_FORMAT", format: exportFormat(format) });
		},
	};
}

export const exportButtonProjection = {
	states: projectExportButton,
	commands: ({
		source,
	}: {
		source: Parameters<typeof exportButtonCommands>[0];
	}) => exportButtonCommands(source),
};

export function createExportButtonCore() {
	return igniteCore({
		source: exportButtonMachine,
		states: projectExportButton,
		commands: ({ source }) => exportButtonCommands(source),
		events: (event) => ({
			export: event<{ format: string }>(),
		}),
	});
}
