// Backward-compatible local entrypoint. This command only prepares reviewable
// version changes; registry staging is deliberately a separate CI operation.
import { prepareBetaRelease } from "./prepare-beta-release.mjs";

try {
	prepareBetaRelease();
} catch (error) {
	console.error(`[release:prepare] ${error.message}`);
	process.exitCode = 1;
}
