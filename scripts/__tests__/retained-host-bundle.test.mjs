import { execFileSync } from "node:child_process";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

it("preserves hosts, canvas refs, accessible descriptions and cleanup in the built consumer", () => {
	execFileSync(
		process.execPath,
		[
			fileURLToPath(
				new URL("./fixtures/retained-host-probe.mjs", import.meta.url),
			),
		],
		{ stdio: "pipe" },
	);
});
