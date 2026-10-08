/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type {
	ExportButtonCommands,
	ExportButtonStates,
} from "./export-button.core";

export type ExportButtonViewContext = ExportButtonStates & ExportButtonCommands;

const styles = `${catalogHostStyles()}
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
 * The label says what will be exported. The host writes the file.
 * A click that cannot run does not leave this button.
 */
export function exportButtonView(
	ctx: ExportButtonViewContext,
): IgniteJsxElement {
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
							return;
						}
						ctx.export();
					}}
				>
					{ctx.buttonLabel}
				</button>
				{ctx.showReason ? <p class="reason">{ctx.reason}</p> : null}
			</div>
		</>
	);
}
