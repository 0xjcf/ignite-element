import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

const packageDirectories = [
	"packages/ignite-core",
	"packages/ignite-adapters",
	"packages/ignite-renderer",
	"packages/ignite-element",
];

function readJson(path) {
	return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8"));
}

function sourceFiles(path) {
	const absolutePath = resolve(repositoryRoot, path);
	const files = [];

	for (const entry of readdirSync(absolutePath)) {
		if (["dist", "node_modules"].includes(entry)) continue;

		const entryPath = join(absolutePath, entry);
		if (statSync(entryPath).isDirectory()) {
			files.push(...sourceFiles(relative(repositoryRoot, entryPath)));
			continue;
		}

		if (/\.(?:ts|tsx|md|json)$/.test(entry)) files.push(entryPath);
	}

	return files;
}

test("publishable package manifests advertise ESM-only entrypoints", () => {
	for (const packageDirectory of packageDirectories) {
		const manifest = readJson(`${packageDirectory}/package.json`);

		assert.equal(
			Object.hasOwn(manifest, "main"),
			false,
			`${manifest.name} must not advertise a CommonJS main entrypoint`,
		);

		for (const [subpath, target] of Object.entries(manifest.exports)) {
			if (typeof target === "string") continue;

			assert.equal(
				Object.hasOwn(target, "require"),
				false,
				`${manifest.name} ${subpath} must not advertise a require condition`,
			);
			assert.equal(
				target.default,
				target.import,
				`${manifest.name} ${subpath} must use the ESM entrypoint as its default`,
			);
		}

		for (const sideEffect of Array.isArray(manifest.sideEffects)
			? manifest.sideEffects
			: []) {
			assert.doesNotMatch(
				sideEffect,
				/(?:\.cjs(?:\.|$)|\.umd(?:\.|$))/,
				`${manifest.name} must not retain CommonJS or UMD side-effect paths`,
			);
		}
	}
});

test("the shared library build config explicitly emits only ES modules", () => {
	const config = readFileSync(
		resolve(repositoryRoot, "configs/vite/lib.ts"),
		"utf8",
	);

	assert.match(config, /formats:\s*\[\s*["']es["']\s*\]/);
});

test("source aliases are paired with a packed-consumer verification lane", () => {
	const exampleConfig = readFileSync(
		resolve(repositoryRoot, "examples/agents/voice-workbench/vite.config.ts"),
		"utf8",
	);
	const rootManifest = readJson("package.json");

	assert.match(exampleConfig, /alias/);
	assert.equal(typeof rootManifest.scripts["verify:packed"], "string");
});

test("Voice Workbench imports test from the supported XState adapter boundary", () => {
	const voiceRoot = "examples/agents/voice-workbench";
	const legacyReferences = sourceFiles(voiceRoot)
		.filter((path) =>
			readFileSync(path, "utf8").includes("ignite-element/testing"),
		)
		.map((path) => relative(repositoryRoot, path))
		.sort();

	assert.deepEqual(legacyReferences, []);

	const manifest = readJson(`${voiceRoot}/package.json`);
	assert.equal(typeof manifest.dependencies["ignite-element"], "string");
	assert.equal(
		typeof manifest.dependencies["@ignite-element/renderer"],
		"string",
	);
});

test("public documentation places effect execution after renderer notification", () => {
	const model = readFileSync(
		resolve(
			repositoryRoot,
			"docs/site/src/content/docs/concepts/the-ignite-model.mdx",
		),
		"utf8",
	);

	assert.doesNotMatch(model, /effects attach before the render subscription/i);
	assert.match(model, /renderer notification[\s\S]*effect microtask/i);
});
