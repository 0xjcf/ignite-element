import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	createTarballManifest,
	RELEASE_PACKAGES,
} from "../stage-beta-release.mjs";
import { resolveReviewedTarballs } from "../verify-packed-consumers.mjs";

test("staging's exact five tarballs pass packed validation, including the plugin", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "ignite-five-tarballs-"));
	try {
		const candidates = RELEASE_PACKAGES.map((definition, index) => {
			const root = path.join(dir, `fixture-${index}`);
			const pkg = path.join(root, "package");
			mkdirSync(pkg, { recursive: true });
			const actual = JSON.parse(
				readFileSync(
					new URL(
						`../../${definition.directory}/package.json`,
						import.meta.url,
					),
					"utf8",
				),
			);
			writeFileSync(path.join(pkg, "package.json"), JSON.stringify(actual));
			for (const target of Object.values(actual.exports).flatMap((entry) =>
				typeof entry === "string" ? [entry] : Object.values(entry),
			)) {
				if (typeof target !== "string" || target === "./package.json") continue;
				const output = path.join(pkg, target);
				mkdirSync(path.dirname(output), { recursive: true });
				writeFileSync(output, "export {};\n");
			}
			const file = path.join(dir, `package-${index}.tgz`);
			execFileSync("tar", ["-czf", file, "-C", root, "package"]);
			return { file, name: definition.name, version: actual.version };
		});
		const manifest = createTarballManifest(candidates, dir);
		const manifestPath = path.join(dir, "manifest.json");
		const write = () => writeFileSync(manifestPath, JSON.stringify(manifest));
		write();
		assert.deepEqual(
			resolveReviewedTarballs(manifestPath),
			candidates.map(({ file }) => file),
		);
		const plugin = manifest.packages.pop();
		write();
		assert.throws(() => resolveReviewedTarballs(manifestPath), /exactly 5/);
		manifest.packages.push(plugin);
		[manifest.packages[0], manifest.packages[1]] = [
			manifest.packages[1],
			manifest.packages[0],
		];
		write();
		assert.throws(
			() => resolveReviewedTarballs(manifestPath),
			/order mismatch/,
		);
		[manifest.packages[0], manifest.packages[1]] = [
			manifest.packages[1],
			manifest.packages[0],
		];
		write();
		writeFileSync(candidates.at(-1).file, "changed plugin tarball");
		assert.throws(
			() => resolveReviewedTarballs(manifestPath),
			/SHA-256 mismatch/,
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
