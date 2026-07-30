import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkRules } from "../check-architecture-rules.mjs";

const tempDirectories = [];

test.afterEach(() => {
	while (tempDirectories.length > 0) {
		fs.rmSync(tempDirectories.pop(), { recursive: true, force: true });
	}
});

function createTempDirectory(prefix) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirectories.push(directory);
	return directory;
}

test("flags direct environmental imports from deterministic source modules", () => {
	const root = createTempDirectory("ignite-architecture-");
	const deterministicSourceDirectory = path.join(root, "packages/core/src");
	const rulesPath = path.join(root, "architecture-rules.json");
	fs.mkdirSync(deterministicSourceDirectory, { recursive: true });
	fs.writeFileSync(
		path.join(deterministicSourceDirectory, "counter.ts"),
		'import fs from "node:fs";\nexport const readCounter = () => fs.readFileSync("counter.txt", "utf8");\n',
	);
	fs.writeFileSync(
		rulesPath,
		JSON.stringify(
			{
				rules: [
					{
						name: "deterministic-source-no-node-fs",
						from: "packages/core/src",
						cannotImport: "node:fs",
					},
				],
			},
			null,
			2,
		),
	);

	const violations = checkRules(root, rulesPath, new Map());

	assert.deepEqual(violations, [
		"deterministic-source-no-node-fs: packages/core/src/counter.ts imports node:fs -> node:fs",
	]);
});

test("flags workspace package alias imports into forbidden adapter sources", () => {
	const root = createTempDirectory("ignite-architecture-");
	const deterministicSourceDirectory = path.join(root, "packages/core/src");
	const adapterSourceDirectory = path.join(
		root,
		"packages/runtime-adapter/src",
	);
	const rulesPath = path.join(root, "architecture-rules.json");
	fs.mkdirSync(deterministicSourceDirectory, { recursive: true });
	fs.mkdirSync(adapterSourceDirectory, { recursive: true });
	fs.writeFileSync(
		path.join(root, "packages/runtime-adapter/package.json"),
		JSON.stringify({ name: "@ignite/runtime-adapter" }, null, 2),
	);
	fs.writeFileSync(
		path.join(adapterSourceDirectory, "fs.ts"),
		'export const readCounter = () => "adapter";\n',
	);
	fs.writeFileSync(
		path.join(deterministicSourceDirectory, "counter.ts"),
		'import { readCounter } from "@ignite/runtime-adapter/fs";\nexport { readCounter };\n',
	);
	fs.writeFileSync(
		rulesPath,
		JSON.stringify(
			{
				rules: [
					{
						name: "deterministic-source-no-adapters",
						from: "packages/core/src",
						cannotImport: "packages/runtime-adapter/src",
					},
				],
			},
			null,
			2,
		),
	);

	const violations = checkRules(
		root,
		rulesPath,
		new Map([
			["@ignite/runtime-adapter", path.join(root, "packages/runtime-adapter")],
		]),
	);

	assert.deepEqual(violations, [
		"deterministic-source-no-adapters: packages/core/src/counter.ts imports @ignite/runtime-adapter/fs -> packages/runtime-adapter/src/fs.ts",
	]);
});

test("flags barrel entrypoints that resolve into forbidden adapter sources", () => {
	const root = createTempDirectory("ignite-architecture-");
	const deterministicSourceDirectory = path.join(root, "packages/core/src");
	const adapterSourceDirectory = path.join(
		root,
		"packages/runtime-adapter/src",
	);
	const rulesPath = path.join(root, "architecture-rules.json");
	fs.mkdirSync(deterministicSourceDirectory, { recursive: true });
	fs.mkdirSync(adapterSourceDirectory, { recursive: true });
	fs.writeFileSync(
		path.join(root, "packages/runtime-adapter/package.json"),
		JSON.stringify({ name: "@ignite/runtime-adapter" }, null, 2),
	);
	fs.writeFileSync(
		path.join(adapterSourceDirectory, "index.ts"),
		'export { readCounter } from "./fs";\n',
	);
	fs.writeFileSync(
		path.join(adapterSourceDirectory, "fs.ts"),
		'export const readCounter = () => "adapter";\n',
	);
	fs.writeFileSync(
		path.join(deterministicSourceDirectory, "counter.ts"),
		'import { readCounter } from "@ignite/runtime-adapter";\nexport { readCounter };\n',
	);
	fs.writeFileSync(
		rulesPath,
		JSON.stringify(
			{
				rules: [
					{
						name: "deterministic-source-no-adapters",
						from: "packages/core/src",
						cannotImport: "packages/runtime-adapter/src",
					},
				],
			},
			null,
			2,
		),
	);

	const violations = checkRules(
		root,
		rulesPath,
		new Map([
			["@ignite/runtime-adapter", path.join(root, "packages/runtime-adapter")],
		]),
	);

	assert.deepEqual(violations, [
		"deterministic-source-no-adapters: packages/core/src/counter.ts imports @ignite/runtime-adapter -> packages/runtime-adapter/src/index.ts",
	]);
});

test("flags dynamic environmental imports from deterministic source modules", () => {
	const root = createTempDirectory("ignite-architecture-");
	const deterministicSourceDirectory = path.join(root, "packages/core/src");
	const rulesPath = path.join(root, "architecture-rules.json");
	fs.mkdirSync(deterministicSourceDirectory, { recursive: true });
	fs.writeFileSync(
		path.join(deterministicSourceDirectory, "counter.ts"),
		'export const readCounter = async () => import("node:fs");\n',
	);
	fs.writeFileSync(
		rulesPath,
		JSON.stringify(
			{
				rules: [
					{
						name: "deterministic-source-no-node-fs",
						from: "packages/core/src",
						cannotImport: "node:fs",
					},
				],
			},
			null,
			2,
		),
	);

	const violations = checkRules(root, rulesPath, new Map());

	assert.deepEqual(violations, [
		"deterministic-source-no-node-fs: packages/core/src/counter.ts imports node:fs -> node:fs",
	]);
});

test("does not flag legitimate adapter imports outside deterministic source roots", () => {
	const root = createTempDirectory("ignite-architecture-");
	const deterministicSourceDirectory = path.join(root, "packages/core/src");
	const adapterSourceDirectory = path.join(
		root,
		"packages/runtime-adapter/src",
	);
	const rulesPath = path.join(root, "architecture-rules.json");
	fs.mkdirSync(deterministicSourceDirectory, { recursive: true });
	fs.mkdirSync(adapterSourceDirectory, { recursive: true });
	fs.writeFileSync(
		path.join(deterministicSourceDirectory, "counter.ts"),
		"export const readCounter = () => 1;\n",
	);
	fs.writeFileSync(
		path.join(adapterSourceDirectory, "fs.ts"),
		'import fs from "node:fs";\nexport const readCounter = () => fs.readFileSync("counter.txt", "utf8");\n',
	);
	fs.writeFileSync(
		rulesPath,
		JSON.stringify(
			{
				rules: [
					{
						name: "deterministic-source-no-node-fs",
						from: "packages/core/src",
						cannotImport: "node:fs",
					},
				],
			},
			null,
			2,
		),
	);

	const violations = checkRules(root, rulesPath, new Map());

	assert.deepEqual(violations, []);
});
