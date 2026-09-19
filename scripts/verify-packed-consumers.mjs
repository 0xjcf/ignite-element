import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
	...[
		{ name: "xstate", dependencies: ["xstate@5.32.1"] },
		{ name: "redux", dependencies: ["redux@5.0.1", "@reduxjs/toolkit@2.12.0"] },
		{ name: "mobx", dependencies: ["mobx@6.16.1"] },
		{ name: "actor-web", dependencies: [] },
		{ name: "react", dependencies: ["react@19.2.7", "@types/react@19.2.17"] },
	].map((lane) => ({
		name: `neutral-${lane.name}`,
		dependencies: [
			"typescript@5.9.3",
			"@types/node@25.0.3",
			...lane.dependencies,
		],
		forbidPeers: [
			"lit-html",
			"react-dom",
			"solid-js",
			"vue",
			...(lane.name === "xstate" ? [] : ["xstate"]),
			...(lane.name === "redux" ? [] : ["redux", "@reduxjs/toolkit"]),
			...(lane.name === "mobx" ? [] : ["mobx"]),
			...(lane.name === "react" ? [] : ["react"]),
			"@actor-web/runtime",
		],
		specifiers: [`ignite-element/${lane.name}`],
		noDom: true,
	})),
	{
		name: "source-free",
		dependencies: ["typescript@5.9.3"],
		forbidPeers: [
			"lit-html",
			"xstate",
			"redux",
			"@reduxjs/toolkit",
			"mobx",
			"@actor-web/runtime",
			"react",
		],
		specifiers: [
			"ignite-element",
			"ignite-element/jsx",
			"ignite-element/jsx/jsx-runtime",
		],
	},
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
			"ignite-element/react/web",
			"ignite-element/actor-web/web",
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
					lib: lane.noDom
						? ["ES2022", "ESNext.Collection"]
						: lane.name === "adapters"
							? ["ES2022", "DOM", "ESNext.Collection"]
							: ["ES2022", "DOM"],
					module: "ESNext",
					jsx: "react-jsx",
					jsxImportSource: "ignite-element/jsx",
					moduleResolution: "Bundler",
					noEmit: true,
					resolveJsonModule: true,
					skipLibCheck: false,
					strict: true,
					target: "ES2022",
				},
				include: [
					"consumer.tsx",
					"factory.ts",
					"removed-*.ts",
					"native-events.tsx",
					"event-contract.tsx",
				],
			},
			null,
			2,
		)}\n`,
	);

	const typeSpecifiers = lane.specifiers.filter(
		(specifier) => !specifier.endsWith("/package.json"),
	);
	writeFileSync(
		join(consumerDirectory, "consumer.tsx"),
		`${typeSpecifiers
			.map(
				(specifier, index) =>
					`import * as package${index} from ${JSON.stringify(specifier)};`,
			)
			.join("\n")}\n\nexport const packages: unknown[] = [${typeSpecifiers
			.map((_, index) => `package${index}`)
			.join(
				", ",
			)}];\n${lane.name === "source-free" ? sourceFreeTypeConsumer : ""}`,
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
		const entry = await import(specifier);
		if (["ignite-element", "ignite-element/xstate", "ignite-element/redux", "ignite-element/mobx", "ignite-element/actor-web"].includes(specifier)) {
			assert.equal(Object.hasOwn(entry, "test"), false, specifier + " must not export test");
		}
	}
}
${lane.name === "source-free" ? sourceFreeRuntimeConsumer : ""}
${
	lane.forbidPeers
		? `for (const peer of ${JSON.stringify(lane.forbidPeers)}) {
  assert.throws(() => createRequire(import.meta.url).resolve(peer), { code: "MODULE_NOT_FOUND" });
}`
		: ""
}
${
	lane.forbidLit
		? `const require = createRequire(import.meta.url);
