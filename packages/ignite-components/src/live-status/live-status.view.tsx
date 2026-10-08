/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { LiveStatusCommands, LiveStatusStates } from "./live-status.core";
import { liveStatusRegion, liveStatusRegionStyles } from "./live-status.region";

export type LiveStatusViewContext = LiveStatusStates & LiveStatusCommands;

const styles = `${catalogHostStyles()}${liveStatusRegionStyles()}
:host { display: block; position: relative; max-width: 36rem; }
`;

/**
 * Polite and assertive regions, a busy region, and a settled line.
 * The words carry the status. The host decides when they change.
 */
export function liveStatusView(ctx: LiveStatusViewContext): IgniteJsxElement {
	const polite =
		ctx.state === "polite" || ctx.state === "busy" || ctx.duplicateBusy
			? ctx.message
			: null;
	const assertive = ctx.state === "assertive" ? ctx.message : null;
	const busyText =
		ctx.message.length > 0 && ctx.message !== "in progress"
			? ctx.message
			: "In progress";
	return (
		<>
			<style>{styles}</style>
			{liveStatusRegion({
				instanceId: ctx.instanceId,
				polite,
				assertive,
				busy: ctx.busy,
				progress: ctx.progress,
				settled: ctx.showSettled ? ctx.settled : null,
				busyText,
				visiblePolite: ctx.duplicateBusy,
			})}
		</>
	);
}
