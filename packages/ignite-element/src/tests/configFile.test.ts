/* @vitest-environment node */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfigFile } from "../plugins/configFile";

const TEMP_PREFIX = "ignite-config-file-";

const createdDirs: string[] = [];

function createTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
	createdDirs.push(dir);
	return dir;
}

afterEach(() => {
	while (createdDirs.length > 0) {
		const dir = createdDirs.pop();
		if (dir) {
			rmSync(dir, { recursive: true, force: true });
		}
	}
});

describe("resolveConfigFile", () => {
	it("resolves an explicit absolute config path when the file exists", () => {
		const root = createTempDir();
		const customConfig = join(root, "custom.config.ts");
		writeFileSync(customConfig, "export default {}");

		const result = resolveConfigFile({
			root,
			configPath: customConfig,
		});

		expect(result).toBe(customConfig);
	});

	it("resolves a relative config path from the provided root", () => {
		const root = createTempDir();
		const subDir = resolve(root, "configs");
		mkdirSync(subDir, { recursive: true });
		const relativePath = "configs/ignite.custom.ts";
		const absolutePath = resolve(root, relativePath);
		writeFileSync(absolutePath, "export default {}");

		const result = resolveConfigFile({
			root,
			configPath: relativePath,
		});

		expect(result).toBe(absolutePath);
	});

	it("returns undefined when an explicit config path does not exist", () => {
		const root = createTempDir();

		const result = resolveConfigFile({
			root,
			configPath: "missing.config.ts",
		});

		expect(result).toBeUndefined();
	});

	it("finds the first default config file when configPath is omitted", () => {
		const root = createTempDir();
		const defaultConfig = resolve(root, "ignite.config.js");
		writeFileSync(defaultConfig, "export default {}");

		const result = resolveConfigFile({ root });

		expect(result).toBe(defaultConfig);
	});

	it("returns undefined when no config file is present", () => {
		const root = createTempDir();

		const result = resolveConfigFile({ root });

		expect(result).toBeUndefined();
	});
});
