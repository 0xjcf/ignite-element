import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Matches the repository's public-package fixture approach, without source aliases.
// This file is inert on import; all outputs belong to a new disposable directory.
export function proveConsumers(destination) {
	const example = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const repository = resolve(example, "../../..");
	const output = destination
		? resolve(destination)
		: mkdtempSync(join(tmpdir(), "ignite-density-packed-"));
	if (destination) {
		if (output === repository || output.startsWith(`${repository}/`))
			throw Error("Use a new directory outside the repository");
		mkdirSync(output);
	}
	const write = (file, data) =>
		writeFileSync(
			file,
			typeof data === "string" ? data : `${JSON.stringify(data, null, 2)}\n`,
			{ flag: "wx" },
		);
	let sequence = 0;
	function run(cwd, ...args) {
		const start = new Date();
		let status = 0;
		let text;
		try {
			text = execFileSync(args[0], args.slice(1), {
				cwd,
				encoding: "utf8",
				maxBuffer: 20 * 1024 * 1024,
			});
		} catch (error) {
			status = error.status ?? 1;
			text = String(error.stdout ?? "") + String(error.stderr ?? "");
		}
		write(
			join(output, `command-${++sequence}.log`),
			JSON.stringify({
				command: args,
				cwd,
				start: start.toISOString(),
				end: new Date().toISOString(),
				status,
			}) +
				"\n" +
				text,
		);
		process.stdout.write(text);
		if (status)
			throw Error(`Consumer command failed: ${args.join(" ")} (see ${output})`);
	}
	const manager = execFileSync("pnpm", ["--version"], {
		encoding: "utf8",
	}).trim();
	if (manager !== "10.33.0") throw Error("Use the pinned pnpm 10.33.0");
	const tarballs = join(output, "tarballs");
	mkdirSync(tarballs);
	const dependencies = {};
	const hashes = {};
	for (const directory of [
		"ignite-core",
		"ignite-adapters",
		"ignite-renderer",
		"ignite-element",
	]) {
		const pkgDir = join(repository, "packages", directory);
		const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
		if (!existsSync(join(pkgDir, "dist")))
			throw Error("Build the checked-out package family first");
		run(
			pkgDir,
			"pnpm",
			"pack",
			"--config.ignore-scripts=true",
			"--pack-destination",
			tarballs,
		);
		const file = `${pkg.name.replace(/^@/, "").replaceAll("/", "-")}-${pkg.version}.tgz`;
		dependencies[pkg.name] = `file:../tarballs/${file}`;
		hashes[file] = createHash("sha256")
			.update(readFileSync(join(tarballs, file)))
			.digest("hex");
		const packed = JSON.parse(
			execFileSync(
				"tar",
				["-xOf", join(tarballs, file), "package/package.json"],
				{ encoding: "utf8" },
			),
		);
		for (const [name, version] of Object.entries(packed.dependencies ?? {}))
			if (name.startsWith("@ignite-element/") && version !== pkg.version)
				throw Error("Packed internal version mismatch");
	}
	write(join(output, "tarball-hashes.json"), hashes);
	for (const lane of ["web", "native", "neutral"]) {
		const target = join(output, lane);
		mkdirSync(target);
		mkdirSync(join(target, "src"));
		for (const name of readdirSync(join(example, "src"))) {
			if (
				lane !== "web" &&
				![
					"controller.ts",
					"states.ts",
					"source.ts",
					"owner.ts",
					"fake-ports.ts",
					"headless.ts",
					"native.tsx",
				].includes(name)
			)
				continue;
			copyFileSync(join(example, "src", name), join(target, "src", name));
		}
		let manifest;
		if (lane === "native") {
			const fixture = join(
				repository,
				"scripts/__tests__/fixtures/react-native-bindings",
			);
			manifest = JSON.parse(
				readFileSync(join(fixture, "package.json"), "utf8"),
			);
			for (const name of [
				"babel.config.cjs",
				"jest.config.cjs",
				"bindings.native.js",
				"consumer.tsx",
				"tsconfig.json",
				"isolation.mjs",
			])
				copyFileSync(join(fixture, name), join(target, name));
			manifest.dependencies = { xstate: "5.32.1", ...dependencies };
			cpSync(join(example, "native-fixture"), join(target, "density"), {
				recursive: true,
				errorOnExist: true,
				force: false,
			});
			const config = JSON.parse(
				readFileSync(join(fixture, "tsconfig.json"), "utf8"),
			);
			config.compilerOptions = {
				...config.compilerOptions,
				noEmit: false,
				outDir: "dist",
			};
			config.include = ["src/native.tsx", "src/fake-ports.ts"];
			write(join(target, "tsconfig.density.json"), config);
		} else if (lane === "web") {
			manifest = JSON.parse(
				readFileSync(join(example, "package.json"), "utf8"),
			);
			manifest.dependencies = { ...manifest.dependencies, ...dependencies };
			for (const name of ["tsconfig.json", "vite.config.ts"])
				copyFileSync(join(example, name), join(target, name));
		} else {
			manifest = {
				private: true,
				type: "module",
				packageManager: "pnpm@10.33.0",
				dependencies: { ...dependencies, react: "19.2.7" },
				devDependencies: {
					typescript: "5.9.3",
					"@types/node": "25.0.3",
					"@types/react": "19.2.17",
				},
			};
			write(join(target, "tsconfig.json"), {
				compilerOptions: {
					strict: true,
					skipLibCheck: false,
					target: "ES2022",
					module: "ESNext",
					moduleResolution: "Bundler",
					lib: ["ES2022"],
					types: ["node"],
					outDir: "dist",
				},
				include: ["src/headless.ts", "src/fake-ports.ts"],
			});
			copyFileSync(
				join(example, "scripts/neutral.mjs"),
				join(target, "neutral.mjs"),
			);
		}
		manifest.pnpm = { overrides: dependencies };
		write(join(target, "package.json"), manifest);
		write(
			join(target, ".npmrc"),
			`${lane === "native" ? "node-linker=hoisted\n" : ""}auto-install-peers=false\n`,
		);
		run(target, "pnpm", "install");
		run(target, "pnpm", "install", "--frozen-lockfile");
		if (lane === "native") {
			run(target, "pnpm", "exec", "tsc", "-p", "tsconfig.density.json");
			run(target, "pnpm", "run", "typecheck");
			run(target, "pnpm", "run", "isolation");
			run(target, "pnpm", "test");
		} else {
			run(target, "pnpm", "exec", "tsc", "-p", "tsconfig.json");
			if (lane === "web") run(target, "pnpm", "test");
			else run(target, "node", "neutral.mjs");
		}
	}
	console.log(`Review fixtures retained: ${output}`);
	return output;
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	proveConsumers(process.argv[2]);
