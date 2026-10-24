import { readFileSync } from "node:fs";
import { transformSync } from "@babel/core";
import { describe, expect, it } from "vitest";
import igniteJsxBabel from "./babel.js";
import { transformSource } from "./transform.js";

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
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*live\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*old\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*s\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*moduleSheet\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*alias\s*\)/);
		expect(output).toMatch(/igniteAuthorStyle\(\s*kept\s*\)/);
	});

	it("Security P2: author-style is not a public typed export and an app import cannot bless CSS", () => {
		const element = packageJson("../../ignite-element/package.json");
		const renderer = packageJson("../../ignite-renderer/package.json");
		expect(element.exports?.["./jsx/author-style"]).toBeUndefined();
		expect(element.typesVersions?.["*"]?.["jsx/author-style"]).toBeUndefined();
		expect(renderer.typesVersions?.["*"]?.["jsx/author-style"]).toBeUndefined();
		expect(renderer.exports?.["./jsx/author-style-mark"]).toBeUndefined();
		expect(
			JSON.stringify(renderer.exports?.["./jsx/author-style"] ?? {}),
		).not.toContain('"types"');
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
		expect(code).not.toContain("<style>");
	});
});
