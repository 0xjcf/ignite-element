import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const node = process.execPath;

const expectedExampleRoots = [
	"examples/adapters/mobx",
	"examples/adapters/redux",
	"examples/adapters/xstate",
	"examples/agents/smart-home",
	"examples/agents/voice-workbench",
	"examples/apps/dashboard-with-shared-state",
	"examples/apps/form-with-validation",
	"examples/apps/nested-child-router",
	"examples/apps/spa-router",
	"examples/frameworks/react",
	"examples/frameworks/svelte",
	"examples/frameworks/vue",
];

function writeFakeTypeScript(exampleRoot, script = "process.exit(0);\n") {
	const typescriptBin = path.join(
		exampleRoot,
		"node_modules",
		"typescript",
		"bin",
	);
	mkdirSync(typescriptBin, { recursive: true });
	writeFileSync(path.join(typescriptBin, "tsc"), script);
}

describe("typecheck-examples", () => {
	it("discovers self-contained example packages", () => {
		const output = execFileSync(
			node,
			["scripts/typecheck-examples.mjs", "--list"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("supports equals syntax for the examples root", () => {
		const output = execFileSync(
			node,
			["scripts/typecheck-examples.mjs", "--list", "--examples-root=examples"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("supports space-separated install mode syntax", () => {
		const output = execFileSync(
			node,
			["scripts/typecheck-examples.mjs", "--list", "--install", "missing"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("rejects invalid options", () => {
		assert.throws(
			() =>
				execFileSync(
					node,
					["scripts/typecheck-examples.mjs", "--examples-root", "--list"],
					{
						encoding: "utf8",
						stderr: "pipe",
					},
				),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(String(error.stderr), /--examples-root requires a path\./);
				return true;
			},
		);

		assert.throws(
			() =>
				execFileSync(
					node,
					["scripts/typecheck-examples.mjs", "--install=prompt"],
					{
						encoding: "utf8",
						stderr: "pipe",
					},
				),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(
					String(error.stderr),
					/--install must be one of: always, missing, never\./,
				);
				return true;
			},
		);

		assert.throws(
			() =>
				execFileSync(node, ["scripts/typecheck-examples.mjs", "--install"], {
					encoding: "utf8",
					stderr: "pipe",
				}),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(
					String(error.stderr),
					/--install requires a value \(always, missing, or never\)\./,
				);
				return true;
			},
		);
	});

	it("reports a clean error when the examples root is missing", () => {
		const missingRoot = path.join(
			mkdtempSync(path.join(tmpdir(), "ignite-missing-examples-")),
			"missing",
		);

		try {
			assert.throws(
				() =>
					execFileSync(
						node,
						["scripts/typecheck-examples.mjs", "--examples-root", missingRoot],
						{
							encoding: "utf8",
							stderr: "pipe",
						},
					),
				(error) => {
					assert.equal(error.status, 1);
					assert.match(
						String(error.stderr),
						/Unable to read examples root .*missing/,
					);
					return true;
				},
			);
		} finally {
			rmSync(path.dirname(missingRoot), { force: true, recursive: true });
		}
	});

	it("reports a clean error when an examples category cannot be read", async () => {
		const { discoverExampleRoots } = await import("../typecheck-examples.mjs");
		const examplesRoot = path.join(tmpdir(), "ignite-examples");

		await assert.rejects(
			() =>
				discoverExampleRoots(examplesRoot, {
					readdir: async (target) => {
						if (target === examplesRoot) {
							return [{ name: "apps", isDirectory: () => true }];
						}
						throw new Error("mock category read failure");
					},
					fail: (message) => {
						throw new Error(message);
					},
				}),
			/Unable to read examples category .*apps.*mock category read failure/,
		);
	});

	it("reports a clean error when pnpm cannot be spawned", () => {
		const examplesRoot = mkdtempSync(
			path.join(tmpdir(), "ignite-missing-pnpm-"),
		);
		const exampleRoot = path.join(examplesRoot, "apps", "sample");
		mkdirSync(exampleRoot, { recursive: true });
		writeFileSync(
			path.join(exampleRoot, "package.json"),
			JSON.stringify({ name: "sample", scripts: { typecheck: "tsc" } }),
		);
		writeFileSync(path.join(exampleRoot, "tsconfig.json"), "{}");
		const env = { ...process.env, PATH: "", Path: "" };

		try {
			assert.throws(
				() =>
					execFileSync(
						node,
						[
							"scripts/typecheck-examples.mjs",
							"--examples-root",
							examplesRoot,
							"--install=always",
						],
						{
							encoding: "utf8",
							env,
							stderr: "pipe",
						},
					),
				(error) => {
					assert.equal(error.status, 1);
					assert.match(
						String(error.stderr),
						/Failed to run pnpm install in .*sample/,
					);
					return true;
				},
			);
		} finally {
			rmSync(examplesRoot, { force: true, recursive: true });
		}
	});

	it("runs each example with its local TypeScript compiler", () => {
		const tempRoot = mkdtempSync(path.join(tmpdir(), "ignite-local-tsc-"));
		const examplesRoot = path.join(tempRoot, "examples");
		const exampleRoot = path.join(examplesRoot, "apps", "sample");
		const markerFile = path.join(tempRoot, "local-tsc-ran");

		mkdirSync(path.join(exampleRoot, "src"), { recursive: true });
		writeFileSync(
			path.join(exampleRoot, "package.json"),
			JSON.stringify({ name: "sample", scripts: { typecheck: "tsc" } }),
		);
		writeFileSync(path.join(exampleRoot, "tsconfig.json"), "{}");
		writeFakeTypeScript(
			exampleRoot,
			`import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(
				markerFile,
			)}, "ok\\n");\n`,
		);

		try {
			execFileSync(
				node,
				[
					"scripts/typecheck-examples.mjs",
					"--examples-root",
					examplesRoot,
					"--install=never",
				],
				{
					encoding: "utf8",
				},
			);

			assert.equal(existsSync(markerFile), true);
		} finally {
			rmSync(tempRoot, { force: true, recursive: true });
		}
	});

	it("reinstalls missing dependencies when node_modules lacks an install marker", () => {
		const tempRoot = mkdtempSync(path.join(tmpdir(), "ignite-stale-install-"));
		const fakeBin = path.join(tempRoot, "bin");
		const examplesRoot = path.join(tempRoot, "examples");
		const exampleRoot = path.join(examplesRoot, "apps", "sample");
		const fakePnpm = path.join(fakeBin, "pnpm");
		const installMarker = path.join(tempRoot, "install-ran");

		mkdirSync(path.join(exampleRoot, "src"), { recursive: true });
		mkdirSync(fakeBin, { recursive: true });
		writeFileSync(
			path.join(exampleRoot, "package.json"),
			JSON.stringify({ name: "sample", scripts: { typecheck: "tsc" } }),
		);
		writeFileSync(path.join(exampleRoot, "tsconfig.json"), "{}");
		writeFakeTypeScript(exampleRoot);
		writeFileSync(
			fakePnpm,
			'#!/bin/sh\nprintf ok > "$INSTALL_MARKER"\nmkdir -p node_modules\n',
		);
		chmodSync(fakePnpm, 0o755);

		try {
			execFileSync(
				node,
				[
					"scripts/typecheck-examples.mjs",
					"--examples-root",
					examplesRoot,
					"--install=missing",
				],
				{
					encoding: "utf8",
					env: {
						...process.env,
						INSTALL_MARKER: installMarker,
						PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
					},
				},
			);

			assert.equal(existsSync(installMarker), true);
		} finally {
			rmSync(tempRoot, { force: true, recursive: true });
		}
	});

	it("removes lockfiles created by the example install flow", () => {
		const tempRoot = mkdtempSync(
			path.join(tmpdir(), "ignite-generated-lockfile-"),
		);
		const fakeBin = path.join(tempRoot, "bin");
		const examplesRoot = path.join(tempRoot, "examples");
		const exampleRoot = path.join(examplesRoot, "apps", "sample");
		const fakePnpm = path.join(fakeBin, "pnpm");

		mkdirSync(path.join(exampleRoot, "src"), { recursive: true });
		mkdirSync(fakeBin, { recursive: true });
		writeFileSync(
			path.join(exampleRoot, "package.json"),
			JSON.stringify({ name: "sample", scripts: { typecheck: "tsc" } }),
		);
		writeFileSync(
			path.join(exampleRoot, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					module: "ESNext",
					moduleResolution: "Bundler",
					strict: true,
					target: "ES2022",
				},
				include: ["src/**/*.ts"],
			}),
		);
		writeFileSync(path.join(exampleRoot, "src", "index.ts"), "export {};\n");
		writeFakeTypeScript(exampleRoot);
		writeFileSync(
			fakePnpm,
			"#!/bin/sh\ncase \" $* \" in *' --no-frozen-lockfile '*) ;; *) exit 42 ;; esac\nprintf 'lockfileVersion: \"9.0\"\\n' > pnpm-lock.yaml\nmkdir -p node_modules\n",
		);
		chmodSync(fakePnpm, 0o755);

		try {
			execFileSync(
				node,
				[
					"scripts/typecheck-examples.mjs",
					"--examples-root",
					examplesRoot,
					"--install=always",
				],
				{
					encoding: "utf8",
					env: {
						...process.env,
						PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
					},
				},
			);

			assert.equal(existsSync(path.join(exampleRoot, "pnpm-lock.yaml")), false);
		} finally {
			rmSync(tempRoot, { force: true, recursive: true });
		}
	});

	it("uses frozen lockfile validation when an example lockfile exists", () => {
		const tempRoot = mkdtempSync(
			path.join(tmpdir(), "ignite-existing-lockfile-"),
		);
		const fakeBin = path.join(tempRoot, "bin");
		const examplesRoot = path.join(tempRoot, "examples");
		const exampleRoot = path.join(examplesRoot, "apps", "sample");
		const fakePnpm = path.join(fakeBin, "pnpm");

		mkdirSync(path.join(exampleRoot, "src"), { recursive: true });
		mkdirSync(fakeBin, { recursive: true });
		writeFileSync(
			path.join(exampleRoot, "package.json"),
			JSON.stringify({ name: "sample", scripts: { typecheck: "tsc" } }),
		);
		writeFileSync(
			path.join(exampleRoot, "pnpm-lock.yaml"),
			"lockfileVersion: '9.0'\n",
		);
		writeFileSync(
			path.join(exampleRoot, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					module: "ESNext",
					moduleResolution: "Bundler",
					strict: true,
					target: "ES2022",
				},
				include: ["src/**/*.ts"],
			}),
		);
		writeFileSync(path.join(exampleRoot, "src", "index.ts"), "export {};\n");
		writeFakeTypeScript(exampleRoot);
		writeFileSync(
			fakePnpm,
			"#!/bin/sh\ncase \" $* \" in *' --frozen-lockfile '*) ;; *) exit 42 ;; esac\nmkdir -p node_modules\n",
		);
		chmodSync(fakePnpm, 0o755);

		try {
			execFileSync(
				node,
				[
					"scripts/typecheck-examples.mjs",
					"--examples-root",
					examplesRoot,
					"--install=always",
				],
				{
					encoding: "utf8",
					env: {
						...process.env,
						PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
					},
				},
			);

			assert.equal(existsSync(path.join(exampleRoot, "pnpm-lock.yaml")), true);
		} finally {
			rmSync(tempRoot, { force: true, recursive: true });
		}
	});
});
