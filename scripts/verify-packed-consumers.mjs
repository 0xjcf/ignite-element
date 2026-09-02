import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "ignite-element-packed-"));
const tarballDirectory = join(temporaryRoot, "tarballs");
const npmCacheDirectory = join(temporaryRoot, "npm-cache");
const repositoryIdentity = {
	type: "git",
	url: "git+https://github.com/0xjcf/ignite-element.git",
};

const packageDefinitions = [
	{
		directory: "packages/ignite-core",
		name: "@ignite-element/core",
	},
	{
		directory: "packages/ignite-adapters",
		name: "@ignite-element/adapters",
	},
	{
		directory: "packages/ignite-renderer",
		name: "@ignite-element/renderer",
	},
	{
		directory: "packages/ignite-element",
		name: "ignite-element",
	},
];

const consumerLanes = [
	{
		name: "no-lit",
		dependencies: [
			"typescript@5.9.3",
			"xstate@5.32.1",
			"redux@5.0.1",
			"@reduxjs/toolkit@2.12.0",
			"mobx@6.16.1",
			"@actor-web/runtime@0.2.0",
			"react@19.0.0",
			"@types/react@19.0.0",
		],
		forbidLit: true,
		specifiers: [
			"@ignite-element/core",
			"@ignite-element/renderer",
			"@ignite-element/renderer/jsx",
			"@ignite-element/renderer/jsx-runtime",
			"@ignite-element/renderer/jsx-dev-runtime",
			"@ignite-element/renderer/jsx/index",
			"ignite-element",
			"ignite-element/jsx",
			"ignite-element/jsx/jsx-runtime",
			"ignite-element/jsx/jsx-dev-runtime",
			"ignite-element/tools",
			"ignite-element/tools/anthropic",
			"ignite-element/tools/openai",
			"ignite-element/package.json",
		],
	},
	{
		name: "with-lit",
		dependencies: ["typescript@5.9.3", "xstate@5.32.1", "lit-html@3.2.1"],
		specifiers: ["@ignite-element/renderer/lit"],
	},
	{
		name: "adapters",
		dependencies: [
			"typescript@5.9.3",
			"xstate@5.32.1",
			"redux@5.0.1",
			"@reduxjs/toolkit@2.12.0",
			"mobx@6.16.1",
			"@actor-web/runtime@0.2.0",
			"react@19.0.0",
			"@types/react@19.0.0",
		],
		specifiers: [
			"@ignite-element/adapters",
			"@ignite-element/adapters/actor-web",
			"@ignite-element/adapters/xstate",
			"@ignite-element/adapters/redux",
			"@ignite-element/adapters/mobx",
			"ignite-element/xstate",
			"ignite-element/redux",
			"ignite-element/mobx",
			"ignite-element/actor-web",
			"ignite-element/react",
		],
	},
];

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function run(command, args, options = {}) {
	console.info(`[verify:packed] ${command} ${args.join(" ")}`);
	execFileSync(command, args, {
		cwd: repositoryRoot,
		stdio: "inherit",
		...options,
	});
}

function tarballName(packageName, version) {
	return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

function sha256(file) {
	return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function resolveReviewedTarballs(manifestPath) {
	const manifest = readJson(manifestPath);
	if (
		manifest.schemaVersion !== 1 ||
		manifest.algorithm !== "sha256" ||
		manifest.packages?.length !== packageDefinitions.length
	) {
		throw new Error(
			"reviewed tarball manifest must contain exactly four SHA-256 entries",
		);
	}
	const baseDirectory = dirname(manifestPath);
	return packageDefinitions.map((definition, index) => {
		const entry = manifest.packages[index];
		if (entry.name !== definition.name) {
			throw new Error(`reviewed tarball order mismatch for ${definition.name}`);
		}
		const tarballPath = resolve(baseDirectory, entry.filename);
		if (
			!tarballPath.startsWith(`${resolve(baseDirectory)}/`) ||
			!existsSync(tarballPath)
		) {
			throw new Error(`missing reviewed tarball for ${entry.name}`);
		}
		if (
			statSync(tarballPath).size !== entry.size ||
			sha256(tarballPath) !== entry.sha256
		) {
			throw new Error(`reviewed tarball SHA-256 mismatch for ${entry.name}`);
		}
		const packedManifest = validateTarball(definition, tarballPath);
		assert.equal(packedManifest.version, entry.version);
		return tarballPath;
	});
}

function validateTarball(definition, tarballPath) {
	const inventory = execFileSync("tar", ["-tzf", tarballPath], {
		encoding: "utf8",
	})
		.trim()
		.split("\n");
	const inventorySet = new Set(inventory);
	const manifest = JSON.parse(
		execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
			encoding: "utf8",
		}),
	);

	assert.equal(manifest.name, definition.name);
	assert.deepEqual(
		manifest.repository,
		repositoryIdentity,
		`${manifest.name} tarball must expose the trusted-publisher repository identity`,
	);
	assert.equal(
		Object.hasOwn(manifest, "main"),
		false,
		`${manifest.name} tarball must not advertise a CommonJS main entrypoint`,
	);
	assert.equal(
		inventory.some((entry) => /(?:\.cjs(?:\.|$)|\.umd(?:\.|$))/.test(entry)),
		false,
		`${manifest.name} tarball must not contain CommonJS or UMD artifacts`,
	);

	for (const [subpath, target] of Object.entries(manifest.exports)) {
		if (typeof target === "string") {
			assert.ok(
				inventorySet.has(`package/${target.replace(/^\.\//, "")}`),
				`${manifest.name} ${subpath} must resolve inside its tarball`,
			);
			continue;
		}

		assert.equal(
			Object.hasOwn(target, "require"),
			false,
			`${manifest.name} ${subpath} must not advertise require`,
		);
		assert.equal(target.default, target.import);

		for (const condition of ["types", "import", "default"]) {
			assert.equal(
				typeof target[condition],
				"string",
				`${manifest.name} ${subpath} must advertise ${condition}`,
			);
			assert.ok(
				inventorySet.has(`package/${target[condition].replace(/^\.\//, "")}`),
				`${manifest.name} ${subpath} ${condition} target must exist in its tarball`,
			);
		}
	}

	return manifest;
}

