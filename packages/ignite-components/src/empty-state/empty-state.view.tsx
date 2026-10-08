/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { EmptyStateCommands, EmptyStateStates } from "./empty-state.core";

export type EmptyStateViewContext = EmptyStateStates & EmptyStateCommands;

const styles = `${catalogHostStyles()}
:host { display: block; max-width: 36rem; }
.empty {
  padding: 1.25rem 1rem;
  border: 1px dashed var(--catalog-line);
  border-radius: 8px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
}
.kind {
  margin: 0 0 0.35rem;
  font: 650 0.78rem/1.3 var(--catalog-font);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--catalog-fg);
}
h2 {
  margin: 0 0 0.4rem;
  font: 650 1.25rem/1.3 var(--catalog-font);
  color: var(--catalog-fg);
}
p { margin: 0; color: var(--catalog-fg); }
.step {
  margin-top: 0.9rem;
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-fg);
  color: var(--catalog-surface);
  font: 600 0.95rem/1.2 var(--catalog-font);
}
`;

function focusDefinedTarget(event: Event, targetId: string | null) {
	const current = event.currentTarget;
	if (!(current instanceof HTMLElement)) return;
	const root = current.getRootNode();
	const doc = current.ownerDocument;
	if (targetId) {
		const external = doc.getElementById(targetId);
		const internal =
			root instanceof ShadowRoot ? root.getElementById(targetId) : null;
		const found = external ?? internal;
		if (found instanceof HTMLElement) {
			if (found.tabIndex < 0) found.tabIndex = -1;
			found.focus();
			return;
		}
	}
	const section = current.closest("section");
	if (section instanceof HTMLElement) section.focus();
}

function kindWords(state: EmptyStateStates["state"]): string {
	if (state === "filtered") return "Nothing matches";
	if (state === "outside-range") return "Outside this range";
	return "Nothing here yet";
}

/**
 * Words first. The optional button is the one first step the host named.
 * This view does not decide what that step does.
 */
export function emptyStateView(ctx: EmptyStateViewContext): IgniteJsxElement {
	return (
		<>
			<style>{styles}</style>
			<section
				id={`${ctx.instanceId}-root`}
				class="empty"
				aria-labelledby={`${ctx.instanceId}-title`}
				tabindex="-1"
			>
				<p class="kind">{kindWords(ctx.state)}</p>
				<h2 id={`${ctx.instanceId}-title`}>{ctx.title}</h2>
				<p>{ctx.message}</p>
				{ctx.showAction ? (
					<button
						type="button"
						class="step"
						onClick={(event: Event) => {
							ctx.act();
							focusDefinedTarget(event, ctx.focusTarget ?? ctx.instanceId);
						}}
					>
						{ctx.actionLabel}
					</button>
				) : null}
			</section>
		</>
	);
}
