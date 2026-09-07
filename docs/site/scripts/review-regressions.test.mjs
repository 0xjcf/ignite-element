import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { cli, siteRoot, withSite } from "./review-fixtures.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { JSDOM } = require("jsdom");

test("actual counter handles one command per click after reconnection", () => {
	const source = fs.readFileSync(
		path.join(siteRoot, "src/components/CounterDemo.astro"),
		"utf8",
	);
	const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
	const markup = source.match(/<docs-counter[\s\S]*?<\/docs-counter>/)[0];
	const dom = new JSDOM(markup, { runScripts: "outside-only" });
	try {
		dom.window.eval(
			ts.transpileModule(script, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 },
			}).outputText,
		);
		const element = dom.window.document.querySelector("docs-counter");
		for (let i = 0; i < 3; i++) {
			element.remove();
			dom.window.document.body.append(element);
		}
		element.querySelector('[data-command="INC"]').click();
		assert.equal(element.querySelector("output").textContent, "1");
		element.querySelector('[data-command="DEC"]').click();
		assert.equal(element.querySelector("output").textContent, "0");
	} finally {
		dom.window.close();
	}
});

for (const [name, run] of [
	["inline", "git push origin main"],
	["literal", "|\n          echo checking\n          git push origin main"],
	["folded", ">-\n          git push\n          origin main"],
]) {
	test(`production publication CLI rejects ${name} mutation step`, () =>
		withSite(({ root, site }) => {
			const file = path.join(root, ".github/workflows/docs-contrast.yml");
			fs.appendFileSync(
				file,
				`\n      - name: Mutation fixture\n        run: ${run}\n`,
			);
			const result = cli(site, "check-docs-publication-contract.mjs");
			assert.notEqual(result.status, 0, result.output);
			assert.match(result.output, /mutation command/);
		}));
}
test("descriptive git push text is not a command", () =>
	withSite(({ root, site }) => {
		const file = path.join(root, ".github/workflows/docs-contrast.yml");
		fs.appendFileSync(
			file,
			'\n      - name: "run: git push is prohibited"\n        run: echo safe\n',
		);
		const result = cli(site, "check-docs-publication-contract.mjs");
		assert.equal(result.status, 0, result.output);
	}));

for (const specifier of [
	"ignite-element/xstat",
	"ignite-element/private-internals",
	"unlisted-example-dependency",
	"./misspelled-fixture",
]) {
	test(`example validator rejects unresolved ${specifier}`, () =>
		withSite(({ site }) => {
			fs.writeFileSync(
				path.join(site, "src/content/docs/review-fixture.mdx"),
				`\`\`\`ts\nimport { missing } from '${specifier}';\nmissing();\n\`\`\`\n`,
			);
			const result = cli(site, "check-doc-examples.mjs");
			assert.notEqual(result.status, 0, result.output);
			assert.match(result.output, /2307|unsupported|declaration/i);
		}));
}
test("example validator requires every configured declaration target", () =>
	withSite(({ site }) => {
		const scope = path.join(site, "node_modules/@ignite-element");
		fs.unlinkSync(scope);
		fs.mkdirSync(scope);
		for (const pkg of ["core", "adapters", "renderer"])
			fs.cpSync(
				path.join(siteRoot, "node_modules/@ignite-element", pkg),
				path.join(scope, pkg),
				{ recursive: true, dereference: true },
			);
		fs.rmSync(path.join(scope, "core/dist/types/index.d.ts"));
		const result = cli(site, "check-doc-examples.mjs");
		assert.notEqual(result.status, 0, result.output);
		assert.match(result.output, /declaration/i);
	}));

test("example validator rejects unsupported side-effect imports", () =>
	withSite(({ site }) => {
		fs.writeFileSync(
			path.join(site, "src/content/docs/review-fixture.mdx"),
			"```ts\nimport 'ignite-element/private-internals';\n```\n",
		);
		const result = cli(site, "check-doc-examples.mjs");
		assert.notEqual(result.status, 0, result.output);
		assert.match(result.output, /2307/);
	}));
