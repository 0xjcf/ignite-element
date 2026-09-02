import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const packageNames = [
	"@ignite-element/core",
	"@ignite-element/adapters",
	"@ignite-element/renderer",
	"ignite-element",
];

function capture(command, args) {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(
			`${command} ${args.join(" ")} failed: ${result.stderr.trim()}`,
		);
	return result.stdout.trim();
}

export function assertApprovedRelease({ expectedVersion, metadata }) {
	if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(expectedVersion))
		throw new Error("expected version must be a beta prerelease");
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
	const metadata = Object.fromEntries(
		packageNames.map((name) => {
			const record = JSON.parse(
				capture("npm", [
					"view",
					`${name}@${expectedVersion}`,
					"--json",
					"--prefer-online",
				]),
			);
			record.tags = JSON.parse(
				capture("npm", [
					"view",
					name,
					"dist-tags",
					"--json",
					"--prefer-online",
				]),
			);
			return [name, record];
		}),
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
		if (!process.argv[2])
			throw new Error(
				"usage: node scripts/verify-beta-release.mjs <x.y.z-beta.n>",
			);
		verifyApprovedRelease(process.argv[2]);
	} catch (error) {
		console.error(`[release:verify] ${error.message}`);
		process.exitCode = 1;
	}
}
