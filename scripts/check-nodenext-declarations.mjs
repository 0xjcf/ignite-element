import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	extensionlessRelativeSpecifiers,
	publishedPackageRoots,
	repositoryRoot,
} from "./rewrite-declaration-extensions.mjs";

const repoRoot = repositoryRoot();
const typescript = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
const attw = join(
	repoRoot,
	"node_modules",
	"@arethetypeswrong",
	"cli",
	"dist",
	"index.js",
);

const consumerSource = `import { igniteCore } from "ignite-element/xstate";
import { createMachine } from "xstate";

type Expect<T extends true> = T;
type IsNotAny<T> = 0 extends 1 & T ? false : true;

const machine = createMachine({
	context: { count: 0 },
	initial: "idle",
	states: {
		idle: {
			on: {
				INC: {
					actions: () => undefined,
				},
			},
		},
	},
});

igniteCore({
	adapter: "xstate",
	source: machine,
	states(snapshot) {
		type _snapshot = Expect<IsNotAny<typeof snapshot>>;
		type _count = Expect<IsNotAny<typeof snapshot.context.count>>;
		const count: number = snapshot.context.count;
		return { count };
	},
	commands({ source }) {
		type _source = Expect<IsNotAny<typeof source>>;
		return {
			increment: () => source.send({ type: "INC" }),
		};
	},
});
`;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function assertFile(packageDir, relativePath, label) {
	assert.ok(
		existsSync(join(packageDir, relativePath)),
		`${label} is missing: ${relativePath}`,
	);
}

function assertExportConditions(packageDir) {
	const manifest = readJson(join(packageDir, "package.json"));
	assert.equal(manifest.type, "module", `${manifest.name} stays ESM`);
	assertFile(packageDir, manifest.types, `${manifest.name} types`);

	for (const [subpath, targets] of Object.entries(
		manifest.typesVersions?.["*"] ?? {},
	)) {
		for (const target of targets) {
			assertFile(
				packageDir,
				target,
				`${manifest.name} typesVersions ${subpath}`,
			);
		}
	}

	for (const [subpath, target] of Object.entries(manifest.exports)) {
		if (typeof target === "string") {
			assertFile(packageDir, target, `${manifest.name} ${subpath}`);
			continue;
		}

		assert.equal(
			Object.keys(target)[0],
			"types",
			`${manifest.name} ${subpath} must keep the types condition first`,
		);
		assert.equal(typeof target.types, "string");
		assert.equal(typeof target.import, "string");
		assert.equal(target.default, target.import);
		assert.equal(
			target.default.includes(".development."),
			false,
			`${manifest.name} ${subpath} default must stay the production build`,
		);
		assertFile(packageDir, target.types, `${manifest.name} ${subpath} types`);
		assertFile(
			packageDir,
			target.default,
			`${manifest.name} ${subpath} default`,
		);

		if (target.development) {
			assert.equal(Object.keys(target.development)[0], "types");
			assert.equal(target.development.types, target.types);
			assert.equal(
				target.development.default.includes(".development."),
				true,
				`${manifest.name} ${subpath} development build was swapped with production`,
			);
		}
		if (target.production) {
			assert.equal(Object.keys(target.production)[0], "types");
			assert.equal(target.production.types, target.types);
			assert.equal(target.production.default, target.default);
			assert.equal(target.production.import, target.import);
		}
	}

	return manifest;
}

function assertNodeResolvesProductionDefault(
	packageDir,
	manifest,
	consumerDir,
) {
	const require = createRequire(join(consumerDir, "package.json"));
	for (const [subpath, target] of Object.entries(manifest.exports)) {
		if (typeof target !== "object" || typeof target.default !== "string") {
			continue;
		}
		const specifier =
			subpath === "." ? manifest.name : `${manifest.name}${subpath.slice(1)}`;
		const resolved = require.resolve(specifier);
		assert.equal(
			resolved,
			join(packageDir, target.default),
			`${specifier} must resolve to the production default when custom conditions are unset`,
		);
	}
}

