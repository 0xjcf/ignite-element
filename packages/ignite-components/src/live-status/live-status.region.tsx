/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import type { LiveProgress } from "./live-status.source";

export type LiveStatusRegion = {
	instanceId: string;
	polite: string | null;
	assertive: string | null;
	busy: boolean;
	progress: LiveProgress;
	settled: string | null;
	/** Unused. Busy text is the polite line, not a second progress label. */
	busyText?: string | null;
	/** Unused. The live region is the visible status. */
	visiblePolite?: boolean;
};

type PaintGate = {
	fingerprint: string;
	ready: boolean;
};

const paintGates = new Map<string, PaintGate>();

/**
 * The first paint of a region is empty. A later update fills it so a
 * screen reader hears the change. A fingerprint that differs from that
 * first paint is shown at once, because the region is already mounted.
 */
export function spokenOnThisPaint(
	instanceId: string,
	fingerprint: string,
	release: () => void,
): boolean {
	const existing = paintGates.get(instanceId);
	if (!existing) {
		const gate: PaintGate = { fingerprint, ready: false };
		paintGates.set(instanceId, gate);
		queueMicrotask(() => {
			if (gate.ready) return;
			gate.ready = true;
			try {
				release();
			} catch {
				// The host can disconnect before the region fills.
			}
		});
		return false;
	}
	return existing.ready || existing.fingerprint !== fingerprint;
}

export function liveStatusRegionStyles(): string {
	return `
.live-region { display: grid; gap: 0.35rem; }
.live-polite, .live-assertive {
  margin: 0;
  color: var(--catalog-fg, #1c1915);
  font: 400 0.875rem/1.35 var(--catalog-font, "Segoe UI", sans-serif);
}
.live-skeleton {
  display: block;
  width: 8rem;
  height: 0.7rem;
  border-radius: 999px;
  background: var(--catalog-line, #d9d2c5);
}
`;
}

/**
 * One visible live region. Busy work keeps aria-busy on the progressbar
 * and does not repeat the sentence there.
 */
export function liveStatusRegion(input: LiveStatusRegion): IgniteJsxElement {
	const politeText = (input.polite ?? "").trim();
	const settledText = (input.settled ?? "").trim();
	const polite =
		politeText.length > 0
			? politeText
			: settledText.length > 0
				? settledText
				: "";
	const assertive = (input.assertive ?? "").trim();
	return (
		<div class="live-region">
			<output
				id={`${input.instanceId}-polite`}
				class="live-polite"
				aria-live="polite"
				aria-atomic="true"
			>
				{polite}
			</output>
			<div
				id={`${input.instanceId}-assertive`}
				class="live-assertive"
				role="alert"
				aria-live="assertive"
				aria-atomic="true"
			>
				{assertive}
			</div>
			{input.busy ? (
				<div
					id={`${input.instanceId}-busy`}
					class="live-busy"
					role="progressbar"
					aria-busy="true"
					aria-label="Progress"
				>
					{input.progress === "skeleton" ? (
						<span class="live-skeleton" aria-hidden="true"></span>
					) : null}
				</div>
			) : null}
		</div>
	);
}
