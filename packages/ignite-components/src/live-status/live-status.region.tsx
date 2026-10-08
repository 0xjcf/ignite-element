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
	/** Visible busy sentence. Defaults to "In progress". */
	busyText?: string | null;
	/** When true, the polite line stays on screen. Otherwise it is clipped. */
	visiblePolite?: boolean;
};

export function liveStatusRegionStyles(): string {
	return `
.live-region { display: grid; gap: 0.35rem; }
.live-clip {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.live-settled, .live-busy-label {
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
 * The shared announcer surface. Callers pass the lines. This does not decide them.
 */
export function liveStatusRegion(input: LiveStatusRegion): IgniteJsxElement {
	const polite = input.polite ?? "";
	const assertive = input.assertive ?? "";
	const showBusy = input.busy || input.progress === "skeleton";
	const politeClass = input.visiblePolite
		? "live-polite"
		: "live-polite live-clip";
	const busyText =
		input.busyText && input.busyText.trim().length > 0
			? input.busyText
			: "In progress";
	return (
		<div class="live-region">
			<output
				id={`${input.instanceId}-polite`}
				class={politeClass}
				aria-live="polite"
				aria-atomic="true"
			>
				{polite}
			</output>
			<div
				id={`${input.instanceId}-assertive`}
				class="live-assertive live-clip"
				role="alert"
				aria-live="assertive"
				aria-atomic="true"
			>
				{assertive}
			</div>
			{showBusy ? (
				<div
					id={`${input.instanceId}-busy`}
					class="live-busy"
					role="progressbar"
					aria-busy={input.busy ? "true" : "false"}
					aria-valuetext={input.busy ? busyText : undefined}
					aria-label="Progress"
				>
					{input.progress === "skeleton" ? (
						<span class="live-skeleton" aria-hidden="true"></span>
					) : null}
					{input.busy ? <p class="live-busy-label">{busyText}</p> : null}
				</div>
			) : null}
			{input.settled ? <p class="live-settled">{input.settled}</p> : null}
		</div>
	);
}
