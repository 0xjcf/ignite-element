import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transformSync } from "@babel/core";
import esbuild from "esbuild";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import igniteJsxBabel from "./babel.js";
import igniteEsbuild from "./esbuild.js";
import {
	AUTHOR_STANDALONE,
	AUTHOR_VIRTUAL,
	isOfficialEmittedSpecifier,
	markerCallee,
	markerLocalName,
	transformSource,
} from "./transform.js";
import igniteJsxTypeScript from "./typescript.js";

function packageJson(relative: string) {
	return JSON.parse(
		readFileSync(new URL(relative, import.meta.url), "utf8"),
	) as {
		exports?: Record<string, unknown>;
		typesVersions?: { "*"?: Record<string, unknown> };
	};
}

describe("review findings", () => {
	it("Security P1: does not mark a let or var reassigned to caller data", () => {
		const output = transformSource(
			`
			let css = ".a{background:url(https://evil.example/a.png)}";
			css = props.css;
			var sheet = ".b{background:url(https://evil.example/b.png)}";
			if (props.flag) sheet = props.css;
			let sum = ".c{color:red}";
			sum += props.extra;
			export const view = (
				<div>
					<style>{css}</style>
					<style>{sheet}</style>
					<style>{sum}</style>
				</div>
			);
			`,
			"reassigned.tsx",
		);
		expect(output).not.toContain("igniteAuthorStyle(");
		expect(output).toContain("props.css");
	});

	it("Verifier reassignment chain: does not mark s+=v, an exported setter, or a const alias of let", () => {
		const output = transformSource(
			`
			let live = ".live{color:blue}";
			var old = ".old{color:green}";
			let s = ".s{color:red}";
			s += v;
			var moduleSheet = ".m{background:url(https://evil.example/m.png)}";
			export function setSheet(next: string) {
				moduleSheet = next;
			}
			const alias = live;
			const kept = ".kept{color:red}";
			export const view = (
				<div>
					<style>{live}</style>
					<style>{old}</style>
					<style>{s}</style>
					<style>{moduleSheet}</style>
					<style>{alias}</style>
					<style>{kept}</style>
				</div>
			);
			`,
			"chain.tsx",
		);
		const name = markerCallee(output).replace(/\$/g, "\\$");
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*live\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*old\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*s\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*moduleSheet\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*alias\\s*\\)`));
		expect(output).toMatch(new RegExp(`${name}\\(\\s*kept\\s*\\)`));
	});

	it("Security P2: author-style is not a public typed export and an app import cannot bless CSS", () => {
		const element = packageJson("../../ignite-element/package.json");
		const renderer = packageJson("../../ignite-renderer/package.json");
		expect(element.exports?.["./jsx/author-style"]).toBeUndefined();
		expect(element.typesVersions?.["*"]?.["jsx/author-style"]).toBeUndefined();
		expect(renderer.typesVersions?.["*"]?.["jsx/author-style"]).toBeUndefined();
		expect(renderer.exports?.["./jsx/author-style"]).toBeUndefined();
		expect(renderer.exports?.["./jsx/author-style-mark"]).toBeUndefined();
		const markSource = readFileSync(
			new URL(
				"../../ignite-renderer/src/renderers/jsx/authorStyle.ts",
				import.meta.url,
			),
			"utf8",
		);
		expect(markSource).not.toMatch(/read:\s*readAuthorStyle/);
		const seamSource = readFileSync(
			new URL(
				"../../ignite-renderer/src/renderers/jsx/authorStyleRead.ts",
				import.meta.url,
			),
			"utf8",
		);
		expect(seamSource).not.toContain("igniteAuthorStyle");
		expect(() =>
			transformSource(
				`
				import { igniteAuthorStyle } from "ignite-element/jsx/author-style";
				const evil = igniteAuthorStyle(".a{background:url(https://evil.example/a.png)}");
				export const view = <style>{evil}</style>;
				`,
				"hand-written.tsx",
			),
		).toThrow(/author-style/);
	});

	it("Verifier Babel preset: automatic runtime keeps the jsx import", () => {
		const source = `export function Card() {
			return <div><style>{".a{color:red}"}</style></div>;
		}`;
		const result = transformSync(source, {
			filename: "Card.tsx",
			babelrc: false,
			configFile: false,
			ast: false,
			parserOpts: { plugins: ["typescript", "jsx"] },
			presets: [
				[
					"@babel/preset-react",
					{ runtime: "automatic", importSource: "ignite-element/jsx" },
				],
			],
			plugins: [igniteJsxBabel],
		});
		const code = result?.code ?? "";
		expect(code).toContain("ignite-element/jsx/jsx-runtime");
		expect(code).toContain("igniteAuthorStyle");
		expect(markerCallee(code)).not.toBe("igniteAuthorStyle");
		expect(code).not.toContain("<style>");
	});

	it("states that direct eval makes a marked const assignable", () => {
		const model = readFileSync(
			new URL(
				"../../ignite-renderer/src/renderers/jsx/THREAT-MODEL.md",
				import.meta.url,
			),
			"utf8",
		);
		const bullet = model
			.split("\n")
			.find((line) => line.includes("Direct `eval`"));
		expect(bullet, model).toBeTruthy();
		expect(bullet).toMatch(/esbuild emits that `const` as `var`/);
		expect(bullet).toMatch(/user CSS written into that binding is trusted/);
		expect(bullet?.toLowerCase()).not.toMatch(/minor|theoretical|out of scope/);
	});

	it("P2-5: babel-only and tsc-only fail the build with a clear error", async () => {
		const source = `export const view = <style>{".a{color:red}"}</style>;`;
		const babel = transformSync(source, {
			filename: "alone.tsx",
			babelrc: false,
			configFile: false,
			parserOpts: { plugins: ["typescript", "jsx"] },
			plugins: [igniteJsxBabel],
		});
		const printed = ts.transpileModule(source, {
			fileName: "alone.tsx",
			compilerOptions: {
				jsx: ts.JsxEmit.Preserve,
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
			},
			transformers: { before: [igniteJsxTypeScript()] },
		});
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-standalone-"));
		try {
			for (const [name, code] of [
				["babel.js", babel?.code ?? ""],
				["tsc.js", printed.outputText],
			] as const) {
				expect(code, name).toMatch(/not standalone/);
				expect(code, name).toMatch(/not enough on their own/);
				const file = path.join(dir, name);
				writeFileSync(file, code);
				await expect(
					esbuild.build({
						absWorkingDir: dir,
						entryPoints: [file],
						bundle: true,
						write: false,
						format: "esm",
						platform: "browser",
						logLevel: "silent",
					}),
					name,
				).rejects.toThrow(/not enough on their own/);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("Codex P1: the package does not publish a CommonJS require condition", () => {
		const manifest = JSON.parse(
			readFileSync(new URL("../package.json", import.meta.url), "utf8"),
		) as { exports?: Record<string, { require?: string }> };
		for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
			expect(target.require, subpath).toBeUndefined();
		}
		expect(
			existsSync(new URL("../scripts/build-cjs.mjs", import.meta.url)),
		).toBe(false);
	});

	it("Codex P2: an uppercase Style component and its children stay unchanged", () => {
		const source = `export const view = (
			<div>
				<Style>{"color:red"}</Style>
				<style>{".a{color:red}"}</style>
			</div>
		);`;
		const output = transformSource(source, "Style.tsx");
		expect(output).toContain('<Style>{"color:red"}</Style>');
		expect(output).toMatch(/<style>\{_igniteAuthor\$[0-9a-f]{8}\(/);
		const printed = ts.transpileModule(source, {
			fileName: "Style.tsx",
			compilerOptions: {
				jsx: ts.JsxEmit.Preserve,
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
			},
			transformers: { before: [igniteJsxTypeScript()] },
		});
		expect(printed.outputText).toContain('<Style>{"color:red"}</Style>');
		expect(printed.outputText).not.toMatch(/<Style>\{[^<]*_igniteAuthor\$/);
		expect(printed.outputText).toMatch(
			/<style>\{\s*_igniteAuthor\$[0-9a-f]{8}\(/,
		);
	});

	it("Codex P2: plain TypeScript keeps angle-bracket assertions and import checks", () => {
		for (const filename of ["value.ts", "value.mts", "value.cts"]) {
			const source = "export const v = <number>42;\n";
			expect(transformSource(source, filename), filename).toBe(source);
			expect(
				() =>
					transformSource(
						`import { igniteAuthorStyle } from "ignite-element/jsx/author-style";\nexport const v = <number>42;\n`,
						filename,
					),
				filename,
			).toThrow(/cannot mark CSS/);
		}
		const jsx = `export const view = <style>{".a{color:red}"}</style>;\n`;
		for (const filename of [
			"view.tsx",
			"view.jsx",
			"view.mtsx",
			"view.ctsx",
			"view.mjsx",
			"view.cjsx",
		]) {
			expect(transformSource(jsx, filename), filename).toContain(
				"igniteAuthorStyle",
			);
		}
		const assertion = "export const v = <number>42;\n";
		expect(transformSource(assertion, "notes.tsx.txt")).toBe(assertion);
	});

	it("Codex P2: decorators parse and non-style code stays unmarked", () => {
		const source = "export class Store {\n\t@observable x = 1;\n}\n";
		for (const filename of ["store.ts", "store.tsx"]) {
			expect(transformSource(source, filename), filename).toBe(source);
		}
		const view = `export class Store {
			@observable x = 1;
			view() {
				return <style>{".a{color:red}"}</style>;
			}
		}
		`;
		const output = transformSource(view, "store.tsx");
		expect(output).toContain("@observable");
		expect(output).toContain("igniteAuthorStyle");
		expect(output).toContain("<style>");
	});

	it("Codex P2: a React jsxImportSource file is not rewritten", () => {
		const react = `/** @jsxImportSource react */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(react, "Card.tsx")).toBe(react);
		const ignite = `/** @jsxImportSource ignite-element/jsx */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(ignite, "Card.tsx")).toContain("igniteAuthorStyle");
		const plain = `export const view = <style>{".a{color:red}"}</style>;\n`;
		expect(transformSource(plain, "Card.tsx")).toContain("igniteAuthorStyle");
		expect(() =>
			transformSource(
				`/** @jsxImportSource react */
import { igniteAuthorStyle } from "ignite-element/jsx/author-style";
export const view = <style>{".a{color:red}"}</style>;
`,
				"Card.tsx",
			),
		).toThrow(/cannot mark CSS/);
	});

	it("Codex P2: babel and typescript output works with the bundler plugin", async () => {
		const css = ".a{background:url(http://127.0.0.1:9/adopt.png)}";
		const source = `const local = ${JSON.stringify(css)};
export const view = <style>{local}</style>;
`;
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-adopt-"));
		const file = path.join(dir, "entry.tsx");
		try {
			const babel = transformSync(source, {
				filename: file,
				babelrc: false,
				configFile: false,
				parserOpts: { plugins: ["typescript", "jsx"] },
				plugins: [igniteJsxBabel],
			});
			const babelCode = babel?.code ?? "";
			expect(babelCode).toMatch(/not standalone/);
			const adopted = transformSource(babelCode, file);
			expect(adopted).toContain("igniteAuthorStyle");
			expect(adopted).not.toMatch(/not standalone/);
			expect(adopted).not.toMatch(/not enough on their own/);
			writeFileSync(file, babelCode);
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [file],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
				external: ["ignite-element/jsx/jsx-runtime"],
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			const bundled = result.outputFiles.map((item) => item.text).join("\n");
			expect(bundled).toContain("http://127.0.0.1:9/adopt.png");
			expect(bundled).toContain("ignite-element.authorStyle");
			const printed = ts.transpileModule(source, {
				fileName: file,
				compilerOptions: {
					jsx: ts.JsxEmit.Preserve,
					target: ts.ScriptTarget.ESNext,
					module: ts.ModuleKind.ESNext,
				},
				transformers: { before: [igniteJsxTypeScript()] },
			});
			expect(printed.outputText).toMatch(/not standalone/);
			const adoptedTs = transformSource(printed.outputText, file);
			expect(adoptedTs).not.toMatch(/not standalone/);
			expect(adoptedTs).toContain("igniteAuthorStyle");
			const local = markerLocalName("hand.tsx");
			expect(() =>
				transformSource(
					`import { igniteAuthorStyle as ${local} } from ${JSON.stringify(AUTHOR_STANDALONE)};
export const stolen = ${local}(".a{color:red}");
`,
					"hand.tsx",
				),
			).toThrow(/cannot mark CSS/);
			expect(() =>
				transformSource(
					`import { igniteAuthorStyle as ${local} } from ${JSON.stringify(AUTHOR_STANDALONE)};
export const view = <style>{${local}(props.css)}</style>;
`,
					"hand.tsx",
				),
			).toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("Verifier: a JSX loader marks JSX in .js, .mjs, and .cjs", () => {
		const source = `export const view = <style>{".a{color:red}"}</style>;\n`;
		expect(() => transformSource(source, "entry.js")).toThrow(
			/Unexpected token/,
		);
		for (const filename of ["entry.js", "entry.mjs", "entry.cjs"]) {
			expect(
				transformSource(source, filename, { jsxScript: true }),
				filename,
			).toContain("igniteAuthorStyle");
		}
		const assertion = "export const v = <number>42;\n";
		expect(transformSource(assertion, "value.ts", { jsxScript: true })).toBe(
			assertion,
		);
		expect(transformSource(assertion, "value.mts", { jsxScript: true })).toBe(
			assertion,
		);
		expect(transformSource(assertion, "value.cts", { jsxScript: true })).toBe(
			assertion,
		);
	});

	it("Codex P2: official mark imports stay inside a static style", () => {
		expect(isOfficialEmittedSpecifier(AUTHOR_VIRTUAL)).toBe(true);
		expect(isOfficialEmittedSpecifier(AUTHOR_STANDALONE)).toBe(true);
		expect(
			isOfficialEmittedSpecifier(AUTHOR_VIRTUAL.replace("\0", "\\u0000")),
		).toBe(true);
		expect(
			isOfficialEmittedSpecifier(AUTHOR_STANDALONE.replace("\0", "\\x00")),
		).toBe(true);
		expect(
			isOfficialEmittedSpecifier(AUTHOR_VIRTUAL.replace("\0", "\\0")),
		).toBe(true);
		expect(isOfficialEmittedSpecifier("ignite-jsx:author-style")).toBe(false);
		expect(isOfficialEmittedSpecifier(`${AUTHOR_VIRTUAL}/extra`)).toBe(false);
		expect(isOfficialEmittedSpecifier(`${AUTHOR_STANDALONE} `)).toBe(false);
		expect(isOfficialEmittedSpecifier("")).toBe(false);

		const assertion = "export const v = <number>42;\n";
		expect(
			transformSource(assertion, "notes.js.txt", { jsxScript: true }),
		).toBe(assertion);

		const line = `// @jsxImportSource react
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(line, "Card.tsx")).toBe(line);
		const nested = `/** @jsxImportSource ignite-element/jsx/jsx-runtime */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(nested, "Card.tsx")).toContain("igniteAuthorStyle");
		const spoof = `/** @jsxImportSource react/ignite-element/jsx/ */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(spoof, "Card.tsx")).toBe(spoof);
		const evil = `/** @jsxImportSource ignite-element/jsx-evil */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(evil, "Card.tsx")).toBe(evil);
		const reactBabel = transformSync(
			`/** @jsxImportSource react */