function verifyTarballProvenance(consumerDirectory) {
	const lockfile = readJson(join(consumerDirectory, "package-lock.json"));

	for (const definition of packageDefinitions) {
		const installed = lockfile.packages[`node_modules/${definition.name}`];
		assert.ok(
			installed,
			`${definition.name} must be installed in the consumer`,
		);
		assert.match(
			installed.resolved,
			/^file:/,
			`${definition.name} must resolve from a local candidate tarball`,
		);
	}
}

function verifyConsumer(lane, tarballPaths) {
	const consumerDirectory = join(temporaryRoot, lane.name);
	mkdirSync(consumerDirectory);
	writeFileSync(
		join(consumerDirectory, "package.json"),
		`${JSON.stringify(
			{
				name: `ignite-element-packed-${lane.name}`,
				private: true,
				type: "module",
			},
			null,
			2,
		)}\n`,
	);
	writeFileSync(
		join(consumerDirectory, "tsconfig.json"),
		`${JSON.stringify(
			{
				compilerOptions: {
					lib: ["ES2022", "DOM"],
					module: "ESNext",
					moduleResolution: "Bundler",
					noEmit: true,
					resolveJsonModule: true,
					skipLibCheck: false,
					strict: true,
					target: "ES2022",
				},
				include: ["consumer.ts"],
			},
			null,
			2,
		)}\n`,
	);

	const typeSpecifiers = lane.specifiers.filter(
		(specifier) => !specifier.endsWith("/package.json"),
	);
	writeFileSync(
		join(consumerDirectory, "consumer.ts"),
		`${typeSpecifiers
			.map(
				(specifier, index) =>
					`import * as package${index} from ${JSON.stringify(specifier)};`,
			)
			.join("\n")}\n\nexport const packages: unknown[] = [${typeSpecifiers
			.map((_, index) => `package${index}`)
			.join(", ")}];\n`,
	);
	writeFileSync(
		join(consumerDirectory, "consumer.mjs"),
		`import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const specifiers = ${JSON.stringify(lane.specifiers, null, 2)};
const installedRoot = pathToFileURL(process.cwd() + "/node_modules/").href;
for (const specifier of specifiers) {
	assert.ok(
		import.meta.resolve(specifier).startsWith(installedRoot),
		specifier + " must resolve inside the disposable consumer",
	);
	if (specifier.endsWith("/package.json")) {
		await import(specifier, { with: { type: "json" } });
	} else {
		await import(specifier);
	}
}
${
	lane.forbidLit
		? `const require = createRequire(import.meta.url);
assert.throws(() => require.resolve("lit-html"), { code: "MODULE_NOT_FOUND" });`
		: "void assert;\nvoid createRequire;"
}
`,
	);

	run(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--cache",
			npmCacheDirectory,
			...tarballPaths,
			...lane.dependencies,
		],
		{ cwd: consumerDirectory },
	);
	verifyTarballProvenance(consumerDirectory);
	run(
		"node",
		["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
		{
			cwd: consumerDirectory,
		},
	);
	run("node", ["consumer.mjs"], { cwd: consumerDirectory });
}

try {
	mkdirSync(tarballDirectory);
	const manifestArgument = process.argv.indexOf("--tarball-manifest");
	let tarballPaths;
	if (manifestArgument !== -1) {
		if (!process.argv[manifestArgument + 1]) {
			throw new Error("--tarball-manifest requires a path");
		}
		tarballPaths = resolveReviewedTarballs(
			resolve(process.argv[manifestArgument + 1]),
		);
	} else {
		tarballPaths = [];
		for (const definition of packageDefinitions) {
			const packageDirectory = resolve(repositoryRoot, definition.directory);
			const sourceManifest = readJson(join(packageDirectory, "package.json"));
			run("pnpm", ["pack", "--pack-destination", tarballDirectory], {
				cwd: packageDirectory,
			});

			const tarballPath = join(
				tarballDirectory,
				tarballName(definition.name, sourceManifest.version),
			);
			validateTarball(definition, tarballPath);
			tarballPaths.push(tarballPath);
		}
	}

	for (const lane of consumerLanes) {
		verifyConsumer(lane, tarballPaths);
	}

	console.info(
		"[verify:packed] Candidate tarballs passed ESM inventory, provenance, runtime-import, and strict declaration checks.",
	);
} finally {
	rmSync(temporaryRoot, { force: true, recursive: true });
}
