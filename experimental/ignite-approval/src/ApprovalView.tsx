import { useIgnite } from "ignite-element/react";
import type { ApprovalCore } from "./approvalCore";
import { confirmViewFromBytes } from "./confirmView";

/**
 * Reads the core through useIgnite and parses the confirm model from the
 * canonical bytes on that snapshot. A test authenticator stays labeled as a
 * software key: this view does not treat it as user presence.
 */
export function ApprovalConfirmView({ core }: { core: ApprovalCore }) {
	const view = useIgnite(core);
	const confirm = confirmViewFromBytes(view.canonicalBytes);
	const softwareKey = view.authenticatorKind === "test-ed25519";
	const presence =
		softwareKey || !view.provesUserPresence
			? "Presence not proved"
			: "Presence flag set";
	return (
		<section aria-label="Confirm signed bytes">
			{view.canonicalBytes ? (
				<>
					<pre data-testid="bytes">{view.canonicalBytes}</pre>
					<ol>
						{confirm.moves.map((move, index) => (
							<li key={`${index}:${move.move}:${move.lines.join("|")}`}>
								<span data-testid="move">{move.move}</span>
								<span data-testid="projects">{move.projectIds.join(",")}</span>
								<span data-testid="lines">{move.lines.join(",")}</span>
							</li>
						))}
					</ol>
					<p data-testid="destructive-count">{confirm.destructiveCount}</p>
					<p data-testid="counted-names">{confirm.countedNames.join(",")}</p>
				</>
			) : (
				<p data-testid="empty">No signed bytes</p>
			)}
			{view.authenticatorLabel ? (
				<>
					<p data-testid="authenticator-mark">{view.authenticatorLabel}</p>
					<p data-testid="presence">{presence}</p>
				</>
			) : null}
			{view.refusal ? (
				<p data-testid="refusal">
					{view.refusal.guard}:{view.refusal.code}
				</p>
			) : null}
			<button type="button" disabled={!view.canSubmitSigned}>
				Submit signed event
			</button>
		</section>
	);
}
