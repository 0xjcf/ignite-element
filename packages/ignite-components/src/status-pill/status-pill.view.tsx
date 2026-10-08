/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { liveStatusRegionStyles } from "../live-status/live-status.region";
import { catalogHostStyles } from "../styles";
import type { StatusPillCommands, StatusPillStates } from "./status-pill.core";

export type StatusPillViewContext = StatusPillStates & StatusPillCommands;

const styles = `${catalogHostStyles()}${liveStatusRegionStyles()}
:host { display: inline-block; max-width: 100%; }
.status-pill {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.55rem;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0.2rem 0.65rem;
  border: 1px solid var(--status-pill-tone, var(--catalog-line));
  border-radius: 999px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  font: 600 0.875rem/1.35 var(--catalog-font);
}
.status-pill[data-tone="info"] { border-color: var(--status-pill-tone, #1d4e89); background: #e7f0fa; }
.status-pill[data-tone="success"] { border-color: var(--status-pill-tone, #0f6b4c); background: #e5f4ec; }
.status-pill[data-tone="warning"] { border-color: var(--status-pill-tone, #8a4b08); background: #fbf0e2; }
.status-pill[data-tone="danger"] { border-color: var(--status-pill-tone, #8f1d1d); background: #f8e8e8; }
.status-pill-tone {
  font: 650 0.72rem/1.3 var(--catalog-font);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.status-pill-value { color: var(--catalog-fg); }
.status-pill-reason {
  font-weight: 400;
  color: var(--catalog-muted);
}
`;

/**
 * The tone word is text. Color only tints the chip.
 * A live announcement is opt-in, so a row of pills does not spam.
 */
function chip(ctx: StatusPillViewContext): IgniteJsxElement {
	return (
		<span class="status-pill" data-tone={ctx.tone}>
			<span class="status-pill-tone">{ctx.toneLabel}</span>{" "}
			<span class="status-pill-value">{ctx.value}</span>
			{ctx.showReason ? (
				<>
					<span class="status-pill-sep"> — </span>
					<span class="status-pill-reason">{ctx.reason}</span>
				</>
			) : null}
		</span>
	);
}

/**
 * The tone word is text. Color only tints the chip.
 * Opt-in announcements use that same chip as the live region, once.
 */
export function statusPillView(ctx: StatusPillViewContext): IgniteJsxElement {
	const spoken = ctx.announce ? ctx.announcement : null;
	return (
		<>
			<style>{styles}</style>
			{spoken ? (
				<output
					id={`${ctx.instanceId}-polite`}
					class="status-pill"
					data-tone={ctx.tone}
					aria-live="polite"
					aria-atomic="true"
				>
					{spoken}
				</output>
			) : (
				chip(ctx)
			)}
			{ctx.announce && !spoken ? (
				<output
					id={`${ctx.instanceId}-polite`}
					class="live-polite"
					aria-live="polite"
					aria-atomic="true"
				></output>
			) : null}
		</>
	);
}