assert.throws(() => require.resolve("lit-html"), { code: "MODULE_NOT_FOUND" });`
		: "void assert;\nvoid createRequire;"
}
`,
	);
	if (lane.noDom) {
		writeFileSync(
			join(consumerDirectory, "consumer.tsx"),
			readFileSync(
				join(repositoryRoot, "scripts/__tests__/fixtures", `${lane.name}.ts`),
				"utf8",
			),
		);
	}
	if (lane.name === "neutral-mobx" || lane.name === "neutral-redux") {
		writeFileSync(
			join(consumerDirectory, "factory.ts"),
			readFileSync(
				join(
					repositoryRoot,
					"packages/ignite-element/src/tests/types",
					`factory-${lane.name.slice("neutral-".length)}.ts`,
				),
				"utf8",
			),
		);
	}
	if (lane.name === "adapters") {
		writeFileSync(
			join(consumerDirectory, "cleanup-removed.ts"),
			readFileSync(
				join(
					repositoryRoot,
					"packages/ignite-element/src/tests/types/cleanup-removed.ts",
				),
				"utf8",
			),
		);
		writeFileSync(
			join(consumerDirectory, "event-contract.tsx"),
			readFileSync(
				join(repositoryRoot, "scripts/__tests__/fixtures/event-contract.tsx"),
				"utf8",
			),
		);
		writeFileSync(
			join(consumerDirectory, "native-events.tsx"),
			readFileSync(
				join(
					repositoryRoot,
					"scripts/__tests__/fixtures/native-events-dom.tsx",
				),
				"utf8",
			),
		);
		for (const entry of ["xstate", "redux", "mobx", "actor-web"]) {
			writeFileSync(
				join(consumerDirectory, "removed-" + entry + ".ts"),
				removedTestingImports("ignite-element/" + entry),
			);
		}
		writeFileSync(
			join(consumerDirectory, "consumer.tsx"),
			readFileSync(join(consumerDirectory, "consumer.tsx"), "utf8") +
				readFileSync(
					join(
						repositoryRoot,
						"scripts/__tests__/fixtures/source-free-adapters.tsx",
					),
					"utf8",
				),
		);
	}

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
	if (lane.name === "adapters") {
		// Bundle the actual installed tarballs using normal package exports and
		// sideEffects metadata. A used constructor must retain its JSX registration.
		writeFileSync(
			join(consumerDirectory, "bundle-entry.mjs"),
			`
import { igniteCore } from "ignite-element/xstate";
import { getRegisteredRenderStrategies } from "@ignite-element/renderer";
export { igniteCore, getRegisteredRenderStrategies };
`,
		);
		writeFileSync(
			join(consumerDirectory, "bundle-build.mjs"),
			`
import { build } from ${JSON.stringify(import.meta.resolve("vite"))};
await build({ configFile: false, root: process.cwd(), build: {
  outDir: "bundled", minify: true,
  lib: { entry: "bundle-entry.mjs", formats: ["es"], fileName: () => "consumer.mjs" }
}});
`,
		);
		run("node", ["bundle-build.mjs"], { cwd: consumerDirectory });
		run(
			"node",
			[
				"--input-type=module",
				"-e",
				`
import assert from "node:assert/strict";
import { igniteCore, getRegisteredRenderStrategies } from "./bundled/consumer.mjs";
assert.equal(typeof igniteCore, "function");
assert.ok(getRegisteredRenderStrategies().includes("ignite-jsx"));
for (const name of ["HTMLElement", "document", "customElements", "window"]) {
  assert.equal(Object.hasOwn(globalThis, name), false);
}
console.info("[verify:packed] tree-shaken renderer registration retained without DOM fabrication");
`,
			],
			{ cwd: consumerDirectory },
		);
	}
	run(
		"node",
		["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
		{
			cwd: consumerDirectory,
		},
	);
	run("node", ["consumer.mjs"], { cwd: consumerDirectory });
	writeFileSync(
		join(consumerDirectory, "headless-dom-probe.mjs"),
		readFileSync(
			join(repositoryRoot, "scripts/__tests__/fixtures/headless-dom-probe.mjs"),
		),
	);
	for (const specifier of typeSpecifiers) {
		run(
			"node",
			[
				"headless-dom-probe.mjs",
				specifier,
				specifier === "ignite-element" ? "root" : "import",
			],
			{ cwd: consumerDirectory },
		);
	}
	if (lane.name === "adapters") {
		for (const [entry, kind] of [
			["xstate", "xstate"],
			["redux", "redux"],
			["mobx", "mobx"],
			["actor-web", "actor"],
		]) {
			for (const lifetime of ["live", "factory"])
				run(
					"node",
					[
						"headless-dom-probe.mjs",
						`ignite-element/${entry}`,
						`${kind}-${lifetime}`,
					],
					{ cwd: consumerDirectory },
				);
		}
	}
	if (lane.name === "source-free") {
		for (const [control, expected] of [
			["fake-control", /browser globals changed/],
			["access-control", /premature browser access detected/],
		]) {
			const result = spawnSync(
				process.execPath,
				["headless-dom-probe.mjs", "ignite-element", control],
				{ cwd: consumerDirectory, encoding: "utf8" },
			);
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, expected);
			console.info(`[verify:packed] negative control rejected: ${control}`);
		}
		const config = readJson(join(consumerDirectory, "tsconfig.json"));
		config.compilerOptions.lib = ["ES2022"];
		writeFileSync(
			join(consumerDirectory, "tsconfig.no-dom.json"),
			JSON.stringify(config),
		);
		const diagnostic = spawnSync(
			process.execPath,
			["node_modules/typescript/bin/tsc", "-p", "tsconfig.no-dom.json"],
			{ cwd: consumerDirectory, encoding: "utf8" },
		);
		console.info(
			`[verify:packed] NON-GATING no-lib-DOM diagnostic exit ${diagnostic.status}\n${diagnostic.stdout}${diagnostic.stderr}`,
		);
		if (diagnostic.status !== 0)
			assert.match(
				diagnostic.stdout,
				/Cannot find name '(HTMLElement|ShadowRoot|Node)'/,
			);
	}
}

