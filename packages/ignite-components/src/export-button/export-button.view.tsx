/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import {
	liveStatusRegion,
	liveStatusRegionStyles,
} from "../live-status/live-status.region";
import { cliTone } from "../live-status/live-status.source";
import { catalogHostStyles } from "../styles";
import type {
	ExportButtonCommands,
	ExportButtonStates,
} from "./export-button.core";

export type ExportButtonViewContext = ExportButtonStates & ExportButtonCommands;

const styles = `${catalogHostStyles()}${liveStatusRegionStyles()}
:host { display: inline-block; max-width: 100%; }
.export { display: grid; gap: 0.45rem; justify-items: start; }
button {
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.45rem 0.95rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-fg);
  color: var(--catalog-surface);
  font: 600 0.95rem/1.2 var(--catalog-font);
}
button[aria-disabled="true"] {
  background: var(--catalog-surface);
  color: var(--catalog-fg);
}
button:focus { outline: 2px solid var(--catalog-fg); outline-offset: 2px; }
.reason {
  margin: 0;
  max-width: 24rem;
  color: var(--catalog-fg);
  font: 650 0.95rem/1.35 var(--catalog-font);
}
`;

/**
 * The label names the format. The host writes the file.
 * Unavailable keeps the button focusable with a visible reason.
 * Busy lives on the announcer, not on the button.
 */
export function exportButtonView(
	ctx: ExportButtonViewContext,
): IgniteJsxElement {
	const polite =
		ctx.state === "preparing"
			? ctx.pendingLabel
			: ctx.state === "ready"
				? ctx.readyLabel
				: null;
	const assertive =
		ctx.state === "failed" && ctx.reason ? cliTone("error", ctx.reason) : null;
	return (
		<>
			<style>{styles}</style>
			<div class="export">
				<button
					type="button"
					aria-disabled={ctx.canExport ? "false" : "true"}
					onClick={(event: Event) => {
						if (!ctx.canExport) {
							event.preventDefault();
							event.stopPropagation();
							ctx.export();
							return;
						}
						ctx.export();
					}}
				>
					{ctx.buttonLabel}
				</button>
				{liveStatusRegion({
					instanceId: ctx.instanceId,
					polite,
					assertive,
					busy: ctx.isPreparing,
					progress: ctx.isPreparing ? "indeterminate" : "none",
					settled: null,
				})}
			</div>
		</>
	);
}
