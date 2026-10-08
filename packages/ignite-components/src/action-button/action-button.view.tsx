/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type {
	ActionButtonCommands,
	ActionButtonStates,
} from "./action-button.core";

export type ActionButtonViewContext = ActionButtonStates & ActionButtonCommands;

const styles = `${catalogHostStyles()}
:host { display: inline-block; max-width: 100%; }
.action {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  max-width: 100%;
}
.action-button {
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-fg);
  color: var(--catalog-surface);
  font: 600 0.95rem/1.2 var(--catalog-font);
  cursor: pointer;
}
.action-button[aria-disabled="true"] {
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  border-style: dashed;
  cursor: default;
}
.action-reason {
  margin: 0;
  max-width: 18rem;
  color: var(--catalog-fg);
  font: 400 0.875rem/1.35 var(--catalog-font);
}
`;

/**
 * Stays focusable when it cannot run. The reason is text, and it is in the tab order.
 * The host owns the guard. This view only shows the flag the host already decided.
 */
export function actionButtonView(
	ctx: ActionButtonViewContext,
): IgniteJsxElement {
	const describedBy = ctx.showReason ? "action-reason" : undefined;
	return (
		<>
			<style>{styles}</style>
			<span class="action">
				<button
					type="button"
					class="action-button"
					aria-disabled={ctx.canPress ? "false" : "true"}
					aria-describedby={describedBy}
					onClick={(event: Event) => {
						if (!ctx.canPress) {
							event.preventDefault();
							event.stopPropagation();
							return;
						}
						ctx.press();
					}}
				>
					{ctx.isPending ? ctx.pendingLabel : ctx.label}
				</button>
				{ctx.showReason ? (
					<p id="action-reason" class="action-reason" tabindex="0">
						{ctx.reason}
					</p>
				) : null}
			</span>
		</>
	);
}
