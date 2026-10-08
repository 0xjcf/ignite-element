/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import {
	liveStatusRegion,
	liveStatusRegionStyles,
} from "../live-status/live-status.region";
import { catalogHostStyles } from "../styles";
import type { FieldCommands, FieldStates } from "./field.core";

export type FieldViewContext = FieldStates & FieldCommands;

const styles = `${catalogHostStyles()}${liveStatusRegionStyles()}
:host { display: block; max-width: 36rem; }
.field { display: grid; gap: 0.35rem; }
.label {
  font: 650 0.95rem/1.3 var(--catalog-font);
  color: var(--catalog-fg);
}
.required { font-weight: 650; }
.control {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  font: 400 1rem/1.4 var(--catalog-font);
}
textarea.control { min-height: 6.5rem; resize: vertical; }
.control:focus { outline: 2px solid var(--catalog-fg); outline-offset: 2px; }
.control[aria-invalid="true"] { border-color: #8f1d1d; }
.hint, .error {
  margin: 0;
  color: var(--catalog-fg);
  font: 400 0.875rem/1.35 var(--catalog-font);
}
.error { font-weight: 650; }
`;

function readControl(event: Event): string | null {
	const target = event.target;
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement
	) {
		return target.value;
	}
	return null;
}

function describedBy(ctx: FieldViewContext): string | undefined {
	const ids = [
		ctx.showHint ? `${ctx.instanceId}-hint` : null,
		ctx.showError ? `${ctx.instanceId}-error` : null,
	].filter((id) => id !== null);
	return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * The control shows the exact draft. Typing emits that draft once. Blur emits touch.
 * The host clears the error when the draft is valid. Typing does not.
 */
export function fieldView(ctx: FieldViewContext): IgniteJsxElement {
	const controlId = `${ctx.instanceId}-control`;
	const controlProps = {
		id: controlId,
		class: "control",
		value: ctx.value,
		"aria-invalid": ctx.showError ? "true" : "false",
		"aria-describedby": describedBy(ctx),
		"aria-required": ctx.required ? "true" : "false",
		onInput: (event: Event) => {
			event.stopPropagation();
			const value = readControl(event);
			if (value !== null) ctx.setValue(value);
		},
		onBlur: () => {
			ctx.touch();
		},
	};
	return (
		<>
			<style>{styles}</style>
			<div class="field">
				<label class="label" for={controlId}>
					{ctx.label}
					{ctx.required ? <span class="required"> Required</span> : null}
				</label>
				{ctx.multiline ? (
					<textarea {...controlProps}></textarea>
				) : (
					<input type="text" {...controlProps} />
				)}
				{ctx.showHint ? (
					<p id={`${ctx.instanceId}-hint`} class="hint">
						{ctx.hint}
					</p>
				) : null}
				{ctx.showError ? (
					<p id={`${ctx.instanceId}-error`} class="error">
						{ctx.error}
					</p>
				) : null}
				{liveStatusRegion({
					instanceId: ctx.instanceId,
					polite: null,
					assertive: ctx.errorAnnouncement,
					busy: false,
					progress: "none",
					settled: null,
				})}
			</div>
		</>
	);
}
