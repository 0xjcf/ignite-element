/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { LiveStatusCommands, LiveStatusStates } from "./live-status.core";
import {
	liveStatusRegion,
	liveStatusRegionStyles,
	spokenOnThisPaint,
} from "./live-status.region";
import { cliTone } from "./live-status.source";

export type LiveStatusViewContext = LiveStatusStates & LiveStatusCommands;

const styles = `${catalogHostStyles()}${liveStatusRegionStyles()}
:host { display: block; position: relative; max-width: 36rem; }
`;

function politeLine(ctx: LiveStatusViewContext): string | null {
	if (ctx.state === "settled") return ctx.settled;
	if (ctx.state === "busy" || ctx.duplicateBusy) {
		if (ctx.message.length === 0) return "in progress";
		return cliTone(ctx.tone, ctx.message);
	}
	if (ctx.state === "polite") return cliTone(ctx.tone, ctx.message);
	return null;
}

function assertiveLine(ctx: LiveStatusViewContext): string | null {
	if (ctx.state !== "assertive") return null;
	return cliTone(ctx.tone, ctx.message);
}

/**
 * The live region is the visible status. Busy work does not repeat it
 * on the progressbar. The first paint stays empty, then a later update fills it.
 */
export function liveStatusView(ctx: LiveStatusViewContext): IgniteJsxElement {
	const polite = politeLine(ctx);
	const assertive = assertiveLine(ctx);
	const fingerprint = `${polite ?? ""}|${assertive ?? ""}|${ctx.busy}|${ctx.progress}`;
	const show = spokenOnThisPaint(ctx.instanceId, fingerprint, () => {
		ctx.reveal();
	});
	return (
		<>
			<style>{styles}</style>
			{liveStatusRegion({
				instanceId: ctx.instanceId,
				polite: show ? polite : null,
				assertive: show ? assertive : null,
				busy: ctx.busy,
				progress: ctx.progress,
				settled: null,
			})}
		</>
	);
}