function runAttw(packageDir) {
	const before = new Set(readdirSync(packageDir));
	const result = spawnSync(
		process.execPath,
		[
			attw,
			"--pack",
			packageDir,
			"--profile",
			"node16",
			// ESM-only packages have no require contract. node16-from-CJS reports
			// that expected dynamic-import limit; internal resolution still fails
			// the command.
			"--ignore-rules",
			"cjs-resolves-to-esm",
			"--format",
			"ascii",
		],
		{ cwd: repoRoot, encoding: "utf8" },
	);

	for (const name of readdirSync(packageDir)) {
		if (!before.has(name) && name.endsWith(".tgz")) {
			rmSync(join(packageDir, name));
		}
	}

	assert.equal(
		result.status,
		0,
		`${packageDir} attw node16 failed\n${result.stdout}\n${result.stderr}`,
	);
}

function typecheckConsumer(directory, filename, compilerOptions) {
	writeFileSync(
		join(directory, filename),
		`${JSON.stringify({ compilerOptions, files: ["consumer.ts"] }, null, 2)}\n`,
	);
	const result = spawnSync(
		process.execPath,
		[typescript, "--project", join(directory, filename), "--pretty", "false"],
		{ cwd: directory, encoding: "utf8" },
	);
	assert.equal(
		result.status,
		0,
		`${filename} failed\n${result.stdout}\n${result.stderr}`,
	);
}

function assertConsumers() {
	const directory = mkdtempSync(join(tmpdir(), "ignite-nodenext-"));
	try {
		mkdirSync(join(directory, "node_modules", "@ignite-element"), {
			recursive: true,
		});
		symlinkSync(
			join(repoRoot, "packages", "ignite-element"),
			join(directory, "node_modules", "ignite-element"),
		);
		symlinkSync(
			join(repoRoot, "packages", "ignite-core"),
			join(directory, "node_modules", "@ignite-element", "core"),
		);
		symlinkSync(
			join(repoRoot, "packages", "ignite-adapters"),
			join(directory, "node_modules", "@ignite-element", "adapters"),
		);
		symlinkSync(
			join(repoRoot, "packages", "ignite-renderer"),
			join(directory, "node_modules", "@ignite-element", "renderer"),
		);
		symlinkSync(
			join(repoRoot, "packages", "ignite-element", "node_modules", "xstate"),
			join(directory, "node_modules", "xstate"),
		);
		writeFileSync(
			join(directory, "package.json"),
			`${JSON.stringify({ private: true, type: "module" })}\n`,
		);
		writeFileSync(join(directory, "consumer.ts"), consumerSource);

		const shared = {
			target: "ES2022",
			lib: ["ES2022", "DOM"],
			strict: true,
			noEmit: true,
			types: [],
		};
		typecheckConsumer(directory, "tsconfig.nodenext.json", {
			...shared,
			module: "NodeNext",
			moduleResolution: "NodeNext",
			// Matches consumers that hide unresolved declaration imports and
			// would otherwise see igniteCore callback parameters as any.
			skipLibCheck: true,
		});
		typecheckConsumer(directory, "tsconfig.nodenext-strict.json", {
			...shared,
			module: "NodeNext",
			moduleResolution: "NodeNext",
			skipLibCheck: false,
		});
		typecheckConsumer(directory, "tsconfig.node10.json", {
			...shared,
			module: "ESNext",
			moduleResolution: "node10",
			skipLibCheck: false,
		});
		typecheckConsumer(directory, "tsconfig.bundler.json", {
			...shared,
			module: "ESNext",
			moduleResolution: "bundler",
			skipLibCheck: false,
		});

		for (const packageDir of publishedPackageRoots()) {
			const manifest = readJson(join(packageDir, "package.json"));
			assertNodeResolvesProductionDefault(packageDir, manifest, directory);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

assert.ok(existsSync(typescript), "typescript is not installed");
assert.ok(existsSync(attw), "@arethetypeswrong/cli is not installed");

for (const packageDir of publishedPackageRoots()) {
	const extensionless = extensionlessRelativeSpecifiers(packageDir);
	assert.deepEqual(
		extensionless,
		[],
		`extensionless declaration imports remain:\n${extensionless
			.slice(0, 8)
			.map((item) => `${item.file} -> ${item.specifier}`)
			.join("\n")}`,
	);
	const manifest = assertExportConditions(packageDir);
	runAttw(packageDir);
	console.log(`[nodenext] ${manifest.name} node16 declarations resolve`);
}

assertConsumers();
console.log(
	"[nodenext] NodeNext callbacks stay typed, node10 still resolves, and default stays production",
);
