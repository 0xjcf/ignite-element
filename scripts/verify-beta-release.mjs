import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageNames = [
	"@ignite-element/core",
	"@ignite-element/adapters",
	"@ignite-element/renderer",
	"ignite-element",
];

function betaVersion(value) {
	// The final negative lookahead requires absolute end-of-input, including newlines.
	if (
		typeof value !== "string" ||
		!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta\.(0|[1-9]\d*)(?![\s\S])/.test(
			value,
		)
	)
		throw new Error(
			"expected version must be a beta prerelease; usage: node scripts/verify-beta-release.mjs [--] <x.y.z-beta.n>",
		);
	return value;
}

export function parseVerificationArguments(args) {
	const values = args[0] === "--" ? args.slice(1) : args;
	if (values.length !== 1) betaVersion(undefined);
	return betaVersion(values[0]);
}

function withAnonymousRegistry(read) {
	const directory = fs.mkdtempSync(
		path.join(os.tmpdir(), "ignite-public-verification-"),
	);
	try {
		// Pin npm's project boundary even when TMPDIR is beneath another project.
		fs.writeFileSync(
			path.join(directory, "package.json"),
			'{"private":true}\n',
		);
		fs.writeFileSync(path.join(directory, ".npmrc"), "", { mode: 0o600 });
		const userconfig = path.join(directory, "user.npmrc");
		const globalconfig = path.join(directory, "global.npmrc");
		const cache = path.join(directory, "cache");
		fs.writeFileSync(userconfig, "", { mode: 0o600 });
		fs.writeFileSync(globalconfig, "", { mode: 0o600 });
		fs.mkdirSync(cache);
		// Allow only tool discovery and Windows execution essentials. In particular,
		// do not inherit npm config, tokens, NODE_OPTIONS or project configuration.
		const env = Object.fromEntries(
			["PATH", "SystemRoot", "WINDIR", "PATHEXT"]
				.filter((key) => process.env[key] !== undefined)
				.map((key) => [key, process.env[key]]),
		);
		Object.assign(env, {
			NPM_CONFIG_USERCONFIG: userconfig,
			NPM_CONFIG_GLOBALCONFIG: globalconfig,
			NPM_CONFIG_CACHE: cache,
		});
		return read((args) => {
			const result = spawnSync(
				"npm",
				[
					...args,
					`--prefix=${directory}`,
					"--registry=https://registry.npmjs.org",
				],
				{ cwd: directory, env, encoding: "utf8" },
			);
			// npm stderr can include configuration or response data. Report the
			// operation and exit disposition without echoing that untrusted data.
			if (result.error)
				throw new Error(
					`npm view could not execute (${result.error.code ?? "spawn error"})`,
				);
			if (result.status !== 0)
				throw new Error(
					`npm view ${args[1]} failed (exit ${result.status}, signal ${result.signal ?? "none"})`,
				);
			try {
				return JSON.parse(result.stdout);
			} catch {
				throw new Error(`npm view ${args[1]} returned invalid JSON`);
			}
		});
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

export function assertApprovedRelease({ expectedVersion, metadata }) {
	betaVersion(expectedVersion);
	for (const name of packageNames) {
		const record = metadata[name];
		if (record?.version !== expectedVersion)
			throw new Error(`${name}@${expectedVersion} is not public`);
		if (record.tags?.beta !== expectedVersion)
			throw new Error(
				`${name} beta tag does not resolve to ${expectedVersion}`,
			);
		if (!record.dist?.attestations)
			throw new Error(
				`${name}@${expectedVersion} does not expose provenance attestations`,
			);
	}
	if (
		metadata["ignite-element"].tags.latest === expectedVersion ||
		!/^2\./.test(metadata["ignite-element"].tags.latest ?? "")
	)
		throw new Error("facade latest must remain on the v2 stable line");
	for (const name of packageNames.slice(0, 3)) {
		if (metadata[name].tags.latest !== expectedVersion)
			throw new Error(
				`${name} latest must match the accepted scoped prerelease policy`,
			);
	}
	const internalNames = new Set(packageNames);
	for (const [packageName, record] of Object.entries(metadata)) {
		for (const [dependency, range] of Object.entries(
			record.dependencies ?? {},
		)) {
			if (internalNames.has(dependency) && range !== expectedVersion)
				throw new Error(
					`${packageName} has non-exact internal dependency ${dependency}@${range}`,
				);
		}
	}
	return true;
}

export function verifyApprovedRelease(expectedVersion) {
	betaVersion(expectedVersion);
	const metadata = withAnonymousRegistry((capture) =>
		Object.fromEntries(
			packageNames.map((name) => {
				const record = capture([
					"view",
					`${name}@${expectedVersion}`,
					"--json",
					"--prefer-online",
				]);
				record.tags = capture([
					"view",
					name,
					"dist-tags",
					"--json",
					"--prefer-online",
				]);
				return [name, record];
			}),
		),
	);
	assertApprovedRelease({ expectedVersion, metadata });
	console.info(
		JSON.stringify(
			{
				expectedVersion,
				packages: packageNames,
				status: "verified-public-beta-policy",
			},
			null,
			2,
		),
	);
	return metadata;
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		verifyApprovedRelease(parseVerificationArguments(process.argv.slice(2)));
	} catch (error) {
		console.error(`[release:verify] ${error.message}`);
		process.exitCode = 1;
	}
}
