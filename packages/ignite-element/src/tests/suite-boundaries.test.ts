// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER_SUFFIX = ".browser.test.ts";
// Assembled so this file does not match its own scan.
const browserLauncher = ["@playwright", "test"].join("/");

function testFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return testFiles(path);
		return /\.test\.tsx?$/.test(entry.name) ? [path] : [];
	});
}

describe("test suite boundaries", () => {
	const files = testFiles(srcRoot);

	it("only .browser.test.ts files launch a browser", () => {
		const offenders = files
			.filter((file) => readFileSync(file, "utf8").includes(browserLauncher))
			.filter((file) => !file.endsWith(BROWSER_SUFFIX))
			.map((file) => relative(srcRoot, file));
		expect(offenders).toEqual([]);
	});

	// Configs are read as text: importing them would pull the Vite build
	// config into the test tsconfig.
	it("the default suite excludes browser tests and the browser suite owns them", () => {
		const packageRoot = join(srcRoot, "..");
		const read = (name: string) =>
			readFileSync(join(packageRoot, name), "utf8");
		expect(read("vitest.config.ts")).toContain(`"**/*${BROWSER_SUFFIX}"`);
		expect(read("vitest.browser.config.ts")).toContain(
			`"src/**/*${BROWSER_SUFFIX}"`,
		);
		expect(files.some((file) => file.endsWith(BROWSER_SUFFIX))).toBe(true);
	});
});
