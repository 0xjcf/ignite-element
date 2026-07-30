import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkRules, listSourceFiles } from "../check-architecture-rules.mjs";
import { analyzeSource, parseCliArgs } from "../migrate-emit-to-effects.mjs";

const tempDirectories = [];

afterEach(() => {
	while (tempDirectories.length > 0) {
		fs.rmSync(tempDirectories.pop(), { recursive: true, force: true });
	}
});

function createTempDirectory(prefix) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirectories.push(directory);
	return directory;
}

describe("migrate-emit-to-effects", () => {
	it("rejects a missing --report path before later flags", () => {
		expect(() => parseCliArgs(["--report"])).toThrow(
			"`--report` requires a file path argument before any other flags.",
		);
		expect(() => parseCliArgs(["src", "--report", "--verbose"])).toThrow(
			"`--report` requires a file path argument before any other flags.",
		);
	});

	it("detects long destructured command parameters and ignores braces in common syntax", () => {
		const source = `
			const machine = igniteCore({
				commands: (
					{
						actor,
						command,
						host,
						emit,
						veryLongPropertyNameOne,
						veryLongPropertyNameTwo,
						nested: {
							formatter = () => ({ brace: "}" }),
						},
					},
				) => {
					const message = "ignore this } brace";
					const template = \`template keeps } literal and \${actor.getSnapshot()}\`;
					const pattern = /\\}\\)$/g;
					const object = { open: true };
					// emit("commented")
					/* emit("also commented") */
					emit("active");
					return { message, template, pattern, object };
				},
			});
		`;

		const findings = analyzeSource(source);

		expect(findings).toHaveLength(2);
		expect(findings.map((finding) => finding.type)).toEqual([
			"command-context",
			"emit-call",
		]);
	});

	it("detects expression-body command objects that contain emit calls", () => {
		const source = `
			const machine = igniteCore({
				commands: ({ actor, emit }) => ({
					toggle: () => {
						actor.send({ type: "TOGGLE" });
						emit("toggled", { isOn: true });
					},
				}),
			});
		`;

		const findings = analyzeSource(source);

		expect(findings).toHaveLength(2);
		expect(findings.map((finding) => finding.type)).toEqual([
			"command-context",
			"emit-call",
		]);
	});

	it("detects bare optional-chained emit calls inside commands", () => {
		const source = `
			const machine = igniteCore({
				commands: ({ emit }) => ({
					toggle: () => {
						emit?.("toggled", { isOn: true });
					},
				}),
			});
		`;

		const findings = analyzeSource(source);

		expect(findings).toHaveLength(2);
		expect(findings.map((finding) => finding.type)).toEqual([
			"command-context",
			"emit-call",
		]);
	});

	it("detects bare emit calls inside template interpolations in commands", () => {
		const source = `
			const machine = igniteCore({
				commands: ({ emit }) => ({
					toggle: () => {
						const label = \`literal emit("ignored") \${emit("templated")}\`;
						return label;
					},
				}),
			});
		`;

		const findings = analyzeSource(source);

		expect(findings).toHaveLength(2);
		expect(findings.map((finding) => finding.type)).toEqual([
			"command-context",
			"emit-call",
		]);
	});

	it("ignores member-access methods named emit inside commands", () => {
		const source = `
			const machine = igniteCore({
				commands: ({ emit, logger }) => ({
					toggle: () => {
						logger.emit("toggled");
						logger?.emit("optional");
						logger.emit?.("optional-call");
						logger . emit("spaced");
					},
				}),
			});
		`;

		const findings = analyzeSource(source);

		expect(findings).toHaveLength(1);
		expect(findings[0].type).toBe("command-context");
	});

	it("ignores commands snippets inside comments, strings, and template text", () => {
		const source = [
			'// commands: ({ emit }) => ({ run: () => emit("x") })',
			'/* commands: ({ emit }) => ({ run: () => emit("x") }) */',
			'const quoted = "commands: ({ emit }) => ({ run: () => emit(\\"x\\") })";',
			'const template = `commands: ({ emit }) => ({ run: () => emit("x") })`;',
		].join("\n");

		expect(analyzeSource(source)).toEqual([]);
	});
});

describe("check-architecture-rules", () => {
	it("follows a symlinked root once while walking source files", () => {
		const root = createTempDirectory("ignite-architecture-");
		const sourceDirectory = path.join(root, "actual-src");
		const nestedDirectory = path.join(sourceDirectory, "nested");
		const symlinkedSourceDirectory = path.join(root, "linked-src");
		fs.mkdirSync(nestedDirectory, { recursive: true });
		fs.writeFileSync(path.join(sourceDirectory, "entry.ts"), "export {};\n");
		fs.writeFileSync(path.join(nestedDirectory, "child.ts"), "export {};\n");
		fs.symlinkSync(sourceDirectory, symlinkedSourceDirectory);

		const files = listSourceFiles(symlinkedSourceDirectory)
			.map((filePath) => path.relative(fs.realpathSync(root), filePath))
			.sort();

		expect(files).toEqual([
			"actual-src/entry.ts",
			"actual-src/nested/child.ts",
		]);
	});

	it("skips symlinks while walking source files", () => {
		const root = createTempDirectory("ignite-architecture-");
		const sourceDirectory = path.join(root, "src");
		const nestedDirectory = path.join(sourceDirectory, "nested");
		fs.mkdirSync(nestedDirectory, { recursive: true });
		fs.writeFileSync(path.join(sourceDirectory, "entry.ts"), "export {};\n");
		fs.writeFileSync(path.join(nestedDirectory, "child.ts"), "export {};\n");
		fs.symlinkSync(sourceDirectory, path.join(sourceDirectory, "loop"));

		const files = listSourceFiles(sourceDirectory)
			.map((filePath) => path.relative(root, filePath))
			.sort();

		expect(files).toEqual(["src/entry.ts", "src/nested/child.ts"]);
	});

	it("flags direct environmental imports from deterministic source modules", () => {
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

		expect(violations).toEqual([
			"deterministic-source-no-node-fs: packages/core/src/counter.ts imports node:fs -> node:fs",
		]);
	});

	it("flags workspace package alias imports into forbidden adapter sources", () => {
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
				[
					"@ignite/runtime-adapter",
					path.join(root, "packages/runtime-adapter"),
				],
			]),
		);

		expect(violations).toEqual([
			"deterministic-source-no-adapters: packages/core/src/counter.ts imports @ignite/runtime-adapter/fs -> packages/runtime-adapter/src/fs.ts",
		]);
	});

	it("flags barrel entrypoints that resolve into forbidden adapter sources", () => {
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
				[
					"@ignite/runtime-adapter",
					path.join(root, "packages/runtime-adapter"),
				],
			]),
		);

		expect(violations).toEqual([
			"deterministic-source-no-adapters: packages/core/src/counter.ts imports @ignite/runtime-adapter -> packages/runtime-adapter/src/index.ts",
		]);
	});

	it("flags dynamic environmental imports from deterministic source modules", () => {
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

		expect(violations).toEqual([
			"deterministic-source-no-node-fs: packages/core/src/counter.ts imports node:fs -> node:fs",
		]);
	});

	it("does not flag legitimate adapter imports outside deterministic source roots", () => {
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

		expect(violations).toEqual([]);
	});
});
