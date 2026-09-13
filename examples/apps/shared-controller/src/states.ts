import type { Snapshot } from "./controller.js";
export function deriveStates(snapshot: Snapshot) {
	const { confirmed, requested, outcome, loading, readFailed } = snapshot;
	let message =
		confirmed === null
			? "No confirmed preference. Load it first."
			: `Current density: ${confirmed}.`;
	if (outcome === "pending")
		message = `Saving ${requested}. The last confirmation is unchanged.`;
	if (outcome === "confirmed") message = `Confirmed density: ${confirmed}.`;
	if (outcome === "rejected")
		message = `The ${requested} change was rejected. You can retry.`;
	if (outcome === "unknown")
		message = `The ${requested} outcome is unknown. It may still complete.`;
	if (loading) message += " Loading the current preference…";
	if (readFailed)
		message += " Could not load; any last confirmation is retained.";
	return {
		confirmed,
		outcome,
		message,
		canChoose:
			confirmed !== null && outcome !== "pending" && outcome !== "unknown",
		canCheck: !loading,
		canRetry: outcome === "rejected" && requested !== confirmed,
	};
}
export type States = ReturnType<typeof deriveStates>;
