import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Explicit external fixture: consume the exact local upstream package, never aliases.
const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, "../../..");
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const [output, actorPackage] = process.argv.slice(2);
	if (!output || !actorPackage)
		throw Error(
			"Provide a new external fixture directory and the built Actor-Web runtime package directory",
		);
	const destination = resolve(output);
	const upstream = resolve(actorPackage);
	for (const root of [repository, upstream]) {
		if (destination === root || destination.startsWith(`${root}/`))
			throw Error("Fixture must be external to source packages");
	}
	const actor = JSON.parse(
		readFileSync(join(upstream, "package.json"), "utf8"),
	);
	if (
		actor.name !== "@actor-web/runtime" ||
		actor.version !== "0.2.1" ||
		!actor.exports["./source"]
	)
		throw Error("Expected the corrected Actor-Web 0.2.1 source boundary");
	mkdirSync(destination);
	const run = (cwd, ...args) =>
		execFileSync("pnpm", args, { cwd, stdio: "inherit" });
	const manifest = {
		name: "ignite-authentic-actor-web-control",
		private: true,
		type: "module",
		packageManager: "pnpm@10.33.0",
		dependencies: { xstate: "5.30.0" },
		devDependencies: { typescript: "5.9.3", "@types/node": "25.0.3" },
		pnpm: { overrides: {} },
	};
	const hashes = {};
	for (const directory of [
		upstream,
		...[
			"ignite-core",
			"ignite-adapters",
			"ignite-renderer",
			"ignite-element",
		].map((name) => join(repository, "packages", name)),
	]) {
		const pkg = JSON.parse(
			readFileSync(join(directory, "package.json"), "utf8"),
		);
		run(directory, "pack", "--pack-destination", destination);
		const filename = `${pkg.name.replace(/^@/, "").replaceAll("/", "-")}-${pkg.version}.tgz`;
		hashes[filename] = createHash("sha256")
			.update(readFileSync(join(destination, filename)))
			.digest("hex");
		manifest.dependencies[pkg.name] = `file:./${filename}`;
		manifest.pnpm.overrides[pkg.name] = `file:./${filename}`;
	}
	for (const filename of [
		"authentic-actor-web-core.ts",
		"authentic-actor-web-core.mjs",
	])
		copyFileSync(join(here, filename), join(destination, filename));
	const write = (name, value) =>
		writeFileSync(
			join(destination, name),
			`${JSON.stringify(value, null, 2)}\n`,
			{ flag: "wx" },
		);
	write("package.json", manifest);
	write("tarball-hashes.json", hashes);
	write("tsconfig.json", {
		compilerOptions: {
			target: "ES2022",
			module: "ESNext",
			moduleResolution: "Bundler",
			lib: ["ES2022"],
			types: ["node"],
			strict: true,
			skipLibCheck: false,
			noEmit: true,
		},
		files: ["authentic-actor-web-core.ts"],
	});
	writeFileSync(join(destination, ".npmrc"), "auto-install-peers=false\n", {
		flag: "wx",
	});
	run(destination, "install");
	run(destination, "install", "--frozen-lockfile");
	run(destination, "exec", "tsc", "--project", "tsconfig.json");
	execFileSync(process.execPath, ["authentic-actor-web-core.mjs"], {
		cwd: destination,
		stdio: "inherit",
	});
}
