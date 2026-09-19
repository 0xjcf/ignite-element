import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Explicitly retained outside the repository: no workspace resolution or aliases.
const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, "../../../..");
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	if (!process.argv[2])
		throw Error("Provide a new external task-owned fixture directory");
	const destination = resolve(process.argv[2]);
	if (destination === repository || destination.startsWith(`${repository}/`))
		throw Error("Fixture must be outside the workspace");
	mkdirSync(destination);
	const run = (cwd, ...args) =>
		execFileSync("pnpm", args, { cwd, stdio: "inherit" });
	const manifest = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
	const hashes = {};
	manifest.pnpm = { overrides: {} };
	for (const name of [
		"ignite-core",
		"ignite-adapters",
		"ignite-renderer",
		"ignite-element",
	]) {
		const directory = join(repository, "packages", name);
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
	for (const name of [
		"babel.config.cjs",
		"jest.config.cjs",
		"bindings.native.js",
		"consumer.tsx",
		"tsconfig.json",
		"isolation.mjs",
	])
		copyFileSync(join(here, name), join(destination, name));
	writeFileSync(
		join(destination, "package.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
		{ flag: "wx" },
	);
	writeFileSync(
		join(destination, ".npmrc"),
		"node-linker=hoisted\nauto-install-peers=false\n",
		{ flag: "wx" },
	);
	writeFileSync(
		join(destination, "tarball-hashes.json"),
		`${JSON.stringify(hashes, null, 2)}\n`,
		{ flag: "wx" },
	);
	run(destination, "install");
	run(destination, "install", "--frozen-lockfile");
	run(destination, "run", "isolation");
	run(destination, "run", "typecheck");
	run(destination, "test");
}
