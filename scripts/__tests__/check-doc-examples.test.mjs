import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const site = path.join(repo, "docs/site");
const checker = fs.readFileSync(
	path.join(site, "scripts/check-doc-examples.mjs"),
);
const manifest = JSON.parse(fs.readFileSync(path.join(site, "package.json")));
const options = {
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
};

function example(file, marker) {
	const content = fs.readFileSync(
		path.join(site, "src/content/docs", file),
		"utf8",
	);
	const code = [...content.matchAll(/```(?:ts|tsx)\n([\s\S]*?)\n```/g)]
		.map((match) => match[1])
		.find((block) => block.includes(marker));
	assert.ok(code, `Missing substantive documentation example: ${file}`);
	return code;
}

const redux = example("api/testing-dsl.mdx", "const recoveryCounter =");
const actorWeb = example("guides/actor-web.mdx", "const homeTopology =");

function check(codes, { missing } = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ignite-doc-check-"));
	try {
		const fixtureSite = path.join(root, "docs/site");
		fs.mkdirSync(path.join(fixtureSite, "scripts"), { recursive: true });
		fs.mkdirSync(path.join(fixtureSite, "src/content/docs"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(root, "node_modules"));
		fs.symlinkSync(
			path.join(repo, "packages"),
			path.join(root, "packages"),
			"dir",
		);
		fs.symlinkSync(
			path.join(repo, "node_modules/typescript"),
			path.join(root, "node_modules/typescript"),
			"dir",
		);
		fs.writeFileSync(
			path.join(fixtureSite, "package.json"),
			JSON.stringify(manifest),
		);
		fs.writeFileSync(
			path.join(fixtureSite, "scripts/check-doc-examples.mjs"),
			checker,
		);
		for (const [name, version] of [
			["@reduxjs/toolkit", "2.12.0"],
			["@actor-web/runtime", "0.2.1"],
		]) {
			assert.equal(manifest.devDependencies[name], version);
			const installed = path.join(site, "node_modules", name);
			assert.equal(
				JSON.parse(fs.readFileSync(path.join(installed, "package.json")))
					.version,
				version,
			);
			if (missing === name) continue;
			const link = path.join(fixtureSite, "node_modules", name);
			fs.mkdirSync(path.dirname(link), { recursive: true });
			fs.symlinkSync(installed, link, "dir");
		}
		if (missing) {
			assert.equal(
				ts.resolveModuleName(
					missing,
					path.join(fixtureSite, ".doc-typecheck/probe.tsx"),
					options,
					ts.sys,
				).resolvedModule,
				undefined,
				"Missing-dependency control must not resolve through an ancestor",
			);
		}
		fs.writeFileSync(
			path.join(fixtureSite, "src/content/docs/probe.mdx"),
			codes.map((code) => `\`\`\`ts\n${code}\n\`\`\``).join("\n\n"),
		);
		const run = spawnSync(
			process.execPath,
			[path.join(fixtureSite, "scripts/check-doc-examples.mjs")],
			{
				cwd: root,
				env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" },
				encoding: "utf8",
				timeout: 30_000,
			},
		);
		assert.ifError(run.error);
		assert.equal(run.signal, null);
		assert.equal(
			fs.existsSync(path.join(fixtureSite, ".doc-typecheck")),
			false,
		);
		return { status: run.status, output: run.stdout + run.stderr };
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

test("actual checker accepts substantive Redux and Actor-Web examples with final docs dependencies", () => {
	const result = check([redux, actorWeb]);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /typechecked 2, 0 fragments skipped/);
	assert.match(result.output, /0 known issues baselined/);
});

test("actual checker rejects an invalid inferred event payload", () => {
	const valid = "events: [{ type: 'counter-incremented', count: 2 }]";
	assert.ok(redux.includes(valid));
	const result = check([
		redux.replace(
			valid,
			"events: [{ type: 'counter-incremented', count: 'invalid' }]",
		),
	]);
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /TS2322.*string.*number/);
});

test("actual checker rejects invalid inferred source-context access", () => {
	assert.ok(actorWeb.includes("snapshot.context.refreshCount"));
	const result = check([
		actorWeb.replace(
			"snapshot.context.refreshCount",
			"snapshot.context.missingContext",
		),
	]);
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /TS2339.*missingContext/);
});

test("required dependency resolution respects package exports", () => {
	const result = check([
		"import * as internal from '@actor-web/runtime/not-exported';\nexport const sample = 1;",
	]);
	assert.equal(result.status, 1, result.output);
	assert.match(
		result.output,
		/Required documentation dependency.*not-exported/,
	);
});

test("existing relative application-placeholder handling is preserved", () => {
	const result = check([
		"import { applicationSource } from './your-application';\nexport const source = applicationSource();",
	]);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /typechecked 1, 0 fragments skipped/);
});

for (const name of ["@reduxjs/toolkit", "@actor-web/runtime"]) {
	test(`actual checker visibly rejects missing required dependency ${name}`, () => {
		const result = check(
			[`import * as dependency from '${name}';\nexport const sample = 1;`],
			{ missing: name },
		);
		assert.notEqual(result.status, 0, result.output);
		assert.ok(result.output.includes(name), result.output);
		assert.match(result.output, /Required documentation dependency/);
		assert.match(result.output, /pnpm install --frozen-lockfile/);
	});
}