const removedTestingTypes = [
	"IgniteDomBridge",
	"IgniteDomRoleExpectation",
	"IgniteEventExpectation",
	"IgniteSnapshotExpectation",
	"IgniteTestHelpers",
	"IgniteTestScenario",
	"IgniteTestScenarioOptions",
	"IgniteStoryTraceKind",
	"IgniteStoryTracePhase",
	"IgniteStoryCommandTraceEntry",
	"IgniteStoryBehaviorTraceEntry",
	"IgniteStorySnapshotTraceEntry",
	"IgniteStoryStatesTraceEntry",
	"IgniteStoryEventTraceEntry",
	"IgniteStoryTraceEntry",
	"IgniteStoryTraceSnapshotEntry",
	"IgniteStoryTraceSnapshot",
	"IgniteStoryLifecycleStage",
	"IgniteStoryLifecycleScope",
	"IgniteStoryLifecycleEntry",
	"IgniteStoryUntilOptions",
	"IgniteStoryStatesPredicate",
	"IgniteStorySummary",
	"IgniteStorySnapshotEvent",
	"IgniteStorySummarySnapshot",
	"IgniteStorySnapshot",
	"IgniteStory",
];

function removedTestingImports(specifier) {
	return [
		"// @ts-expect-error the testing value is retired",
		"import { test } from " + JSON.stringify(specifier) + ";",
		...removedTestingTypes.flatMap((name, index) => [
			"// @ts-expect-error retired named public type " + name,
			"import type { " +
				name +
				" as Removed" +
				index +
				" } from " +
				JSON.stringify(specifier) +
				";",
		]),
	].join("\n");
}

