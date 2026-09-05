import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const site = fileURLToPath(new URL("../", import.meta.url));
const temporary = fs.mkdtempSync(path.join(site, ".connected-examples-"));
const files = [];
const blocks = (name) =>
	[
		...fs
			.readFileSync(path.join(site, "src/content/docs", name), "utf8")
			.matchAll(/^```(?:ts|tsx)[^\n]*\n([\s\S]*?)^```/gm),
	].map((match) => match[1]);
function write(name, source) {
	const file = path.join(temporary, name);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, source);
	if (/\.tsx?$/.test(file)) files.push(file);
}
function testBody(name, sources) {
	const imports = new Set();
	const bodies = sources.map((code) => {
		const source = ts.createSourceFile(
			"example.tsx",
			code,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		for (const statement of source.statements) {
			if (ts.isImportDeclaration(statement))
				imports.add(statement.getText(source));
		}
		return source.statements
			.filter((statement) => !ts.isImportDeclaration(statement))
			.map((statement) => statement.getText(source))
			.join("\n");
	});
	return `import { it } from 'vitest';\n${[...imports].join("\n")}\nit(${JSON.stringify(name)}, async () => {\n${bodies.join("\n")}\n});\n`;
}

try {
	const host = blocks("guides/host-app-integration.mdx");
	assert.match(host[0], /toggle-machine\.ts/);
	assert.match(host[1], /register-ignite\.tsx/);
	write("host/toggle-machine.ts", host[0]);
	write("host/register-ignite.tsx", host[1]);
	const handleImport = host[2].match(
		/import \{ Toggle as ToggleEl \} from ['"]\.\/register-ignite['"];?/,
	);
	assert.ok(
		handleImport,
		"The documented wrapper must import its exported registration handle",
	);
	write(
		"host/registration.test.ts",
		`import { it, expect } from 'vitest';
${handleImport[0]}
it('documented registration exports the wrapper handle and renders', async () => {
  expect(ToggleEl.tagName).toBe('ignite-toggle');
  expect(ToggleEl.getSchema().commands).toHaveProperty('toggle');
  const element = document.createElement(ToggleEl.tagName);
  document.body.append(element);
  try {
    await Promise.resolve();
    const button = element.shadowRoot?.querySelector('button');
    if (!button) throw new Error('Missing registered toggle button');
    expect(button.textContent).toBe('Off');
    button.click();
    await Promise.resolve();
    expect(element.shadowRoot?.textContent).toContain('On');
  } finally { element.remove(); }
});`,
	);

	// Byte-identical application prerequisites from the immutable beta.11 commit
	// e2eb1517c8818a16a3142ff2c2b6c534674625d4, not copies of corrected doc code.
	const routerFixtures = {
		"matchRoute.ts": "09d62d22b5e86ed01fbecab89b15ada11787d29f",
		"navigation.ts": "eb6aac9922a458e57284502af57a854503e38f52",
		"routerMachine.ts": "39a9e18529c8559acfcf8059e1b24e796cbcb1e5",
		"routerSource.ts": "70c4150aa1167800511c663d700cd6810de4fe50",
		"routes.ts": "4b116fec2b78a87075af833f53c29004e2830d72",
	};
	for (const [name, oid] of Object.entries(routerFixtures)) {
		const source = fs.readFileSync(
			new URL(`fixtures/router-beta11/${name}`, import.meta.url),
		);
		assert.equal(
			createHash("sha1")
				.update(`blob ${source.length}\0`)
				.update(source)
				.digest("hex"),
			oid,
		);
		write(`router/${name}`, source);
	}
	const router = blocks("guides/routing.mdx").find((code) =>
		code.includes("await router.execute"),
	);
	assert.ok(router, "Missing headless router example");
	write(
		"router/navigation.test.ts",
		testBody("documented router navigate command", [router]),
	);
	const testing = blocks("api/testing-dsl.mdx");
	for (const [name, code] of [
		["scenario", testing[1]],
		["story", testing[2]],
		["runtime-story", testing[3]],
		["trace", testing[4]],
		["bridge", testing[5]],
	]) {
		write(
			`toggle/${name}.test.tsx`,
			testBody(`documented toggle ${name}`, [testing[0], code]),
		);
	}

	const program = ts.createProgram(files, {
		strict: true,
		skipLibCheck: false,
		noEmit: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		jsx: ts.JsxEmit.ReactJSX,
		jsxImportSource: "ignite-element/jsx",
		esModuleInterop: true,
	});
	const diagnostics = ts.getPreEmitDiagnostics(program);
	if (diagnostics.length)
		throw new Error(
			ts.formatDiagnosticsWithColorAndContext(diagnostics, {
				getCurrentDirectory: () => site,
				getCanonicalFileName: (name) => name,
				getNewLine: () => "\n",
			}),
		);
	console.log(
		`Strict beta.11 connected declarations: ${files.length} files; skipLibCheck=false; no ambient scaffolding.`,
	);
	write(
		"vitest.config.mjs",
		`import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic', jsxImportSource: 'ignite-element/jsx' }, test: {
  root: ${JSON.stringify(temporary)}, include: ['**/*.test.ts', '**/*.test.tsx'], environment: 'jsdom',
  maxWorkers: 1, fileParallelism: false, testTimeout: 5000,
} });`,
	);
	const vitestPackage = require.resolve("vitest/package.json");
	const vitestBin = path.resolve(
		path.dirname(vitestPackage),
		JSON.parse(fs.readFileSync(vitestPackage, "utf8")).bin.vitest,
	);
	const result = spawnSync(
		process.execPath,
		[vitestBin, "run", "--config", path.join(temporary, "vitest.config.mjs")],
		{ cwd: site, stdio: "inherit" },
	);
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`Connected runtime examples failed (${result.status})`);
} finally {
	fs.rmSync(temporary, { recursive: true, force: true });
}