export const view = <style>{".a{color:red}"}</style>;
`,
			{
				filename: "Card.tsx",
				babelrc: false,
				configFile: false,
				parserOpts: { plugins: ["typescript", "jsx"] },
				plugins: [igniteJsxBabel],
			},
		);
		expect(reactBabel?.code ?? "").not.toContain("igniteAuthorStyle");

		const filename = "hand.tsx";
		const local = markerLocalName(filename);
		const from = (body: string, source = AUTHOR_STANDALONE) =>
			`import { igniteAuthorStyle as ${local} } from ${JSON.stringify(source)};\n${body}`;
		expect(
			transformSource(
				from(`export const view = (
					<style>
						{${local}(".a{color:red}")}
					</style>
				);`),
				filename,
			),
		).not.toMatch(/not standalone/);
		expect(
			transformSource(
				from(`const color = "red";
export const view = <style>{${local}(".a{color:" + color + "}")}</style>;`),
				filename,
			),
		).toContain('".a{color:"');
		const both = transformSource(
			from(`export const view = (
				<div>
					<style>{${local}(".a{color:red}")}</style>
					<style>{".b{color:blue}"}</style>
				</div>
			);`),
			filename,
		);
		expect(both).toContain(".b{color:blue}");
		expect(both.match(/_igniteAuthor\$/g)?.length).toBe(3);
		for (const body of [
			from(`export const stolen = ${local}(".a{color:red}");`),
			from(`export const view = <div>{${local}(".a{color:red}")}</div>;`),
			from(`export const view = <Style>{${local}(".a{color:red}")}</Style>;`),
			from(`export const view = <style>{${local}()}</style>;`),
			from(
				`export const view = <style>{${local}(".a{color:red}", ".b{}")}</style>;`,
			),
			from(
				`export const view = <style>{${local}(".a{color:red}")}{"x"}</style>;`,
			),
			from(`export const view = <style>{other(${local})}</style>;`),
			from(
				`export const view = <style>{${local}(".a{color:" + props.css)}</style>;`,
			),
			`import type { igniteAuthorStyle as ${local} } from ${JSON.stringify(AUTHOR_STANDALONE)};