const sourceFreeTypeConsumer = `
${removedTestingImports("ignite-element")}
import { igniteCore, event, type IgniteAgentRuntime, type IgniteCommandCall, type RuntimeEvent } from "ignite-element";
// @ts-expect-error the command helper is retired
import type { CommandHelper } from "ignite-element";
const events = { changed: event<{ count: number }>() };
type Commands = { set: (value: number) => void };
declare const runtime: IgniteAgentRuntime<{ count: number }, Commands, typeof events, unknown, { label: string }>;
const call: IgniteCommandCall<Commands> = { command: "set", input: 2 };
runtime.execute(call).then(result => {
  const count: number = result.snapshot.count;
  const label: string = result.states.label;
  void count; void label;
});
runtime.on("changed", fact => { const count: number = fact.count; void count; });
const fact: RuntimeEvent<typeof events> = { type: "changed", count: 2 };
void fact;
// @ts-expect-error preserved command input type
runtime.execute({ command: "set", input: "bad" });
// @ts-expect-error preserved event name
runtime.on("missing", () => {});
// @ts-expect-error preserved event payload
const badFact: RuntimeEvent<typeof events> = { type: "changed", count: "bad" };
runtime.watch(states => { const label: string = states.label; void label; });
// @ts-expect-error preserved runtime projection type
const invalidStates: { label: number } = runtime.get("states");
// @ts-expect-error recording is retired from source-backed runtime typing
runtime.record("removed");
// @ts-expect-error retired runtime export
import { igniteShell } from "ignite-element";
// @ts-expect-error retired shell config
import type { IgniteShellConfig } from "ignite-element";
// @ts-expect-error retired shell host
import type { IgniteShellHost } from "ignite-element";
// @ts-expect-error retired shell registrar
import type { IgniteShellRegistrar } from "ignite-element";
// @ts-expect-error retired shell teardown
import type { IgniteShellTeardown } from "ignite-element";

const core = igniteCore();
const explicit = igniteCore(undefined);
const empty = igniteCore({});
core("packed-layout", () => <><style>{":host{display:grid}"}</style><main><slot /></main></>);
explicit("packed-explicit", () => null);
empty("packed-empty", () => <button onClick={() => {}}>Run</button>);
// @ts-expect-error renderer has no source argument
core("invalid-render", (ctx: { count: number }) => ctx.count);
// @ts-expect-error no execution on a source-free registrar
core.execute({ command: "anything" });
// @ts-expect-error no source state
core.getStates();
// @ts-expect-error no snapshots
core.getSnapshot();
// @ts-expect-error no subscription
core.watchStates(() => {});
// @ts-expect-error no disposal API
core.dispose();
// @ts-expect-error lifecycle hook retired, not ignored
igniteCore({ onConnect() {} });
// @ts-expect-error undefined hook is still a supplied key
igniteCore({ onConnect: undefined });
// @ts-expect-error source belongs to adapter entrypoints
igniteCore({ source: {} });
// @ts-expect-error An explicit discriminator does not make the root source-aware.
igniteCore({ source: () => ({}), adapter: "mobx" });
// @ts-expect-error An explicit discriminator does not make the root source-aware.
igniteCore({ source: () => ({}), adapter: "redux" });
// @ts-expect-error Factories still belong to dedicated entrypoints.
igniteCore({ source: () => ({}) });
// @ts-expect-error invalid source is not a static component
igniteCore({ source: undefined });
// @ts-expect-error no states configuration
igniteCore({ states: () => ({}) });
// @ts-expect-error no commands configuration
igniteCore({ commands: () => ({}) });
// @ts-expect-error no effects configuration
igniteCore({ effects: () => {} });
// @ts-expect-error no event configuration
igniteCore({ events: {} });
// @ts-expect-error no cleanup configuration
igniteCore({ cleanup: false });
// @ts-expect-error unknown key
igniteCore({ unexpected: true });
// @ts-expect-error null is not an empty configuration
igniteCore(null);
// @ts-expect-error array is not an empty configuration
igniteCore([]);
// @ts-expect-error function is not an empty configuration
igniteCore(() => {});
// @ts-expect-error primitive is not an empty configuration
igniteCore(1);
// @ts-expect-error extra arguments are not supported
igniteCore({}, {});
`;

const sourceFreeRuntimeConsumer = `
const root = await import("ignite-element");
assert.equal(typeof root.igniteCore, "function");
assert.equal("igniteShell" in root, false);
assert.equal("test" in root, false);
for (const args of [[], [undefined], [{}]]) {
  const core = Reflect.apply(root.igniteCore, undefined, args);
  assert.equal(typeof core, "function");
  for (const name of ["execute", "getSnapshot", "getStates", "watchStates", "dispose"]) {
    assert.equal(name in core, false);
  }
}
for (const config of [null, [], 1, "", () => {}, { onConnect() {} }, { source: undefined }, { source: () => ({}) }, { source: () => ({}), adapter: "mobx" }, { source: () => ({}), adapter: "redux" }, { states() {} }, { unexpected: true }]) {
  assert.throws(() => root.igniteCore(config), /source-free.*configuration/i);
}
`;

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
