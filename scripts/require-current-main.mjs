import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FULL_SHA = /^[0-9a-f]{40}$/;

export function assertHeadIsCurrentMain({ headSha, mainSha }) {
	if (!FULL_SHA.test(headSha ?? "")) {
		throw new Error("Refusing to release without the full tested commit SHA.");
	}
	if (!FULL_SHA.test(mainSha ?? "")) {
		throw new Error("Refusing to release without the current main SHA.");
	}
	if (headSha !== mainSha) {
		throw new Error(
			`Refusing to release ${headSha} because main is ${mainSha}.`,
		);
	}
}

function readOriginMainSha() {
	return execFileSync("git", ["rev-parse", "origin/main"], {
		encoding: "utf8",
	}).trim();
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
	try {
		assertHeadIsCurrentMain({
			headSha: process.env.HEAD_SHA,
			mainSha: readOriginMainSha(),
		});
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Release freshness check failed.",
		);
		process.exitCode = 1;
	}
}