export const view = <style>{".a{color:red}"}</style>;`,
			`import { igniteAuthorStyle as nope } from ${JSON.stringify(AUTHOR_STANDALONE)};
export const view = <style>{nope(".a{color:red}")}</style>;`,
			`import { igniteAuthorStyle as ${local}, extra } from ${JSON.stringify(AUTHOR_STANDALONE)};
export const view = <style>{${local}(".a{color:red}")}</style>;`,
			`import * as ns from ${JSON.stringify(AUTHOR_STANDALONE)};
export const view = <style>{".a{color:red}"}</style>;`,
		]) {
			expect(() => transformSource(body, filename), body).toThrow(
				/cannot mark CSS/,
			);
		}
	});

	it("Security P3: the jsx plugin build removes dist before tsc", async () => {
		const manifest = JSON.parse(
			readFileSync(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts?: { build?: string } };
		expect(manifest.scripts?.build ?? "").toContain(
			"node scripts/clean-dist.mjs",
		);
		const { removePackageDist } = (await import(
			"../scripts/clean-dist.mjs"
		)) as { removePackageDist: (dir: string) => void };
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-dist-clean-"));
		try {
			writeFileSync(path.join(dir, "orphan.cjs"), "module.exports = {};\n");
			writeFileSync(path.join(dir, "keep.js"), "export {};\n");
			removePackageDist(dir);
			expect(existsSync(dir)).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("does not call babel or typescript enough on their own", () => {
		const note = readFileSync(
			new URL("../../../.changeset/jsx-xss-guards.md", import.meta.url),
			"utf8",
		);
		expect(note).toMatch(/not standalone/);
		expect(note).toMatch(/not enough on their own/);
	});
});
