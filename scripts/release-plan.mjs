import { appendFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function planRelease(fileNames) {
	const pending = fileNames.filter(
		(name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md",
	);
	return pending.length > 0 ? "version" : "publish";
}

function writePlan(action) {
	const line = `action=${action}\n`;
	const output = process.env.GITHUB_OUTPUT;
	if (typeof output === "string" && output.length > 0) {
		appendFileSync(output, line);
		return;
	}
	process.stdout.write(line);
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
	const directory = path.join(root, ".changeset");
	const names = existsSync(directory) ? readdirSync(directory) : [];
	writePlan(planRelease(names));
}
