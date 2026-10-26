import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function removePackageDist(dir) {
	rmSync(dir, { recursive: true, force: true });
}

function isMainModule() {
	return (
		process.argv[1] &&
		path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
	);
}

if (isMainModule()) {
	removePackageDist(
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist"),
	);
}
